C# NuExis Playlist System — Full Audit & Implementation Plan

**Status:** Analysis & planning only. **No code, database, migration, or backend changes have been made.** This document is the sole deliverable.
**Date:** 2026-06-20
**Prepared by:** Senior Architect review of the NuExis digital-signage playlist subsystem
**Scope:** The entire playlist lifecycle — Supabase schema/RLS/functions, CMS web frontend (Next.js 16 / React 19), web player renderer, Android player (sync/caching/playback), realtime synchronization, storage, and cross-platform contracts.
**Comparison baselines:** OptiSigns, Yodeck, ScreenCloud, Rise Vision.

> This audit supersedes and integrates the earlier `docs/PLAYLIST_REDESIGN_PLAN.md` (which focused on the routing/UX redesign). That redesign is now **largely implemented** (dedicated route, workspace, undo/redo, autosave, bulk ops, push-to-screen). This document covers the *current* state of that implementation plus the wider system the redesign did not address: security hardening, cross-platform sync correctness, caching robustness, scalability, and the feature gap versus commercial signage platforms.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Playlist System Architecture](#2-current-playlist-system-architecture)
3. [Issues Found](#3-issues-found)
4. [Security Findings](#4-security-findings)
5. [Performance Findings](#5-performance-findings)
6. [Caching Analysis](#6-caching-analysis)
7. [Android Player Analysis](#7-android-player-analysis)
8. [UI/UX Issues](#8-uiux-issues)
9. [Missing Features](#9-missing-features)
10. [Recommended Improvements](#10-recommended-improvements)
11. [Priority Levels](#11-priority-levels)
12. [Detailed Implementation Roadmap](#12-detailed-implementation-roadmap)
13. [Estimated Development Phases](#13-estimated-development-phases)
14. [Appendix A — Player Sync Contract (formalization)](#appendix-a--player-sync-contract-formalization)
15. [Appendix B — Failure-Scenario Matrix](#appendix-b--failure-scenario-matrix)
16. [Appendix C — Evidence & Key Code Paths](#appendix-c--evidence--key-code-paths)

---

## 1. Executive Summary

The NuExis playlist system sits on a **surprisingly strong backend foundation**. The playlist write path uses atomic `SECURITY DEFINER` RPCs (`create_playlist_atomic`, `update_playlist_atomic`), all playlist and asset tables enforce team-scoped Row-Level Security, and a SHA-256 **manifest-version** trigger (`trg_fn_precompute_manifest_version`) gives players a single, cheap value to compare for content-change detection. The editor-trigger → device-notification → manifest-bump chain works end-to-end without any realtime subscription on the player side, which is an elegant, robust default.

The recent redesign delivered the experience layer: a dedicated `/customer/{team_slug}/playlists/{playlistId}` route, a workspace shell with in-memory undo/redo (bounded to 50 states), debounced 3-second autosave, optimistic bulk duration/delete, drag reorder, inline rename, push-to-screen, duplicate, and an in-place preview. This is a genuine step toward feature parity with commercial signage tools.

However, the audit surfaced **a coherent set of gaps** that will block enterprise adoption if left unaddressed, plus a small number of **security exposures** that should be fixed promptly regardless of roadmap:

- **Security (must-fix).** (a) The `anon` role can execute every `SECURITY DEFINER` player/mutation RPC via `/rest/v1/rpc/...` without authentication; the `create_playlist_atomic` / `update_playlist_atomic` functions carry their own `auth.uid()` + team membership checks, so they are *defended-in-depth*, but the player RPCs (`get_player_manifest`, `get_player_playlist_items`, `get_player_signed_media_url`, `report_device_health`, etc.) are now publicly callable REST endpoints. (b) `devices` has an **`anon` SELECT policy (`allow_anon_read_devices`) with `qual: true`** — every field of every device row is world-readable to anonymous callers, including `hardware_id`, `secret` hashes, `pairing_code`, `playlist_id`, and `current_manifest_version`. (c) `create_playlist_atomic` / `update_playlist_atomic` lack a fixed `search_path`, which is a Supabase security advisory (search-path injection). (d) No `updated_at` concurrency control — two owners editing the same playlist silently overwrite each other (last-write-wins).
- **Cross-platform sync correctness.** The editor broadcasts a `refresh` event on `playlist-broadcast-{id}` and the web player listens. The Android player *has* a `startPlaylistSubscription()` method and an `onPlaylistRefresh` handler, **but it is never invoked** — `startPlaylistSubscription` has zero call sites. Android instead relies on the `devices`-row Postgres Changes subscription, which works *only because* playlist-item changes trigger `notify_devices_for_playlist`, which bumps `devices.updated_at`, which flips `current_manifest_version`. This works for the direct-assignment case but is fragile: rename-only changes (the `trg_playlist_update` trigger fires only `OF name`), and several edge cases, do not reliably reach Android. This is an accident of architecture, not a designed contract.
- **Caching robustness.** The web player uses the `caches` API keyed by a stable synthetic filepath (`https://local-media-cache/{filePath}`), which correctly survives signed-URL expiry — good. Android caches by MD5(filepath)+filename with no size cap, no integrity check, and a per-file `.tmp`→rename pattern that can leave orphans on crash. There is no manifest-level integrity hash stored alongside the cached manifest, so a corrupted cache plays silently.
- **Scalability.** The list page and the asset picker still hard-cap reads at `limit(100)`. The CMS reads **all** of a team's assets into the workspace (no pagination) to feed the asset picker. The playlist detail page computes the summary (size/duration) in a JS loop rather than a SQL aggregate. None of these block today (2 playlists, 8 items, 14 assets in the live DB), but each becomes a visible problem past a few hundred rows.
- **Feature gap vs. commercial signage.** NuExis has **flat playlists only**. There is no scheduling/dayparting, no smart/dynamic playlists, no conditional or emergency-override playlists, no content expiration, no playlist templates, no nested folders for playlists, no tags, no per-item scheduling, no transitions, no playback analytics dashboard, and no version history beyond in-session undo. Every one of these is table-stakes for OptiSigns/Yodeck/ScreenCloud/Rise Vision customers.

**Net assessment:** The system is well-engineered at the data layer and has a clean, idiomatic frontend, but it is a **flat, single-tenant-per-team, no-scheduling, no-analytics** playlist tool that needs hardening + a scheduling layer to compete. The recommendations below are sequenced so that **security + sync-contract fixes ship first** (low effort, high risk reduction), followed by the **scheduling/dayparting subsystem** (the single largest competitive gap), then scale + polish.

---

## 2. Current Playlist System Architecture

### 2.1 Domain model (verified against live Supabase)

```
teams 1───* profiles
       1───* assets (self-ref folder_id)          ── assets has width/height (nullable)
       1───* playlists 1───* playlist_items *──1 assets
       1───* devices *──? playlists               ── devices.content_type ∈ {Asset,Playlist,Schedule}
       1───* screen_groups *──? playlists          ── groups can also carry a playlist
                 1───* screen_group_members *──1 devices   ── resolves via resolve_device_state()
       1───* device_sessions / device_health_events / device_playback_events / activity_log
```

Key columns (relevant to playlists), confirmed via `pg_indexes` / table introspection:

| Table | Columns relevant to playlist audit |
|---|---|
| `playlists` | `id (uuid pk)`, `team_id`, `name`, `color`, `created_at`, `updated_at`. **No** `status`, `description`, `updated_by`, `folder_id`, or `tags`. |
| `playlist_items` | `id`, `playlist_id`, `type ∈ {image,video,widget}`, `asset_id`, `widget_type`, `widget_config jsonb`, `duration_seconds (default 10)`, `sort_order (default 0)`, `created_at`. **No** `updated_at`, no per-item scheduling, no per-item transition, no per-item `valid_until`. |
| `assets` | `id`, `team_id`, `file_name`, `file_path`, `mime_type`, `size_bytes`, `folder_id` (self-ref), `color`, `width int`, `height int`. Storage lives in private bucket `workspace-media`, paths prefixed by `{team_id}/...`. |
| `devices` | `content_type`, `asset_id`, `playlist_id`, `orientation`, `scale_mode`, `current_manifest_version`, `last_seen_at`, `secret` (bcrypt-style crypt hash), `hardware_id` (unique). |
| `screen_groups` | `content_type`, `asset_id`, `playlist_id`, `orientation` — a group can carry a playlist that members inherit via `resolve_device_state`. |

### 2.2 Write path (mutation)

All playlist mutations in the CMS go through server actions in `app/customer/[team_slug]/playlists/actions.ts` and `.../[playlistId]/actions.ts`. The secure pattern (and it *is* secure) is:

1. `getAuthenticatedTeamId()` reads `team_id` from the **JWT `app_metadata`** — never from client input. ✅
2. `requireOwner(supabase, user.id)` gates every mutation to the workspace owner role. ✅
3. `rateLimitAction(user.id, ...)` (Upstash Redis) throttles each action. ✅
4. Asset IDs are validated against the DB for team ownership + non-folder mime type **before** writing. ✅
5. The actual write is a single **`SECURITY DEFINER` RPC** (`create_playlist_atomic` / `update_playlist_atomic`) so the header + items insert/update in one transaction — no ghost empty playlists, no partial updates. ✅

`update_playlist_atomic` is a **full replace**: it `DELETE`s all existing items, then re-inserts the new set in `sort_order` order, then updates the header. This is correct and atomic but means **every save rewrites every item row** even for a one-cell duration edit (the row `id`s change). That matters for the web player's "maintain currently-playing index" logic, which keys off item `id`.

### 2.3 Device-notification → manifest chain (the sync backbone)

This is the most important architectural element and it is correct:

```
CMS save (update_playlist_atomic)
   └─ AFTER change on playlist_items  →  trg_fn_on_playlist_item_change()
        └─ notify_devices_for_playlist(p_playlist_id)
             └─ UPDATE devices SET updated_at = now()
                  WHERE playlist_id = p_playlist_id
                     OR id IN (group members whose group carries this playlist)
                  └─ BEFORE UPDATE on devices  →  trg_fn_precompute_manifest_version()
                       └─ resolve_device_state(NEW)   (picks up group inheritance)
                       └─ rebuild items_json for resolved content
                       └─ NEW.current_manifest_version = sha256(
                              content_type ':' asset_id ':' playlist_id
                              ':' orientation ':' items_json)
                       └─ NEW.updated_at = now()
```

Players then compare `current_manifest_version` (via `get_player_manifest` or `get_player_device_state`) to their last-seen value and re-fetch items only on change. This gives **implicit, contract-free realtime** to any player that polls — no subscription required. The CMS additionally broadcasts a `refresh` event on `playlist-broadcast-{id}` as a **fast path for the web player** (~1s vs. next-poll).

**One subtle but important gap in the trigger:** `trg_playlist_update` fires only `AFTER UPDATE OF name` on `playlists`. Renaming a playlist does **not** recompute the manifest (correct — name isn't in the hash) but also does not bump `devices.updated_at`, so a *pure rename* reaches the web player via the broadcast (good) but reaches Android only when Android's `onDeviceUpdated` sees a `name` change on the device row — which won't happen for a playlist rename because the device row's `updated_at` is not bumped by `trg_fn_on_playlist_update`. Renames therefore do **not** propagate to Android reliably. (Low user impact — Android doesn't render the playlist name — but it illustrates the fragility.)

### 2.4 Frontend architecture (current, post-redesign)

- **List page** `app/customer/[team_slug]/playlists/page.tsx` (Server Component): `getCachedUser()` → JWT `team_id` → fetch playlists + assets with `Promise.all`, both `limit(100)`. Passes to `<PlaylistsClient>`.
- **List client** `PlaylistsClient.tsx`: client-side pagination/search, grid+table views, **click navigates** (`<Link>` / `router.push`) to the detail route. Empty states, success-pulse, color picker on create. The "Refresh" button re-queries the Supabase browser client (with an artificial 550 ms delay for animation).
- **Detail page** `.../[playlistId]/page.tsx` (Server Component): auth + team verification, UUID validation, cross-team guess → `notFound()` (no information leak). Loads header + items (with nested `assets(...)` join incl. `width`/`height`), computes summary (size + duration) **in a JS loop**, loads assigned devices + **all team assets** for the picker, server-renders `<PlaylistWorkspace>`.
- **Workspace** `PlaylistWorkspace.tsx` (`'use client'`): `useUndoRedo` hook (bounded 50-state history, `JSON.stringify` dirty diff), optimistic add/remove/reorder/duration edits, 3-second debounced autosave, explicit Save, keyboard shortcuts (Ctrl/Cmd+Z, Shift+Z, Y, S), bulk select + bulk duration/delete, asset browser, preview, push-to-screen, duplicate, delete.
- **Table** `components/PlaylistTable.tsx`: HTML5 drag-reorder, checkbox multi-select with indeterminate header, inline duration `<input type=number>`, thumbnail via signed-URL preview map (`getCachedSignedUrl`), per-row remove. **No virtualization** — renders all rows.

### 2.5 Player rendering

- **Web player** `app/player/PlaylistEngine.tsx`: subscribes to `playlist-broadcast-{id}` `refresh` → fades out 500 ms → re-fetches items → maintains currently-playing index by item `id`. Caches blobs in `caches.open('nuexis-playlist-cache')` keyed by `https://local-media-cache/{filePath}` (stable across signed-URL expiry), evicts stale entries against the active item set, dedups concurrent sign requests (`signingPromisesRef`). Renders active + preloaded-next item for crossfade. Widget branching is a long `if`-chain over `mime_type` (clock, countdown, worldclock, slideshow, countup, weather, newsticker, youtube, youtube-playlist, remote-url/website, html). 5-second safety timeout forces `isLoaded=true` if media stalls (so the playlist never freezes).
- **Android player** `apps/android-player/.../playback/PlaylistEngine.kt`: fetches items via `get_player_playlist_items` RPC, sorts by `sort_order`, persists manifest JSON to `SharedPreferences` (`setCachedManifest`) for offline, evicts stale cache files by active filepath set, plays active + preloads next, 350 ms `transitionToNext`, reports `PLAY_START`/`PLAY_COMPLETE`/`ERROR` playback events for diagnostics. Offline path: `startOffline(cachedManifest)` re-parses the JSON and plays from `CacheManager`.

### 2.6 Realtime

- **Web:** broadcast channel `playlist-broadcast-{id}` (CMS → player fast path) + the editor's own broadcast on save.
- **Android:** WebSocket to `/realtime/v1/websocket`. Subscribes to `postgres_changes` on `public:devices:id=eq.{deviceId}` (device-row updates → `onDeviceUpdated` → `syncSignageContent`), plus presence on `team-status:{teamId}`, plus `device-pair-{deviceId}` (screenshots). **Has** `joinPlaylistChannel` + `onPlaylistRefresh` but `startPlaylistSubscription` is never called (see §7.2).
- **Realtime publication (`supabase_realtime`):** includes `devices`, `screen_groups`, `screen_group_members`. **`playlist_items` and `playlists` are NOT in the realtime publication**, so Postgres Changes on those tables cannot be subscribed to today (the broadcast channel is the only path).

---

## 3. Issues Found

### 3.1 Architectural problems / technical debt

| # | Issue | Evidence | Impact |
|---|---|---|---|
| A1 | **No optimistic-concurrency / ETag on playlist updates.** `update_playlist_atomic` has no `expected_updated_at` / version check. | `update_playlist_atomic` body: `SELECT team_id ... WHERE id = p_playlist_id` then blind delete/insert/update. | Two owners editing the same playlist silently clobber each other (last-write-wins). Autosave (3 s) makes collisions more likely, not less. |
| A2 | **Full-replace update strategy** destroys item identity on every save. | `update_playlist_atomic` `DELETE FROM playlist_items WHERE playlist_id = ...` then re-insert. | The web player's "maintain playing index by item `id`" can reset to 0 mid-playback on any CMS save, because all item `id`s change. Also rewrites `created_at` on every item. |
| A3 | **Android playlist-broadcast subscription is dead code.** `startPlaylistSubscription` has no callers. | `Grep` across `apps/android-player`: only `RealtimeClient.kt` references it; `MainActivity.kt` never calls it. | Android relies on the indirect `devices`-row realtime path. Works today by accident of the trigger chain; rename-only and several edge cases don't propagate. |
| A4 | **`playlist_items` / `playlists` not in realtime publication.** | `pg_publication_tables` for `supabase_realtime` = `devices`, `screen_groups`, `screen_group_members` only. | Cannot subscribe to item-level Postgres Changes; co-editor awareness (planned in the redesign) is impossible without adding them. |
| A5 | **No formalized Player Sync Contract.** Manifest hash inputs, item JSON shape, widget mime types, cache-key scheme, and channel/event names are spread across SQL + TS + Kotlin with no version. | `trg_fn_precompute_manifest_version`, `get_player_manifest`, `PlaylistEngine.tsx`, `PlaylistEngine.kt`. | Any future change to the hash inputs silently desyncs every device. High-blast-radius, low-visibility risk. |
| A6 | **Flat playlist model with no scheduling.** `playlists` has no scheduling/dayparting/priority/status. `devices.content_type` includes `'Schedule'` in its check constraint but **no schedule table or resolution logic exists.** | `devices.content_type CHECK (... 'Schedule' ...)`; no `schedules` table; `resolve_device_state` only handles Asset/Playlist. | The "Schedule" content type is a phantom — selecting it produces no content. This is the largest functional gap vs. competitors. |
| A7 | **Summary computed in JS, not SQL.** | `page.tsx`: `for (const item of typedItems) { totalSizeBytes += ...; totalDurationSeconds += ... }`. | Fine at 8 items; O(n) per render on the server and per autosave reconciliation. Should be a single SQL aggregate or a generated column. |
| A8 | **All team assets loaded into the workspace** to feed the picker. | `page.tsx` `assets` query: `select(...).eq('team_id', teamId).order('created_at', desc)` — no limit. | Blocks at large asset libraries; the picker is not virtualized. |
| A9 | **Duplicated `getAuthenticatedTeamId`** across two actions files. | `playlists/actions.ts` and `playlists/[playlistId]/actions.ts` each define their own copy. | Drift risk; one could be hardened while the other lags. |
| A10 | **Widget rendering is duplicated** between web player and (forthcoming) preview, and is a single 750-line `if`-chain. | `app/player/PlaylistEngine.tsx`. | Adding a widget requires editing the chain in multiple places; preview/renderer divergence is a known risk (R12 in the prior plan). |

### 3.2 Workflow / correctness bugs

| # | Bug | Evidence |
|---|---|---|
| B1 | **Autosave fires on unmount/route-away race.** The 3 s `setTimeout` in `PlaylistWorkspace` is cleared on `items` change but not on unmount; navigating away within 3 s of an edit can drop the last save or fire it after the component is gone. | `useEffect(() => { ... setTimeout(handleSave, 3000) ... }, [items])` — no unmount flush. |
| B2 | **`handleSave` reads `items` from closure but the keyboard `Ctrl+S` effect omits `handleSave` from deps**, so Ctrl+S may save a stale snapshot. | `useEffect(... keyboard ... , [undo, redo])` — `handleSave` not in deps. |
| B3 | **Refresh uses an artificial 550 ms delay** purely for a progress-bar animation, slowing a deliberately user-triggered action. | `PlaylistsClient.handleRefresh`: `await new Promise(r => setTimeout(r, 550))`. |
| B4 | **List page still `limit(100)`** on both playlists and assets; refresh re-runs the same capped query from the browser client. | `PlaylistsClient.handleRefresh` + `page.tsx`. |
| B5 | **`useUndoRedo.isDirty` uses `JSON.stringify` on the full items array** on every render — O(n) stringification per keystroke. | `PlaylistWorkspace.tsx` `isDirty`. |
| B6 | **Push-to-screen only assigns direct devices, not groups**, and the editor's "assigned devices" panel only shows direct assignments. | `pushPlaylistToScreens` updates `devices`; `getPlaylistForEditor` fetches `devices ... eq('playlist_id')` — group-inherited assignments are invisible. |
| B7 | **Thumbnail generation for the table fires one signed-URL request per visual asset** in parallel with no concurrency cap. | `PlaylistTable` `useEffect` → `Promise.all(missing.map(... getCachedSignedUrl))`. |
| B8 | **`requireOwner` blocks every non-owner from editing**, but the workspace is still rendered for non-owners with no read-only mode — they can click Save and get a generic error. | `PlaylistWorkspace` ignores `userRole`. |

---

## 4. Security Findings

Findings are ordered by severity. Each includes the **evidence** (policy/function/SQL), the **exploit shape**, and the **fix** (described only — not applied).

### 4.1 Critical

#### S-1. Anonymous world-read of the entire `devices` table
**Evidence:** RLS policy `allow_anon_read_devices` on `public.devices`:
```
role: {anon}, cmd: SELECT, qual: true
```
**Impact:** Any unauthenticated caller can `GET /rest/v1/devices?select=*` and read **every device row across every team** — `hardware_id`, `secret` (the bcrypt-style hash), `pairing_code`, `team_id`, `playlist_id`, `current_manifest_version`, `last_seen_at`, `app_version`, `os_version`, `free_disk_bytes`, `last_error`. The `secret` hash being exposed permits offline cracking; `pairing_code` exposure permits device hijack during the pairing window; `hardware_id`+`team_id` exposure enables targeted RPC calls.
**Fix:** Drop the `anon` SELECT policy entirely. Device reads should be `authenticated` + team-scoped (the `allow_authenticated_read_devices` policy already does this correctly via JWT `app_metadata.team_id`). The only legitimate `anon` access is the player RPCs, which already authenticate by `hardware_id`+`secret` *inside* `SECURITY DEFINER` functions and do not need table-level SELECT.

#### S-2. Every player + playlist `SECURITY DEFINER` RPC is anonymously executable via REST
**Evidence:** Supabase security advisors (`anon_security_definer_function_executable`) flag **all** of: `create_playlist_atomic`, `update_playlist_atomic`, `get_player_manifest`, `get_player_playlist_items`, `get_player_signed_media_url`, `get_player_signed_media_url_by_session`, `report_device_health`, `ping_device`, `register_player_device`, `exchange_device_secret_for_session`, `unpair_player_device`, `update_player_device_orientation`, `increment_device_playtime`, `get_player_asset`, `get_player_asset_info`, `refresh_player_device_code`.
**Defense-in-depth status:** The player RPCs verify `hardware_id`+`secret` (or session token) internally — so direct data theft is contained *provided* S-1 is fixed (otherwise an attacker already has the `hardware_id`+`secret` hash from S-1 and can forge calls). `create_playlist_atomic` / `update_playlist_atomic` verify `auth.uid()` team membership internally, so they are defended **but** still shouldn't be callable by `anon`.
**Impact:** Without S-1 fixed, an attacker can fully impersonate any device (fetch its manifest, sign media URLs, report fake health, unpair it). With S-1 fixed, the residual risk is abuse amplification (e.g., anonymous `register_player_device` spam, anonymous `report_device_health` with a guessed `device_id`).
**Fix:** `REVOKE EXECUTE ON FUNCTION ... FROM anon, authenticated; GRANT EXECUTE ON FUNCTION ... TO anon;` only for the genuinely player-facing RPCs (they self-authenticate), and tighten the CMS-facing ones (`create_playlist_atomic`, `update_playlist_atomic`, `claim_device`) to `authenticated` only. (Supabase pattern: revoke from `PUBLIC`, grant to the intended role.)

### 4.2 High

#### S-3. `create_playlist_atomic` / `update_playlist_atomic` have mutable `search_path`
**Evidence:** Security advisor `function_search_path_mutable` for both. Function definitions show no `SET search_path` clause (unlike the player RPCs, which correctly `SET search_path TO 'public'` / `'public','extensions'`).
**Impact:** A `SECURITY DEFINER` function with a mutable search_path is vulnerable to search-path injection: a hostile schema earlier in the caller's `search_path` can shadow `playlists`/`playlist_items`/`profiles` with malicious trojan-horse relations, escalating privilege.
**Fix:** `ALTER FUNCTION ... SET search_path = public;` (or `public, extensions` if it uses `pgcrypto`-style helpers). Trivial, low-risk.

#### S-4. `update_playlist_atomic` trusts the caller-supplied `p_team_id` after a single equality check
**Evidence:**
```sql
SELECT team_id INTO v_playlist_team_id FROM playlists WHERE id = p_playlist_id;
IF v_playlist_team_id != p_team_id THEN RETURN ...'permission'... END IF;
```
The caller (the CMS server action) *does* pass the JWT-derived `teamId`, so this is safe today. But the function is `SECURITY DEFINER` and anonymously callable (S-2), so a direct REST caller can pass **any** `p_team_id`. The check rejects mismatched `p_team_id`, but it does **not** verify the *caller is a member of that team* (unlike `create_playlist_atomic`, which checks `profiles`). Combined with S-2, an authenticated user from team A could update a team-B playlist by passing team B's `p_team_id` and the playlist's UUID — *if* they can guess the UUID.
**Impact:** Cross-tenant playlist tampering given a leaked/guessed playlist UUID. UUIDs are unguessable in practice, so this is high-severity-but-low-likelihood; still, it should be closed.
**Fix:** Mirror `create_playlist_atomic`'s guard: `IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND team_id = p_team_id) THEN RAISE EXCEPTION 'Unauthorized'`. (Also fix the missing `search_path`, S-3, at the same time.)

### 4.3 Medium

#### S-5. Playlist/asset RLS uses `profiles.team_id` subqueries (correct, but slower than JWT)
**Evidence:** `playlists`/`playlist_items`/`assets` SELECT policies use `team_id IN (SELECT profiles.team_id FROM profiles WHERE id = auth.uid())`. `devices` and `screen_groups` use the JWT directly (`(auth.jwt()->'app_metadata'->>'team_id')::uuid`).
**Impact:** Not a vulnerability, but the `profiles` subquery is evaluated per-row and cannot be inlined as tightly as the JWT form. Minor perf + consistency issue.
**Fix (when touching these tables):** standardize on the JWT form where the JWT is the source of truth (it is — the CMS reads `team_id` from the JWT).

#### S-6. No `updated_at` concurrency control (architectural, manifests as a data-integrity risk)
See A1. Not a privilege issue, but concurrent edits silently overwrite. Fix with an `expected_updated_at` (or integer `version`) column checked in the RPC; throw on mismatch and let the editor show a "remote changed" banner.

#### S-7. `device_secret_matches` uses the stored hash as the salt (`crypt(p_secret, p_device.secret)`)
**Evidence:** `device_secret_matches` returns `p_secret IS NOT NULL AND p_device.secret IS NOT NULL AND p_device.secret = crypt(p_secret, p_device.secret)`. This is standard bcrypt semantics (the hash carries the salt), so it is correct. The residual risk is the **exposure** of that hash (S-1). No code change needed once S-1 is fixed; consider migrating to `argon2id` for forward hardening (low priority — bcrypt with adequate cost is acceptable).

#### S-8. Leaked-password protection disabled (Auth)
**Evidence:** Advisor `auth_leaked_password_protection` (WARN).
**Fix:** Enable HaveIBeenPwned protection in Auth settings. Not playlist-specific but affects the owner accounts that gate playlist mutations.

### 4.4 Low / informational

- **S-9.** `activity_log` is written only on `pushPlaylistToScreens`, not on create/update/delete/duplicate — so playlist mutations are not auditable. Add logging for forensic value.
- **S-10.** The web player signs media URLs via the **service-role key** (`createAdminClient()` in `getSignedMediaUrl`) after validating device+team. This is acceptable (it's the documented storage-signing path) but means the service role touches the hot playback path. Prefer the `get_player_signed_media_url` RPC (already exists, self-contained, anon-callable) so the service role is never in the player's code path.
- **S-11.** Storage bucket `workspace-media` is private ✅, with policies scoped by `(storage.foldername(name))[1] = team_id::text` ✅. Correct. The only signed-URL exposure is time-boxed (3600s default). Good.

---

## 5. Performance Findings

### 5.1 Database / query efficiency

- **Good:** the playlist tables carry sensible single-column btree indexes (`idx_playlist_items_playlist_id`, `idx_playlist_items_asset_id`, `idx_playlists_team_id`, `idx_devices_playlist_id`). The manifest precompute does a single ordered `jsonb_agg(... ORDER BY sort_order)` join — efficient.
- **Good:** `get_player_manifest` throttles its own `last_seen_at` write (`status IS DISTINCT FROM 'online' OR last_seen_at < now() - 5min`), avoiding a write per poll.
- **Issue P1 — manifest hash recomputed on every `devices.updated_at` change.** `trg_fn_precompute_manifest_version` fires whenever `OLD.updated_at IS DISTINCT FROM NEW.updated_at`. Since `notify_devices_for_playlist` and several other flows bump `updated_at`, *any* such bump triggers a full items-json re-aggregation + SHA-256 across the device's playlist. For a device with a 500-item playlist, that's a non-trivial per-update cost on the DB, multiplied by the number of assigned devices. The trigger is correct (it must recompute when content changes) but it over-fires on unrelated `updated_at` bumps (e.g., `ping_device`, scale-mode changes already covered by other clauses). **Fix:** narrow the trigger's `WHEN` clause or move the hash to a separate, content-derived column updated only by the item-change trigger path.
- **Issue P2 — CMS summary is a JS loop** (A7). Replace with `SELECT COUNT(*), COALESCE(SUM(a.size_bytes),0), COALESCE(SUM(pi.duration_seconds),0) FROM playlist_items pi LEFT JOIN assets a ... WHERE pi.playlist_id = ...` in the detail `page.tsx` (or a generated column / materialized summary).
- **Issue P3 — unused indexes (advisor-confirmed).** `idx_playlist_items_playlist_id`, `idx_playlist_items_asset_id`, `idx_playlists_team_id`, `idx_devices_playlist_id`, `idx_devices_asset_id`, `idx_devices_team_id`, and several `screen_groups` indexes are reported unused. This is almost certainly because the dataset is tiny (2 playlists, 8 items) and Postgres is choosing PK/index-only scans. **Do not drop them** — they are the correct indexes for the access patterns; they will activate at scale. Document this so nobody "cleans them up" based on the advisor.
- **Issue P4 — `notify_devices_for_playlist` is a full table scan of group memberships.** It updates devices via a subquery joining `screen_group_members` + `screen_groups`. Fine at 2 groups; index the join path (`screen_group_members(group_id)`, `screen_groups(playlist_id)` — the latter exists). The members→group→playlist fan-out is O(groups); acceptable.

### 5.2 CMS rendering

- **Issue P5 — no virtualization in `PlaylistTable`.** All item rows render. Past ~200 items the DOM cost (each row has a thumbnail `<img>`/`<video>`, a signed URL, drag handlers) becomes janky. **Fix:** window the rows (`@tanstack/react-virtual` or hand-rolled `IntersectionObserver`).
- **Issue P6 — thumbnail signed-URL fan-out.** The table generates one signed URL per visual asset on mount with `Promise.all`. `getCachedSignedUrl` dedups per-path, but a freshly opened 100-item image/video playlist fires ~100 concurrent sign requests, each hitting the service-role storage API. **Fix:** cap concurrency (e.g., p-limit 6) and/or generate a single batch.
- **Issue P7 — `isDirty` via `JSON.stringify` on every keystroke** (B5). Replace with a structural diff or a `useMemo` over a serialized form keyed on `items`.
- **Issue P8 — list page `limit(100)`** (B4). Replace with keyset pagination on `(created_at, id)`.

### 5.3 Web player

- **Good:** deduped signing, stable cache keys, preloaded next item, stale-cache eviction, blob-URL revocation on unmount, 5-s safety timeout. These are all the right calls.
- **Issue P9 — `cacheAssets` is sequential per item** (`for (const item ...) { ... await cache.match ... await fetch ... }`). On a 50-item first load this serializes 50 fetches. **Fix:** bounded- concurrency prefetch.
- **Issue P10 — `fetch(url, { mode: 'cors' })` then `cache.put`** stores the *fetched response* (good), but the response is re-read as a blob for `cacheMap` — a second full read. Use `response.clone()` once, put one clone in the cache and blob the other.
- **Issue P11 — no adaptive bitrate / no transcoded renditions.** Originals are served as-is. For 4K video on a low-end player, this is a playback + bandwidth problem. Out of scope for v1 but relevant for scale.

### 5.4 Android

- **Issue P12 — `CacheManager.downloadAsset` uses a fixed 8 KB buffer and a single OkHttpClient with no timeouts configured.** Large videos over slow links can stall indefinitely. **Fix:** configure `connectTimeout`/`readTimeout` and consider a larger buffer / `Okio` source/sink.
- **Issue P13 — `evictStaleFiles` lists the entire `mediaDir` on every playlist update.** Fine at small scale; O(files) per sync. Acceptable.
- **Issue P14 — `downloadAsset` has no integrity check** (no checksum comparison against `assets.size_bytes` or a stored hash). A truncated download (network drop mid-write) leaves a `.tmp` that is deleted on rename failure (good) but a *successful rename of a truncated response body* (server closed early with 200) would be cached and played as corrupt. **Fix:** compare `file.length()` to the asset's known `size_bytes` after download; re-fetch on mismatch.

---

## 6. Caching Analysis

### 6.1 Web player cache (correct, with caveats)

- **Strategy:** `caches.open('nuexis-playlist-cache')`, key `https://local-media-cache/{filePath}` (a synthetic, stable URL decoupled from the 3600s signed URL). In-memory `cacheMap` mirrors blobs as object URLs. This is the **right design** — it survives signed-URL expiry and is invalidated by item-set membership.
- **Invalidation:** on every item refresh, the engine computes the active key set and `cache.delete`s anything not active, and `URL.revokeObjectURL`s stale memory entries. ✅
- **Gaps:**
  - **No cache size cap.** Browsers quota-evict Cache Storage unpredictably; a large playlist can evict *other* app caches. Enterprise players should set an explicit quota policy or move to a Service Worker with a sized LRU.
  - **No offline *editing*** (by design — the prior plan scoped this out). The web player plays offline from cache; the CMS does not queue edits offline.
  - **No integrity verification** on cached blobs.
  - **The editor's preview does not yet reuse the player's cache** (the redesign called for a shared `PlaylistRenderer`; not yet factored out — `PlaylistPreview.tsx` is a separate component).

### 6.2 Android cache (functional, fragile)

- **Strategy:** files in `context.filesDir/media`, name = `md5(filePath) + "_" + basename`. `downloadAsset` skips if file exists & length > 0. Offline plays from these files + the cached manifest JSON in SharedPreferences.
- **Gaps:**
  - **No size cap / no LRU.** A device will accumulate media until disk fills (`devices.free_disk_bytes` is reported but not used to govern cache). Enterprise players must cap (e.g., 80% of `free_disk_bytes` at sync time) and LRU-evict.
  - **No integrity check** (P14).
  - **`.tmp` orphan risk:** a crash between download-complete and `renameTo` leaves a `.tmp`; `evictStaleFiles` skips `.tmp` (by design, to avoid deleting in-progress downloads), so orphaned `.tmp`s accumulate forever if a download crashes. **Fix:** periodic janitor that deletes `.tmp`s older than N minutes.
  - **Cache key collisions are effectively impossible** (MD5 of full path) but MD5 is cryptographically broken; for *cache keying* (not security) this is acceptable.
  - **No manifest integrity hash stored.** If the cached manifest JSON is corrupted (partial SharedPreferences write), `startOffline` parses it and may play a wrong/partial list. **Fix:** store the manifest's `current_manifest_version` alongside the JSON and validate length/structure before playing.

### 6.3 How it *should* work (enterprise grade)

1. **Content-addressed cache** keyed by a content hash (not filepath), so renamed/moved assets are cache hits and a hash mismatch guarantees re-download.
2. **Bounded LRU** with a configurable quota (per-device, informed by `free_disk_bytes`).
3. **Integrity verification** on every download (compare to stored size + hash).
4. **Manifest pinned to version**; offline playback refuses a manifest whose stored version is implausible.
5. **Background prefetch + delta sync** (only download items new/changed since last manifest version).
6. **Graceful degradation:** if an asset can't be downloaded, skip it and play the rest, reporting the failure (the web player does this implicitly via the 5-s safety timeout; Android surfaces it via `reportPlaybackEvent` ERROR).

NuExis currently has (1)-partial (keyed by filepath, not hash), (2)-missing, (3)-missing, (4)-missing, (5)-missing (full re-fetch on change), (6)-partial.

---

## 7. Android Player Analysis

### 7.1 What works correctly

- **Pairing → session exchange → manifest poll** lifecycle is sound; session tokens are hashed (`crypt`) and expiry-checked.
- **`resolve_device_state` group inheritance** is honored on the backend, so a device in a playlist-assigned group gets the right playlist without the player knowing about groups.
- **Offline fallback:** on sync failure with no loaded content, `startOfflinePlaybackFromCache` plays the last cached manifest; a 30 s online-check loop restores online play. ✅
- **Playback continuity:** `updatePlaylist` preserves the currently-playing item by `id` across updates. ✅
- **Diagnostics:** `PLAY_START`/`PLAY_COMPLETE`/`ERROR` events with `cache_status` (HIT/MISS) are reported. ✅
- **Single-item optimization:** no transition timers for a 1-item playlist (plays indefinitely). ✅
- **Manifest versioning** is respected end-to-end via `current_manifest_version`.

### 7.2 Issues specific to Android

| # | Issue | Detail |
|---|---|---|
| D1 | **`startPlaylistSubscription` is dead code** (A3). | The `onPlaylistRefresh` handler *is* wired in `MainActivity`, but nothing ever calls `realtimeClient.startPlaylistSubscription(playlistId)`. So the broadcast fast-path is unused; Android relies entirely on the `devices`-row realtime subscription + 30 s poll. |
| D2 | **`onDeviceUpdated` reconstructs a `DeviceState` from the realtime record but discards most fields' null-safety** in a way that can mis-trigger a reload on noise (e.g., a `last_seen_at` update). | The `changed` check excludes `last_seen_at` (good), but any field the backend writes (e.g., `status`) flips `changed`. Minor. |
| D3 | **No checksum/integrity validation** of downloaded media (P14). | A truncated 200-response body is cached and played as corrupt. |
| D4 | **No cache cap** (§6.2). | `free_disk_bytes` is reported but unused for eviction. |
| D5 | **`OkHttpClient` has no timeouts** (P12). | Stalled downloads can hang the sync coroutine. |
| D6 | **`flushPlaytime` uses `GlobalScope`** for the async path. | `GlobalScope` leaks if the process is torn down; use a supervised `CoroutineScope` tied to the sync manager. |
| D7 | **Offline manifest has no version pin** (§6.2). | Corrupted SharedPreferences JSON plays silently wrong. |
| D8 | **Widget parity gap.** The web player supports ~12 widget mime types; Android `MediaEngine.playWidget` coverage should be verified per-mime — any divergence means a playlist renders on web but not Android. | Cross-check `MediaEngine.kt` against the web `if`-chain; formalize the widget-mime contract (Appendix A). |
| D9 | **Rename-only playlist edits don't propagate** (§2.3). | Low impact (Android doesn't show playlist names) but symptomatic of the indirect-notification architecture. |

### 7.3 Untested-but-likely failure scenarios (see also Appendix B)

- **Asset deleted while in a playlist:** web player renders a broken/empty item (table should warn — it currently shows the stale `file_name` from the joined `assets` row, which will be `null` once the asset is gone, falling back to `widget_type`/`'Unknown'`). Android's `playItem` returns early if `assets == null`, leaving a blank screen for that item's `duration_seconds` — acceptable but not flagged.
- **Simultaneous edits** (A1): last-write-wins; the loser's changes vanish with no warning.
- **Realtime disconnect:** web player falls back to nothing (no poll). Android has the 30 s poll as backup. **The web player has no polling fallback** — if the WebSocket drops and the user never saves again, the player won't pick up changes made by another editor. (Low risk in practice; the player is usually a dedicated tab.)

---

## 8. UI/UX Issues

### 8.1 Inconsistencies & friction

- **U1.** The list-page **Refresh** has a 550 ms artificial delay (B3) — a deliberately user-triggered action is slowed for animation.
- **U2.** The workspace **ignores `userRole`** — non-owners see a full editor and discover they can't save only on error (B8). Should render read-only with a "View only" badge for non-owners.
- **U3.** **Push-to-screen assigns only direct devices** (B6); group-assigned devices are invisible in the "Assigned Screens" list and the push modal can't target groups. Professional tools let you push to a group.
- **U4.** **No bulk actions on the list page** (multi-select playlists for delete/duplicate/move). The *item* table has bulk ops; the *playlist* list does not.
- **U5.** **Drag-reorder has no keyboard alternative** — inaccessible to keyboard/screen-reader users. Provide up/down arrow controls.
- **U6.** **No loading skeleton inside the table** while assets are being signed/thumbnails generated — rows pop in progressively.
- **U7.** **Duration input allows 1–86400 s** but there's no quick preset (5s/10s/30s/1m) and no min/max enforcement feedback beyond silent ignore.
- **U8.** **Empty playlist item rendered as `'Unknown'`** when the asset is missing — should be a clear "Missing asset" warning row with a re-link/remove action.
- **U9.** **No "unsaved changes" navigation guard** — navigating away mid-edit with a dirty state silently drops changes (autosave may or may not have run). Add a `beforeunload` / Next route-leave guard.
- **U10.** **Color picker is playlists-only**; assets have a separate color story. Minor consistency point.

### 8.2 Accessibility

- Drag handles (`GripVertical`) are present in imports but not rendered as handles in the row — reorder is row-level draggable with no dedicated affordance or keyboard support.
- Checkboxes have `aria-label`s ✅. Duration input has `aria-label` ✅.
- Thumbnail click targets are 36×36 px — below the 44×44 px recommendation.
- No `role="application"` or ARIA live regions for the optimistic save status.

### 8.3 Mobile responsiveness

- The workspace two-column layout collapses, but the **table is not horizontally scrollable** on narrow viewports — the duration/actions columns compress badly. A card layout for <768px would help.
- The batch-action floating bar can overflow on small screens.

### 8.4 How professionals handle this

OptiSigns/Yodeck/ScreenCloud/Linear-style: persistent save-status pill, route-leave guards, keyboard-accessible sortable tables (up/down arrows), bulk operations at both list and item level, "assigned to N screens" computed status, preview-before-push in a device-frame, and full keyboard navigation. NuExis has the bones (undo/redo, autosave, bulk item ops) but needs the polish layer + the push-to-group + read-only-for-non-owners.

---

## 9. Missing Features (gap vs. OptiSigns / Yodeck / ScreenCloud / Rise Vision)

Scorecard. ✅ = present, ⚠️ = partial, ❌ = absent.

| Feature | NuExis | OptiSigns | Yodeck | ScreenCloud | Rise Vision |
|---|---|---|---|---|---|
| Flat playlist (ordered items, duration) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Drag reorder + bulk edit | ✅ | ✅ | ✅ | ✅ | ✅ |
| Undo/redo | ✅ (in-session) | ⚠️ | ⚠️ | ❌ | ❌ |
| Duplicate playlist | ✅ | ✅ | ✅ | ✅ | ✅ |
| Push to screen(s) | ⚠️ direct only | ✅ + groups | ✅ + groups | ✅ + groups | ✅ + groups |
| **Scheduling / dayparting** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Smart / dynamic playlists** (rule-based) | ❌ | ✅ | ✅ | ✅ | ⚠️ |
| **Playlist templates** | ❌ | ✅ | ✅ | ⚠️ | ⚠️ |
| **Conditional playlists** (trigger-based) | ❌ | ✅ | ⚠️ | ⚠️ | ✅ |
| **Priority / emergency override** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Per-item scheduling** | ❌ | ✅ | ✅ | ⚠️ | ⚠️ |
| **Content expiration** (valid-until) | ❌ | ✅ | ✅ | ⚠️ | ⚠️ |
| **Transitions** (fade/slide between items) | ❌ (350ms crossfade only) | ✅ | ✅ | ✅ | ✅ |
| **Playback rules** (time-of-day, recurrence) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Tags (on playlists/assets) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Nested folders for playlists | ❌ | ✅ | ✅ | ✅ | ⚠️ |
| Search (playlist name) | ⚠️ client-side only | ✅ server-side | ✅ | ✅ | ✅ |
| Version history / revisions | ❌ (undo only) | ✅ | ✅ | ⚠️ | ⚠️ |
| Preview / simulation | ⚠️ in-place | ✅ | ✅ | ✅ | ✅ |
| Analytics (impressions, playtime, proof-of-play) | ⚠️ raw events only | ✅ | ✅ | ✅ | ✅ |
| Asset filtering in picker | ❌ | ✅ | ✅ | ✅ | ✅ |
| Bulk playlist actions (list-level) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Multi-tenant roles (editor/viewer/approver) | ⚠️ owner-only | ✅ | ✅ | ✅ | ✅ |
| Proof-of-play screenshots | ⚠️ (screenshot RPC exists) | ✅ | ✅ | ✅ | ✅ |
| Approval workflows | ❌ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |

### 9.1 The critical gaps, in priority order

1. **Scheduling / dayparting** — *the* defining feature of signage. Without it, NuExis is a "loop player." The phantom `content_type='Schedule'` check constraint shows this was always intended. This is the single biggest competitive gap.
2. **Priority / emergency override** — every enterprise customer asks for "push this to all screens *now*, overriding everything, until I cancel."
3. **Smart/dynamic playlists** — auto-populate from tags/rules ("all images tagged 'breakfast', added in the last 7 days"). Massively reduces operational burden.
4. **Tags + nested folders** — organization at scale. Assets already have folders; playlists do not.
5. **Per-item scheduling + content expiration** — sub-playlist granularity (e.g., "menu item valid until Friday").
6. **Analytics dashboard** — proof-of-play reporting. The raw `device_playback_events` table exists but has **0 rows** and no UI.
7. **Approval workflows + roles** — multi-person teams need editor/approver separation. Currently binary owner/non-owner.
8. **Version history** — beyond in-session undo; store named revisions.
9. **Transitions** — configurable per-item/per-playlist transitions (currently a fixed 350ms crossfade).
10. **List-level bulk actions** + **server-side search** + **virtualized picker**.

---

## 10. Recommended Improvements

(Each is a direction with a sketch of the approach; detailed tasking is in §12.)

1. **Close the security exposures (S-1, S-2, S-3, S-4).** Drop `anon` SELECT on devices; `REVOKE EXECUTE` on player RPCs from `PUBLIC` and grant narrowly; add `search_path` to the two atomic functions; add an `auth.uid()` team-membership check to `update_playlist_atomic`. Low effort, high risk reduction.
2. **Formalize and version the Player Sync Contract** (Appendix A). Document manifest hash inputs, item JSON shape, widget mimes, cache keys, channel/event names. Bump a `contract_version` on any change. This is the guardrail against the highest-blast-radius risk (A5).
3. **Wire Android's `startPlaylistSubscription`** (D1) — call it from `loadPlaylistContent` / `onDeviceUpdated` when the resolved playlist changes, so the broadcast fast-path actually works for Android too. Make the broadcast the *common* fast-path and the manifest-version the *source of truth*.
4. **Add optimistic concurrency** (S-6/A1): `playlists.version int` or compare `updated_at`; `update_playlist_atomic` throws on mismatch; editor shows a "remote changed — reload / merge" banner.
5. **Move from full-replace to diff updates** (A2): keep stable item `id`s across edits (targeted `UPDATE`/`DELETE`/`INSERT` by `id`). Preserves web-player playback continuity and Android's index tracking, and reduces write amplification.
6. **Build the Scheduling subsystem** (A6). Introduce a `schedules` table (recurrence rules, dayparts, priority, valid-from/until), wire `devices.content_type='Schedule'` and `resolve_device_state` to resolve the highest-priority applicable schedule at `now()`, and add a calendar/schedule UI. Make emergency-override a top-priority schedule. This is the strategic feature.
7. **Compute the playlist summary in SQL** (P2) and paginate the list (P8) and the asset picker (A8) with keyset pagination + virtualization.
8. **Add tags + playlist folders + server-side search.** Reuse the existing `assets.folder_id` pattern for `playlists.folder_id`; add a `tags` table or a `text[]` column.
9. **Harden caches** (§6): content-addressed keys, LRU cap informed by `free_disk_bytes`, integrity check post-download, manifest version pinning, `.tmp` janitor, OkHttp timeouts.
10. **UX polish (§8):** read-only mode for non-owners, route-leave guard, push-to-groups, keyboard reorder, bulk list actions, missing-asset warnings, navigation guard.
11. **Analytics:** surface `device_playback_events` as a proof-of-play report per playlist/device with date range + export.
12. **Roles & approvals:** introduce `editor`/`approver` roles on `profiles`; gate publish (push) behind approval for approver-gated teams.

---

## 11. Priority Levels

| Priority | Item | Why |
|---|---|---|
| **Critical** | S-1 (anon devices read), S-2 (anon RPC exec), S-3 (search_path), S-4 (cross-tenant update) | Active security exposures; low effort to fix; leave the system in a defensible state. |
| **Critical** | A5 / Appendix A (Player Sync Contract formalization) | Prevents catastrophic silent desync; prerequisite for all cross-platform work. |
| **High** | A3/D1 (wire Android playlist subscription), A4 (add `playlist_items`/`playlists` to realtime pub) | Closes the web/Android sync gap that currently works by accident. |
| **High** | S-6/A1 + A2 (optimistic concurrency + stable item ids) | Data integrity for multi-user editing + continuous playback. |
| **High** | A6 — Scheduling/dayparting + emergency override | The largest competitive/feature gap; blocks enterprise deals. |
| **Medium** | P2 (SQL summary), P5 (virtualize table), P6 (thumb concurrency), P8 (keyset pagination), A8 (paginate assets) | Scale; becomes visible past a few hundred rows. |
| **Medium** | §6 cache hardening (LRU cap, integrity, timeouts, janitor) | Offline reliability for Android at scale. |
| **Medium** | §8 UX (read-only mode, route guard, push-to-groups, keyboard reorder, bulk list ops, missing-asset warning) | Professional polish; improves trust. |
| **Medium** | Tags + playlist folders + server-side search | Organization at scale. |
| **Low** | Analytics dashboard, transitions, version history, roles/approvals, smart playlists, templates | Differentiators; ship after scheduling + scale. |
| **Low** | P3 unused-index documentation (do *not* drop), B3 (remove 550ms delay), B5 (`isDirty` perf), B7 (thumb concurrency) | Cleanups. |

---

## 12. Detailed Implementation Roadmap

> All work below is **planned, not executed**. Each item lists the files/SQL it would touch (for sizing), the approach, and the verification criteria. Schema changes are described as migrations-to-be-written; nothing is applied.

### Phase 0 — Security & Contract Hardening (Critical, ~3–5 days)

**0.1 Tighten device RLS (S-1).**
- Drop policy `allow_anon_read_devices` on `devices`.
- Migration: `DROP POLICY allow_anon_read_devices ON public.devices;`
- Verify: anon `GET /rest/v1/devices` returns empty/error; authenticated team-scoped reads still work; player RPCs (which are SECURITY DEFINER and self-authenticate) still work.

**0.2 Restrict RPC execution (S-2).**
- For each player-facing SECURITY DEFINER RPC: `REVOKE EXECUTE ON FUNCTION ...(...) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION ...(...) TO anon;` (they self-authenticate by hardware_id+secret/session).
- For CMS-facing RPCs (`create_playlist_atomic`, `update_playlist_atomic`, `claim_device`, `check_team_*`): grant to `authenticated` only.
- Verify: direct REST calls without a session fail; player flows unaffected.

**0.3 Fix search_path (S-3).**
- `ALTER FUNCTION create_playlist_atomic(...) SET search_path = public;`
- `ALTER FUNCTION update_playlist_atomic(...) SET search_path = public;`
- Re-run security advisor; confirm both lints cleared.

**0.4 Harden `update_playlist_atomic` (S-4).**
- Add: `IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND team_id = p_team_id) THEN RAISE EXCEPTION 'Unauthorized'; END IF;`
- Verify: cross-tenant update attempt throws.

**0.5 Formalize Player Sync Contract (Appendix A).**
- Create `docs/PLAYER_CONTRACT.md` (this repo, docs only) capturing hash inputs, item JSON shape, widget mimes, cache-key scheme, channel/event names, and a `contract_version` constant. This is a *documentation* deliverable only.

### Phase 1 — Sync Correctness (High, ~3–5 days)

**1.1 Wire Android playlist subscription (D1/A3).**
- In `ContentSyncManager.loadPlaylistContent` (or `MainActivity.onDeviceUpdated` when `playlist_id` resolves), call `realtimeClient?.startPlaylistSubscription(playlistId)`.
- On `onPlaylistRefresh`, the existing handler already calls `loadPlaylistContent`. Verify end-to-end: editor save → broadcast → Android reloads within ~1s.

**1.2 Add `playlist_items` + `playlists` to realtime publication (A4).**
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.playlist_items, public.playlists;`
- Enables future co-editor Postgres-Changes subscriptions. Verify publication membership.

**1.3 Narrow the manifest trigger (P1).**
- Audit `trg_fn_precompute_manifest_version`'s firing conditions; ensure it does not recompute on purely cosmetic `devices` writes. (Approach only; verify via `EXPLAIN` of a representative update.)

### Phase 2 — Data Integrity & Write Path (High, ~4–6 days)

**2.1 Optimistic concurrency (S-6/A1).**
- Migration: `ALTER TABLE playlists ADD COLUMN version int NOT NULL DEFAULT 0;`
- `update_playlist_atomic(p_playlist_id, p_name, p_team_id, p_items, p_color, p_expected_version)` — `WHERE id = p_playlist_id AND version = p_expected_version`; on success `version = version + 1`.
- Editor: track `lastPersistedVersion`; on `version mismatch` error, show "Another editor changed this playlist — reload / discard" banner.

**2.2 Stable item identity (A2).**
- Rewrite `update_playlist_atomic` to diff by `id`: keep existing rows whose `id` is in the new set (UPDATE changed fields), DELETE missing `id`s, INSERT new ones, and renumber `sort_order`. Preserve `created_at`.
- Verify: web player's "maintain playing index" survives a save; Android's index continuity holds.

**2.3 Audit logging (S-9).**
- Insert `activity_log` rows on create/update/delete/duplicate/push.

### Phase 3 — Scheduling & Dayparting (High/Strategic, ~3–4 weeks)

This is the largest workstream and the biggest competitive unlock. Sketch:

**3.1 Schema (migration, not applied).**
```
schedules (
  id uuid pk, team_id uuid, name text,
  playlist_id uuid null, asset_id uuid null,   -- what to play
  priority int default 0,                       -- higher wins at now()
  valid_from timestamptz null, valid_until timestamptz null,
  recurrence text null,                         -- RFC-5545 RRULE or compact daypart spec
  is_emergency bool default false,
  created_by uuid, created_at, updated_at, version int
)
device_schedules (device_id uuid, schedule_id uuid, team_id uuid)  -- direct assignment
-- group scheduling reuses screen_groups by adding schedule_id, or a group_schedules table
```
- Extend `devices.content_type`/`screen_groups.content_type` resolution: when `content_type='Schedule'`, `resolve_device_state` picks the highest-priority schedule whose `valid_from/until` + `recurrence` matches `now()` for that device (direct or via group), and returns its resolved `playlist_id`/`asset_id`.
- The manifest hash inputs extend to include the resolved schedule id (contract bump → Phase 0.5).

**3.2 Backend resolution.**
- A `resolve_scheduled_content(p_device, p_now)` helper used by `resolve_device_state` and `get_player_manifest`. Emergency schedules (`is_emergency`) always win.

**3.3 CMS UI.**
- A Schedule builder: calendar grid, recurrence picker, priority, valid window, emergency toggle. Assign to devices/groups.

**3.4 Per-item scheduling & content expiration.**
- `playlist_items.valid_from`, `playlist_items.valid_until` (nullable); manifest excludes items outside the window at compute time.

### Phase 4 — Scale & Caching (Medium, ~2 weeks)

**4.1 SQL summary (P2).** Single aggregate query in `page.tsx` / `getPlaylistForEditor`.
**4.2 Keyset pagination (P8, A8).** List page + asset picker; virtualize the picker (`@tanstack/react-virtual` or hand-rolled).
**4.3 Virtualize `PlaylistTable` (P5).** Window rows >50.
**4.4 Thumbnail concurrency cap (P6/P7).**
**4.5 Cache hardening (§6):** LRU cap on web + Android, integrity check, OkHttp timeouts, `.tmp` janitor, manifest version pin.
**4.6 Web player prefetch concurrency (P9/P10).**

### Phase 5 — Organization & Search (Medium, ~1–2 weeks)

**5.1 Playlist folders** (`playlists.folder_id` self-ref, mirroring `assets`).
**5.2 Tags** (`tags` table + `playlist_tags`/`asset_tags` join, or `text[]` columns).
**5.3 Server-side search** across name + tags + folder.

### Phase 6 — UX Polish (Medium, ~1–2 weeks)

Read-only mode for non-owners; route-leave unsaved-changes guard; push-to-groups; keyboard-accessible reorder (up/down arrows); bulk list-page actions; missing-asset warning rows; preset durations; mobile card layout; a11y pass (44×44 targets, ARIA live regions).

### Phase 7 — Differentiators (Low, ongoing)

**7.1 Analytics dashboard** over `device_playback_events` (proof-of-play, impressions, date range, CSV export).
**7.2 Version history** (`playlist_revisions` table; named/automatic snapshots).
**7.3 Smart/dynamic playlists** (rule engine populating membership from tags/age/type).
**7.4 Playlist templates** (starter structures).
**7.5 Transitions** (per-item/per-playlist transition type + duration).
**7.6 Roles & approvals** (`editor`/`approver` profiles; publish gating).

---

## 13. Estimated Development Phases

| Phase | Effort | Dependency | Risk |
|---|---|---|---|
| **0 — Security & Contract** | 3–5 days | none | Low — additive tightening; reversions trivial. |
| **1 — Sync Correctness** | 3–5 days | 0 | Low — small, well-localized changes; existing tests + manual device check. |
| **2 — Data Integrity & Write Path** | 4–6 days | 1 | Medium — rewrites the core write RPC; needs careful migration + rollback plan + item-id continuity tests. |
| **3 — Scheduling & Dayparting** | 3–4 weeks | 2 | High — new subsystem; touches resolution, manifest contract, UI. Highest strategic value. Decompose into 3a (schema+resolution), 3b (UI), 3c (per-item + emergency). |
| **4 — Scale & Caching** | ~2 weeks | 2 | Medium — virtualization + pagination are well-trodden; cache hardening needs device QA. |
| **5 — Organization & Search** | 1–2 weeks | 4 | Low. |
| **6 — UX Polish** | 1–2 weeks | 2 | Low. |
| **7 — Differentiators** | ongoing | 3, 5 | Medium — analytics and smart playlists are open-ended. |

**Milestone recommendation:** Ship Phases 0–2 as a single "Hardening" release (security + sync + integrity). Then Phase 3 as the flagship "Scheduling" release. Phases 4–6 as a "Scale & Polish" release. Phase 7 incrementally.

---

## Appendix A — Player Sync Contract (formalization)

*To be authored as `docs/PLAYER_CONTRACT.md` (documentation only). Captured here so it is part of the audit record.*

- **`contract_version`**: `1` (bump on any change below).
- **Manifest version** = `lower(hex(sha256( content_type || ':' || asset_id || ':' || playlist_id || ':' || coalesce(orientation,'0') || ':' || items_json )))`, computed by `trg_fn_precompute_manifest_version`. Players MUST compare this value and re-fetch only on change.
  - *Proposed v2 extension:* prefix with the resolved `schedule_id` when scheduling lands.
- **Player item JSON** (from `get_player_manifest` / `get_player_playlist_items`): `{id, type∈{image,video,widget}, asset_id, duration_seconds, sort_order, asset?:{id,file_name,file_path,mime_type,size_bytes}}`. `get_player_playlist_items` additionally returns `widget_type`, `widget_config`, `playlist_id`, and nests as `assets` (singular `file_path`/`mime_type`). **Do not change without a contract bump.**
- **Widget mime types** (web + Android must both render): `application/x-widget-{html, remote-url, website, youtube, youtube-playlist, qrcode, flow, countdown, countup, worldclock, slideshow, weather, newsticker}`. New mimes MUST be added to both renderers simultaneously and gated with a graceful "unsupported" fallback.
- **Realtime:** broadcast channel `playlist-broadcast-{playlist_id}`, event `refresh`, payload `{timestamp}`. Web player listens; Android SHOULD listen (Phase 1.1). Postgres Changes on `devices` (id-scoped) is the Android backstop.
- **Cache keys:** web `caches.open('nuexis-playlist-cache')` key `https://local-media-cache/{filePath}`; Android `filesDir/media/{md5(filePath)}_{basename}`. Both MUST be stable across signed-URL expiry.
- **Signed URLs:** 3600s default; players MUST key blobs by filepath, never by signed URL.

---

## Appendix B — Failure-Scenario Matrix

| Scenario | Current behavior | Required improvement |
|---|---|---|
| **Lost internet (player)** | Web: keeps playing cached items; no poll fallback. Android: `startOfflinePlaybackFromCache` + 30s online-check loop. | Web player: add a lightweight poll fallback (or rely on reconnect re-broadcast). Android: integrity-check the cached manifest. |
| **Lost internet (CMS editor)** | Edits fail; autosave errors silently swallowed; no offline queue. | Show "offline — can't save" banner; disable Save; optional action queue. |
| **Deleted asset in a playlist** | Web table shows `'Unknown'`; player renders empty item for its duration. | Mark item "Missing asset" in the table; offer relink/remove; player should skip-with-log. |
| **Corrupted media (truncated download)** | Android caches and plays corrupt file. | Post-download size/hash check (P14); re-fetch on mismatch. |
| **Empty playlist** | Web/Android show "Playlist is empty" / blank. ✅ | Add a dashboard-level "N playlists are empty" signal. |
| **Missing downloads (cache miss at play time)** | Web fetches on demand with 5s safety timeout; Android fetches synchronously. | Prefetch all items after manifest change (bounded concurrency); report misses. |
| **Simultaneous edits (multi-user)** | Last-write-wins; loser's changes vanish. | Optimistic concurrency (Phase 2.1) + co-editor banner. |
| **Large playlist (1k+ items)** | Table jank; summary O(n); manifest hash O(n) per device bump. | Virtualize (P5); SQL summary (P2); narrow trigger (P1). |
| **Slow device** | 5s safety timeout (web) forces advance; Android no such guard. | Android: add a max-wait guard before advancing. |
| **Expired signed URLs** | Web keys by filepath (stable) ✅; Android re-signs on demand ✅. | Keep discipline; never persist signed URLs as cache keys. |
| **Realtime disconnect** | Web: no fallback. Android: 30s poll. | Web: periodic manifest-version poll on disconnect; Android already resilient. |
| **Rename-only playlist edit** | Reaches web via broadcast; does NOT reliably reach Android. | Ensure `notify_devices_for_playlist`-equivalent on rename (or accept that name isn't player-relevant). |

---

## Appendix C — Evidence & Key Code Paths

| Concern | Path / artifact |
|---|---|
| List page (server) | `app/customer/[team_slug]/playlists/page.tsx` |
| List page (client) | `app/customer/[team_slug]/playlists/PlaylistsClient.tsx` |
| List actions | `app/customer/[team_slug]/playlists/actions.ts` |
| Detail page (server) | `app/customer/[team_slug]/playlists/[playlistId]/page.tsx` |
| Workspace (client) | `app/customer/[team_slug]/playlists/[playlistId]/PlaylistWorkspace.tsx` |
| Detail actions | `app/customer/[team_slug]/playlists/[playlistId]/actions.ts` |
| Item table | `app/customer/[team_slug]/playlists/[playlistId]/components/PlaylistTable.tsx` |
| Web player | `app/player/PlaylistEngine.tsx`, `app/player/actions.ts` |
| Media URL cache | `lib/supabase/mediaCache.ts` |
| Android sync | `apps/android-player/.../ContentSyncManager.kt` |
| Android playback | `apps/android-player/.../playback/PlaylistEngine.kt`, `.../playback/CacheManager.kt`, `.../playback/MediaEngine.kt` |
| Android realtime | `apps/android-player/.../realtime/RealtimeClient.kt` (dead `startPlaylistSubscription` at line 187) |
| Android storage | `apps/android-player/.../data/StorageManager.kt` |
| Backend RPCs | `create_playlist_atomic`, `update_playlist_atomic`, `get_player_manifest`, `get_player_playlist_items`, `get_player_device_state`, `get_player_signed_media_url`, `resolve_device_state`, `notify_devices_for_playlist`, `trg_fn_precompute_manifest_version`, `trg_fn_on_playlist_item_change`, `device_secret_matches`, `validate_device_session` |
| Realtime publication | `supabase_realtime` = {`devices`, `screen_groups`, `screen_group_members`} (no `playlists`/`playlist_items`) |
| Storage | private bucket `workspace-media`, paths `{team_id}/...`, team-scoped policies ✅ |

### Confirmed security findings (advisor-sourced)

- `anon` SELECT on `devices` with `qual: true` (policy `allow_anon_read_devices`) — **Critical (S-1)**.
- 16 `SECURITY DEFINER` functions anon-executable (advisor `anon_security_definer_function_executable`) — **Critical (S-2)**.
- `function_search_path_mutable` on `create_playlist_atomic` + `update_playlist_atomic` — **High (S-3)**.
- `update_playlist_atomic` lacks `auth.uid()` team-membership check (unlike `create_playlist_atomic`) — **High (S-4)**.
- `auth_leaked_password_protection` disabled — **Medium (S-8)**.

---

*End of audit. No code, database, migration, or backend changes have been made. This document, together with the supporting evidence above, is the sole deliverable.*
