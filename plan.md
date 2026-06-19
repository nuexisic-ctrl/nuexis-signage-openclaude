# NuExis — Backend Architecture Review & Remediation Plan

> **Scope:** Backend architecture, database design, synchronization, offline playback, caching,
> scaling, fault tolerance, security, data consistency, disaster recovery, and enterprise-grade
> reliability. UI is explicitly out of scope.
> **Lens:** NuExis scaled to **10,000+ screens deployed worldwide**.
> **Status:** Findings + plan only. **No code is changed by this document.**
> **Source of truth:** Live Supabase project `dpdabdbqhjkmxvwnukev` (org `gypaxmpkawjtwlpubeze`,
> region `ap-south-1`, Postgres 17), the local migration files, the Next.js player + server actions,
> and the Supabase security/performance advisors.

---

## 0. Current Architecture (as observed)

| Layer | Implementation |
|---|---|
| DB | Supabase Postgres 17, **single region** (`ap-south-1`). Tables: `teams`, `profiles`, `devices`, `assets`, `playlists`, `playlist_items`, `screen_groups`, `screen_group_members`, `device_sessions`, `device_playback_events`, `device_health_events`, `activity_log`, `widget_edit_logs`, `claim_attempts`. |
| Storage | Supabase Storage, **one private bucket** `workspace-media` (`public=false`), path-keyed by `team_id/...`. |
| Realtime | Supabase Realtime. **Only** `devices`, `screen_groups`, `screen_group_members` published. |
| Player API | ~35 `SECURITY DEFINER` PostgREST RPCs (anon key). Device auth = `hardware_id` + bcrypt `device_secret_hash`, **or** a 7-day session token (`device_sessions`, bcrypt-hashed). |
| Sync model | Web player subscribes to `postgres_changes` on its own `devices` row + a `broadcast` channel; 5-min randomized polling fallback; content "change" detected via a SHA-256 `current_manifest_version`. |
| Caching | Browser **Cache Storage API** (`nuexis-playlist-cache` / `nuexis-media-cache`) keyed by `https://local-media-cache/{filePath}` + in-memory blob URLs. |
| Rate limiting | Upstash Redis (`rateLimitAction` Lua script). **Bypasses (returns allow) when Redis is unreachable** for non-sensitive ops. |
| Schedulers | `pg_cron` extension present, but **`cron.jobs` is empty / relation missing** — the heartbeat→offline sweeper was dropped and never restored. |
| Players | Next.js web player (`/player`) + Kotlin Android player (`apps/android-player`). |

Row counts today: `devices=4`, `assets=14`, `device_health_events=27`, `device_sessions=27`,
`device_playback_events=0`. Everything below is extrapolated to **10k screens**.

---

## 1. Findings (ranked)

Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low/Info

### A. Security

- **🔴 A1 — Public-storage fallback defeats the private bucket.**
  `app/player/actions.ts → getSignedMediaUrl()` returns
  `${SUPABASE_URL}/storage/v1/object/public/workspace-media/{filePath}` on **every** failure path:
  rate-limit hit, unauthorized device, unauthorized path, signing error, or any exception.
  The bucket is private today, so these URLs 404 (silent media breakage on the player), but if the
  bucket is ever flipped to public — or an operator adds a public bucket alias — **all team media
  leaks unauthenticated**. The fallback is both a reliability bug and a latent mass-leak vector.

- **🔴 A2 — ~35 SECURITY DEFINER RPCs are executable by `anon`.**
  Supabase security advisor flags every player/sanitize/trigger function as anon-callable. Intended
  ones (`register_player_device`, `get_player_manifest`, …) authenticate internally — acceptable.
  But **non-intended** ones are also exposed: `check_team_exists`, `check_team_slug_available`,
  `check_profile_update`, `device_secret_matches` (accepts a full `devices` row → secret-checking
  oracle), `sanitize_*`, and **trigger functions** `on_screen_group_change`,
  `on_screen_group_member_change`, `trigger_set_device_updated_at`, `update_device_statuses`,
  `handle_device_playtime_migration`. Triggers must never be in the executable API surface.

- **🟠 A3 — No hardware/device attestation; localStorage secret = full impersonation.**
  Device identity is a client-generated `hardware_id` (fingerprint) + a server-issued 64-hex secret
  stored in `localStorage` (web) / Android keystore. No certificate pinning, no Play Integrity /
  SafetyNet / TPM attestation, no mTLS. Anyone who exfiltrates `localStorage` (XSS, shared kiosk,
  stolen device) becomes that screen indefinitely. No automatic secret rotation; revocation exists
  but is manual.

- **🟠 A4 — `get_player_device_state` unpaired lookup has no scoping.**
  `SELECT * FROM devices WHERE hardware_id=$1 ORDER BY created_at DESC LIMIT 1` returns the row even
  before pairing. Combined with short, human-typeable pairing codes and `claim_device` being
  authenticated-but-not-IP-bound, the pairing flow is the weak link. Brute-force is bounded by
  Redis today, but Redis bypass (see F3) removes that bound.

- **🟠 A5 — Service-role key used from inside the DB via the `http` extension.**
  `get_player_signed_media_url*` RPCs pull `service_role_key` from Vault and call the Storage REST
  API synchronously from Postgres. Any logic/SQL flaw in those functions, plus the broad EXECUTE
  grants, puts the service-role key within reach of an anon caller. It also couples DB worker
  latency to Storage latency.

- **🟡 A6 — No field-level protection of PII; thin audit trail.**
  `profiles.full_name` is plaintext; `activity_log` is opt-in and currently **0 rows**. Destructive
  ops (delete team, bulk delete assets, unpair) have no immutable audit. No `pgaudit` usage despite
  the extension being available.

- **🟡 A7 — No per-team storage quota; bucket `file_size_limit` is NULL.**
  A single tenant can store unbounded media (cost + abuse). No MIME allow-list enforced at the
  bucket (`allowed_mime_types` NULL).

### B. Data Model & Scalability

- **🔴 B1 — `device_playback_events` and `device_health_events` are unbounded, un-partitioned, no retention.**
  At 10k screens: health pings (≈1/min) ≈ **14.4M rows/day**; playback events per item transition
  add millions more. Single heap + btree on `(device_id, created_at desc)` → index bloat, vacuum
  stalls, seq-scans on retention deletes. `pg_partman` is installed but **unused**. There is **no
  cleanup job** (the pg_cron jobs were dropped).

- **🟠 B2 — Manifest is recomputed on every device poll, not at write time.**
  `get_player_manifest` SHA-256-hashes the entire items JSON **per call** and writes
  `current_manifest_version` back to the device row. 10k devices polling = 10k hash computations +
  10k row updates per cycle. The version should be computed once by triggers on
  `playlist_items`/`assets`/`devices` and stored, then served as a cached/CDN object.

- **🟠 B3 — Unindexed FKs & redundant policies (advisor-confirmed).**
  `playlist_items.playlist_id` FK is **unindexed** (slow cascade deletes + joins).
  `screen_groups.created_by` FK unindexed. `devices` has **3 overlapping permissive SELECT policies**
  for `anon` (`allow_anon_read_devices`, `devices_select_consolidated`, `devices_select_device`) —
  every device query evaluates all three. `screen_groups`/`screen_group_members` similarly have an
  "ALL … owners can write" policy that is permissive for SELECT too.

- **🟠 B4 — No content-side Realtime publication.**
  Only `devices`/`screen_groups`/`screen_group_members` are published. **`playlists`,
  `playlist_items`, `assets` are not.** Editing a playlist/asset does **not** push to screens; the
  web player only reacts when the `devices` row changes (assignment) or a manual `broadcast:refresh`
  fires. Replacing an asset file while keeping its row leaves screens showing stale media forever.

- **🟡 B5 — Denormalized counters updated per-device per-cycle.**
  `devices.total_playtime_seconds` and `teams.historical_playtime_seconds` are bumped by per-device
  RPCs. Fine at low scale; at 10k devices this is continuous write hot-spot on team rows during
  rollups. Should aggregate from event partitions, not mutate live rows.

- **🟡 B6 — Read skew on manifest during edits.**
  `update_playlist_atomic` is transactional (good), but the manifest RPC reads live `playlist_items`
  with no snapshot/version fence. A device polling mid-edit can get a half-applied playlist. Needs
  publish-on-commit versioning (write the new manifest version only after the txn commits).

### C. Synchronization & Offline-First

- **🔴 C1 — No real offline playback / no persistent media store.**
  Caching is **browser Cache Storage only**. No IndexedDB/SQLite/OPFS, no disk budget, no survival
  across browser data clearing or device reboot. If the player boots with no network it shows
  "Loading…"/pairing instead of playing last-known-good content. Enterprise signage **must** play
  cached content offline and only show a fallback screen if the cache is empty.

- **🔴 C2 — Manifest versioning exists but isn't used for differential sync.**
  Cache key is `filePath` only — no version/ETag. Consequences: (a) a replaced file under the same
  path is served stale (cache poison), (b) unchanged assets are re-signed/re-fetched unnecessarily
  (bandwidth waste). The player should compare `manifest_version` + per-asset hash and only fetch
  deltas, with `If-None-Match`/304 semantics.

- **🟠 C3 — Telemetry is fire-and-forget; events are dropped when offline.**
  `report_playback_event` / `report_device_health` have **no local queue and no replay**. Offline
  periods = permanent proof-of-play and health gaps → broken billing/analytics and blind ops.

- **🟠 C4 — Offline detection is broken (no sweeper).**
  `pg_cron` jobs are gone (`cron.jobs` missing). "Online" is set on heartbeat/presence; nothing
  marks devices `offline` when they stop. At 10k screens the dashboard will show stale "online"
  states indefinitely. The `update_device_statuses()` function still exists but is **never
  scheduled**.

- **🟠 C5 — Content-update delivery is at-most-once with no acknowledgment reconciliation.**
  Realtime `broadcast` is fire-and-forget; `push_acknowledged` is sent by the player but **nothing
  consumes or retries** it. There's no "command log" / outbox to guarantee a content change reaches
  every screen (proof-of-update). Polling is a 5-min fallback only.

- **🟡 C6 — No group-content reconciliation job.**
  `on_screen_group_change`/`on_screen_group_member_change` triggers push group content to members,
  but a failed trigger leaves members permanently out of sync. No periodic reconciler.

### D. Fault Tolerance & Reliability

- **🔴 D1 — Single-region, no DR plan.**
  One Supabase region (`ap-south-1`), no read replicas, no documented PITR/backups, no failover.
  A regional outage takes the **management plane** down for all 10k screens (cached content keeps
  playing, but no changes, no new pairings, no telemetry ingest).

- **🟠 D2 — Redis outage disables all rate limiting.**
  `rateLimitAction` returns `true` (allow) when Redis is unreachable for non-sensitive ops. A Redis
  blip → unbounded requests → Postgres/Storage thundering herd → cascading failure. Needs fail-closed
  posture or a local fallback limiter, plus circuit breakers.

- **🟠 D3 — Synchronous HTTP-to-Storage from inside Postgres.**
  The signed-URL RPCs call Storage REST synchronously via the `http` extension per URL. Couples DB
  uptime to Storage uptime, adds latency, and holds DB connections. The Next.js `actions.ts` path
  (JS client) is better and should be the only path; the RPC variant should be retired or async.

- **🟡 D4 — Lossy playtime accumulator.**
  `incrementPlaytime` flushes every 15 cycles (≈15 min) with 60s granularity. A crash/reboot loses
  up to 15 min/device × 10k = large analytics/billing drift. Should batch to a durable local queue.

- **🟡 D5 — No observability.**
  No Sentry/metrics/structured logs/alerting. No SLOs (e.g., "≥99% of screens show fresh content
  within 60s of publish"). Offline spikes would be invisible.

### E. Bandwidth & Storage Management

- **🟠 E1 — No media optimization pipeline.**
  Originals served as-is. No transcoding, no responsive variants, no AVIF/WebP, no thumbnails.
  10k screens pulling 4K masters = enormous egress, especially on cellular/metered links.

- **🟠 E2 — No CDN; signed URLs defeat cache.**
  Private-bucket signed URLs aren't CDN-cached by default; no `Cache-Control: immutable` policy
  observed. Every cache miss = full re-download from the origin region.

- **🟡 E3 — No dedup, no lifecycle rules.**
  Identical uploads stored twice; no orphan cleanup when assets are deleted from the DB but objects
  linger; no tiered storage.

### F. Enterprise / Missing Systems

- **🔴 F1 — No scheduling engine.**
  `content_type` allows `'Schedule'` but **there is no schedule table**. Dayparting, date/time
  ranges, recurrence, and priority overrides — the core of real signage — don't exist.

- **🟠 F2 — No proof-of-play / analytics rollups.**
  Only raw events; no aggregates, exports, or dashboards. Unusable for ad-backed or compliance
  deployments.

- **🟠 F3 — No RBAC beyond owner/member.**
  No per-screen permissions, publish/draft states, or approval workflows. No SCIM/SSO beyond
  Supabase auth defaults.

- **🟡 F4 — No OTA player update management.**
  `app_version` is a string column. No version pinning, forced-update, rollback, or staged rollout.

- **🟡 F5 — No emergency broadcast / override, no campaign/AB management, no per-tenant data
  residency.** Multi-tenancy is RLS-only on shared infra.

---

## 2. Remediation Plan (phased, no implementation here)

### Phase 0 — Stop-the-bleed (security & correctness, < 1 week)

1. **A1** Remove every `/object/public/workspace-media/...` fallback in
   `getSignedMediaUrl`. On failure, return a structured error / show a branded fallback screen —
   never a public URL. Add a CI grep test that forbids `object/public` in player code.
2. **A2** `REVOKE EXECUTE` from `anon`/`authenticated` on all non-player functions: every
   `sanitize_*`, `check_team_exists`, `check_team_slug_available`, `check_profile_update`,
   `device_secret_matches`, `resolve_device_state`, and **all trigger functions**
   (`on_screen_group_*`, `trigger_set_device_updated_at`, `update_device_statuses`,
   `handle_device_playtime_migration`). Convert trigger-only functions to `SECURITY INVOKER`.
3. **C4 / D-sweeper** Restore the offline-detection job: re-enable `pg_cron` and schedule
   `update_device_statuses()` (or a partition-aware equivalent) every 1–2 min to flip stale
   `last_seen_at` devices to `offline`.
4. **D2** Make `rateLimitAction` **fail-closed** for player write paths (or add a local in-process
   token bucket fallback). Redis-down must not mean "unlimited".

### Phase 1 — Scale & data integrity (1–4 weeks)

5. **B1** Partition `device_playback_events` and `device_health_events` by `created_at` (daily)
   using `pg_partman`; add a retention policy (e.g., keep 90 days raw, roll up older). Add the same
   for `activity_log` and `widget_edit_logs`.
6. **B3** Add missing indexes: `playlist_items(playlist_id)`, `screen_groups(created_by)`.
   Consolidate the 3 overlapping `devices` SELECT policies into one per role; remove the permissive
   "ALL" write policies on `screen_groups`/`screen_group_members` for SELECT.
7. **B2 / B6** Move manifest versioning to **write-time**: triggers on `playlist_items`, `assets`,
   and `devices` compute and store a `manifest_version` atomically inside the editing transaction;
   `get_player_manifest` becomes a cheap read (and later a cached/CDN object).
8. **B4** Publish `playlists`, `playlist_items`, `assets` to Realtime **or** (preferred for 10k
   screens) switch to a **command/outbox model** (see Phase 2) so content changes are pushed as
   explicit, durable commands rather than row-diff fan-out.
9. **B5** Stop mutating `total_playtime_seconds`/`historical_playtime_seconds` per cycle; derive
   them from aggregated event partitions via a scheduled rollup.

### Phase 2 — Offline-first & guaranteed sync (4–8 weeks)

10. **C1 / C2** Build a **persistent content store** on the player (OPFS/IndexedDB on web, SQLite
    on Android) with: manifest-version-aware differential sync, per-asset hash + 304 semantics, a
    disk budget with LRU eviction, and "play last-known-good when offline" behavior.
11. **C3 / D4** Add a **durable local telemetry queue** on the player: buffer playback/health
    events offline, flush with idempotency keys + exponential backoff. Make playtime accounting
    derive from these events, not a lossy accumulator.
12. **C5** Introduce a **device command log / outbox**: each content change creates a command row
    targeted at device (or group); the player ACKs; unacked commands are retried with backoff and
    surfaced in the dashboard ("X screens pending update"). Replaces at-most-once broadcast for
    critical updates.
13. **C6** Add a periodic **group-content reconciler** that re-resolves each member device's
    effective content and repairs drift.
14. **A3** Add device attestation + secret rotation: Play Integrity on Android, rotate session
    secrets, short-lived device tokens, and revoke-on-anomaly.

### Phase 3 — Reliability, bandwidth, DR (8–12 weeks)

15. **D1** Multi-region posture: Supabase **read replicas** in NA/EU/ASIA for player reads;
    origin in one region for writes; enable **PITR + daily logical backups** + tested restore runbook.
16. **E1 / E2** Media pipeline: generate optimized variants (WebP/AVIF, 720p/1080p/4K, posters)
    on upload via an image/video worker; serve through a **CDN** with long `Cache-Control: immutable`
    on content-addressed (hash-named) paths.
17. **E3** Storage governance: per-team quotas, MIME allow-list at the bucket, orphan-object
    reaper, content-addressed dedup, lifecycle tiering.
18. **D3** Retire the in-DB `http`-to-Storage signed-URL RPC; sign via the Next.js edge/Node path
    (or short-lived CDN tokens) only.
19. **D5** Observability: structured logs, metrics (offline rate, fresh-content lag, sync success
    %, storage egress), alerting on SLO breaches.

### Phase 4 — Enterprise feature parity (12+ weeks)

20. **F1** Scheduling engine: a `schedules` table (dayparting, recurrence, priority, timezone) and
    a resolver that produces the effective manifest per device per time window.
21. **F2** Proof-of-play analytics: rollup tables, exports, dashboards.
22. **F3** RBAC: roles/permissions per screen/group, publish/draft states, approval workflows, SSO/SCIM.
23. **F4** OTA player management: version pinning, forced update, staged rollout, rollback.
24. **F5** Emergency broadcast override, campaign/AB, per-tenant data residency options.

---

## 3. Target State (one-line each)

- **DB:** partitioned event tables + write-time manifest versions + retained/cleaned telemetry.
- **Sync:** durable command outbox with ACK + offline playback from a persistent content store.
- **Offline:** play cached content on boot; queue telemetry; differential, version-aware downloads.
- **Security:** least-privilege RPCs, attested devices, rotating tokens, no public-URL fallbacks.
- **Scale:** CDN-cached content-addressed media, read replicas, bounded rate limiting.
- **DR:** PITR + replicas + tested restore; multi-region reads.
- **Enterprise:** schedules, proof-of-play, RBAC, OTA, emergency override.

---

## 4. Open questions for the team (decide before Phase 2)

1. Is the web player a long-term first-class citizen, or should Android (and a ChromeOS/kiosk
   build) be the only "real" players? (Determines offline-store choice and attestation strategy.)
2. Required uptime/SLA target and max acceptable content-publish lag?
3. Data-residency requirements per tenant (EU/US/India)?
4. Billing model — is proof-of-play legally billable (needs immutable audit)?
5. Acceptable per-device bandwidth budget on cellular?

---

*This document is a plan only. No source files, migrations, RPCs, policies, or configuration were
modified to produce it.*
