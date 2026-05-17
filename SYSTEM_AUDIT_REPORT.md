# NuExis Digital Signage — System Audit Report

**Date:** 2026-05-17  
**Auditor Role:** Staff Architect / Security Engineer / DevOps / Code Auditor  
**Project:** NuExis-Digital-Signage-Best (`dpdabdbqhjkmxvwnukev`)  
**Region:** ap-south-1 | **Postgres:** 17.6.1 | **Framework:** Next.js 16 + Supabase  

---

## Executive Summary

NuExis is a multi-tenant digital signage platform consisting of a **Next.js 16 web dashboard**, a **Supabase backend** (Postgres + Auth + Storage + Realtime), a **web-based player**, and an **Android wrapper**. The system manages device pairing, media asset delivery, playlist orchestration, and real-time screen status tracking.

### Overall Maturity: **Early-Stage / MVP** — Not Production-Ready

The platform demonstrates solid foundational patterns (RLS on all tables, atomic device claiming, rate-limiting, hardware-identity auth for players). However, **17 critical/high-severity issues** must be resolved before any enterprise deployment.

| Category | Score | Notes |
|---|---|---|
| Security | 5/10 | Service key in server actions, public storage bucket, no CSRF, leaked-password protection off |
| Scalability | 4/10 | 6 unindexed FKs, 22 RLS policies re-evaluating auth per row, no connection pooling config |
| Code Quality | 5/10 | God components, `any` types, 899-line player, no tests |
| Reliability | 5/10 | Non-transactional playlist updates, silent error swallowing, no retry logic |
| DevOps | 3/10 | No CI/CD, no staging env, no health checks, no alerting |

---

## 1. Architecture Overview

```
+-----------------------------------------------------+
|                   CLIENTS                            |
|  +----------+  +----------+  +------------------+   |
|  | Dashboard |  | Web      |  | Android Player   |   |
|  | (Next.js) |  | Player   |  | (WebView Wrapper)|   |
|  +-----+----+  +-----+----+  +--------+---------+   |
+---------+-------------+---------------+--------------+
          |             |               |
   +------v-------------v---------------v------+
   |         Next.js Server Actions             |
   |    (Server-side, service-role key)         |
   +------+-------------+---------------+------+
          |             |               |
   +------v---+  +------v------+  +-----v-----+
   | Supabase |  | Supabase    |  | Upstash   |
   | Postgres |  | Storage     |  | Redis     |
   | + Auth   |  | (workspace  |  | (heartbeat)|
   | +Realtime|  |  -media)    |  |           |
   +----------+  +-------------+  +-----------+
```

**Tables:** teams, profiles, devices, assets, playlists, playlist_items, claim_attempts  
**Auth:** Supabase Auth (email/password) + hardware_id/secret for devices  
**Real-time:** Postgres Changes + Presence channels + 5s polling fallback  
**Storage:** Single public bucket `workspace-media` (100MB limit)  
**Cron:** 2 jobs (expired device cleanup hourly, login attempts cleanup hourly)  

---

## 2. Critical Findings (Severity: CRITICAL)

### 2.1 Service Role Key Used in Player Server Actions

**File:** `app/player/actions.ts` lines 11-22  
**Risk:** Full database bypass via `SUPABASE_SERVICE_ROLE_KEY`

```typescript
function getPlayerAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // CRITICAL
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
```

The service role key bypasses ALL RLS policies. While used server-side via Server Actions, any bug in input validation could allow arbitrary database writes. Server Actions are callable from the client as HTTP POST endpoints.

**Impact:** Full database compromise if any action has an injection path.  
**Fix:** Replace with scoped RLS policies using `x-device-secret` header or dedicated SECURITY DEFINER RPCs.

### 2.2 Screen Actions Also Use Service Role Key

**File:** `app/customer/[team_slug]/screens/actions.ts` line 17-23

Used in `claimDevice()` and rate-limit checks. The admin client is needed because the claim writes to a device with `team_id IS NULL`.

**Fix:** Create a `SECURITY DEFINER` function `claim_device(p_code, p_team_id, p_name)` that atomically validates and claims.

### 2.3 Playlist Actions Have No Auth Checks

**File:** `app/customer/[team_slug]/playlists/actions.ts`

```typescript
export async function createPlaylist(teamId: string, name: string, ...) {
  const supabase = await createClient()
  // No getUser() call! No auth verification!
  // teamId is passed directly from the CLIENT
```

`createPlaylist`, `deletePlaylist`, and `updatePlaylist` accept `teamId` directly from the client without verifying the caller's identity. RLS provides a safety net, but the server action itself does not validate ownership.

**Impact:** Potential unauthorized playlist manipulation.  
**Fix:** Add `getUser()` + `team_id` verification from JWT `app_metadata`.

### 2.4 Non-Atomic Playlist Update (Data Loss Risk)

**File:** `app/customer/[team_slug]/playlists/actions.ts` lines 65-104

```typescript
export async function updatePlaylist(...) {
  // Step 1: DELETE all existing items
  await supabase.from('playlist_items').delete().eq('playlist_id', playlistId)
  // Step 2: INSERT new items  -- If this fails, ALL items are LOST
  await supabase.from('playlist_items').insert(itemsToInsert)
  // Step 3: UPDATE playlist name
}
```

If step 2 fails after step 1, the playlist is permanently emptied. No transaction wrapping, no rollback.

**Fix:** Wrap in a SECURITY DEFINER RPC that runs all operations in a single transaction.

---

## 3. High-Severity Findings

### 3.1 Public Storage Bucket Allows Unauthenticated Access

The `workspace-media` bucket is **public: true**. Any file can be downloaded by anyone who knows the path.

- **Bucket:** workspace-media
- **Public:** TRUE (world-readable)
- **File Size Limit:** 100MB
- **Path Format:** `{team_id}/{timestamp}-{filename}`

**Fix:** Set bucket to `public: false`, use signed URLs with short TTLs.

### 3.2 22 RLS Policies Re-evaluate auth.uid() Per Row

Supabase performance advisor flagged **22 policies** calling `auth.uid()` without `(SELECT ...)` wrapper, causing per-row re-evaluation.

**Affected:** profiles, teams, devices, assets, claim_attempts, playlists, playlist_items  
**Fix:** Change `auth.uid()` to `(SELECT auth.uid())` in all policies.

### 3.3 Six Unindexed Foreign Keys

| Table | Foreign Key |
|---|---|
| devices | `devices_asset_id_fkey` |
| devices | `devices_playlist_id_fkey` |
| playlist_items | `playlist_items_asset_id_fkey` |
| playlist_items | `playlist_items_playlist_id_fkey` |
| playlists | `playlists_team_id_fkey` |
| profiles | `profiles_team_id_fkey` |

**Impact:** CASCADE deletes and JOINs do sequential scans.

### 3.4 Multiple Permissive SELECT Policies on devices

3 permissive SELECT policies for `authenticated` role on `devices` — all evaluated for every query.

**Fix:** Consolidate into a single policy with OR conditions.

### 3.5 Leaked Password Protection Disabled

HaveIBeenPwned integration is OFF. Users can use compromised passwords.  
**Remediation:** https://supabase.com/docs/guides/auth/password-security

### 3.6 Trigger References Non-Existent Column

`check_anon_heartbeat_update` references `new.scale_mode` but `devices` has no such column. Will fail at runtime.

### 3.7 Redis Fallback to Dummy Credentials

```typescript
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://dummy.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'dummy',
})
```

Missing env vars cause silent connection to non-existent Redis. Heartbeats fail silently.

---

## 4. Medium-Severity Findings

| # | Finding | Location |
|---|---|---|
| 4.1 | Player page is 899 lines (violates 600-line rule) | `app/player/page.tsx` |
| 4.2 | ScreensClient is 1,551 lines (God component) | `screens/ScreensClient.tsx` |
| 4.3 | Pervasive `any` types in props/data | PlaylistEngine, player, playlist actions |
| 4.4 | No XSS sanitization on name fields | claimDevice, updateDeviceName, updateAssetName |
| 4.5 | Auth callback trusts URL `team_slug` param for redirect | `app/auth/callback/route.ts` |
| 4.6 | `updateDeviceLastSeen` missing team scope | `screens/actions.ts` line 262 |
| 4.7 | Cron job references renamed table (`login_attempts` vs `claim_attempts`) | pg_cron job #4 |
| 4.8 | No CSRF on sign-out route | `app/auth/signout/route.ts` |

---

## 5. Low-Severity / Code Quality

| # | Finding |
|---|---|
| 5.1 | No automated tests (unit, integration, e2e) |
| 5.2 | Hardcoded `localhost:3000` in login page display |
| 5.3 | `allowedOrigins` includes `10.0.2.2:3000` (emulator) in production config |
| 5.4 | Unused indexes: `devices_hardware_id_idx` duplicates unique constraint |
| 5.5 | No React error boundary components |
| 5.6 | Service worker caches ALL documents with StaleWhileRevalidate |
| 5.7 | `window.location.reload()` used for state transitions (4 occurrences) |
| 5.8 | No pagination on assets/playlists queries |
| 5.9 | Blob URL memory leaks in PlaylistEngine |
| 5.10 | `devices.secret` stored as plaintext (should be hashed) |

---

## 6. Security Analysis

### 6.1 Authentication Matrix

| Subsystem | Auth Method | Strength |
|---|---|---|
| Dashboard | Supabase Auth JWT (cookies) | Strong |
| Player (web) | hardware_id + secret (localStorage) | Moderate |
| Android Player | EncryptedSharedPreferences (AES-256-GCM) | Strong |
| Device API | Service role key (bypasses RLS) | Overprivileged |
| Storage downloads | Public bucket, no auth | None |

### 6.2 RBAC Gap

`profiles.role` exists (default `owner`) but is **never enforced** in any server action. Any team member can delete devices, modify playlists, and upload assets.

### 6.3 Rate Limiting Coverage

- Device claiming: 5 attempts / 15 min (per user AND per code)
- Login: No rate limiting
- Server Actions: No rate limiting
- File uploads: No rate limiting or storage quotas

### 6.4 Attack Surface

| Vector | Risk | Mitigated |
|---|---|---|
| Brute-force pairing codes | Low | Yes (rate-limited + 15min expiry) |
| Storage enumeration | Medium | No (public bucket) |
| Cross-tenant data access | Low | Yes (RLS on all tables) |
| Service action parameter tampering | Medium | Partial |
| Session redirect via auth callback | Medium | No |
| DoS via file uploads | High | No |

---

## 7. Scalability Analysis

### 7.1 Capacity Estimates

| Metric | Current | Bottleneck At |
|---|---|---|
| Devices per team | 4 | ~500 (RLS re-evaluation) |
| Teams | 1 | ~100 (no connection pooling) |
| Concurrent players | ~4 | ~50 (5s polling = 10 RPS) |
| Heartbeat rate | 1/min/device | ~500 devices |

### 7.2 Key Bottlenecks

1. **5-second polling per player** — 1,000 players = 200 req/s to server actions
2. **Realtime channel per device** — 2-3 channels each, hits tier limits
3. **No connection pooling** — new Supabase client per request
4. **Full table fetches** — no cursor pagination
5. **Blob URL memory leaks** — long-running players accumulate memory

---

## 8. Database Schema Issues

| Issue | Severity |
|---|---|
| `devices.secret` stored plaintext | High |
| No `updated_at` on devices, assets | Medium |
| No soft-delete mechanism | Medium |
| `content_type` CHECK allows 'Schedule' but no schedules table | Low |
| `claim_attempts` FK still named `login_attempts_user_id_fkey` | Low |
| No composite index on `(team_id, status)` for device filtering | Medium |

---

## 9. Prioritized Action Items

### P0 — Before Any Production Use

| # | Action | Effort |
|---|---|---|
| 1 | Remove service-role key from player actions; create SECURITY DEFINER RPCs | 2-3 days |
| 2 | Add auth checks to ALL playlist actions | 2 hours |
| 3 | Wrap playlist update in a database transaction | 3 hours |
| 4 | Fix broken cron job (`login_attempts` -> `claim_attempts`) | 5 min |
| 5 | Fix trigger (remove `scale_mode` reference) | 10 min |
| 6 | Enable leaked password protection | 5 min |
| 7 | Create indexes on all 6 unindexed foreign keys | 15 min |

### P1 — Within 2 Weeks

| # | Action | Effort |
|---|---|---|
| 8 | Optimize all 22 RLS policies with `(SELECT auth.uid())` | 2 hours |
| 9 | Consolidate permissive SELECT policies on devices | 1 hour |
| 10 | Make storage bucket private + signed URLs | 1 day |
| 11 | Validate `team_slug` in auth callback | 30 min |
| 12 | Add input sanitization on name fields | 2 hours |
| 13 | Split player/page.tsx (<=600 lines) | 1 day |
| 14 | Split ScreensClient.tsx into components | 1 day |
| 15 | Replace polling with optimized Realtime | 1 day |
| 16 | Add CSRF on sign-out | 1 hour |

### P2 — Within 1 Month

| # | Action | Effort |
|---|---|---|
| 17 | Implement RBAC enforcement | 2-3 days |
| 18 | Add cursor pagination | 2 days |
| 19 | Add error boundaries | 1 day |
| 20 | Set up CI/CD pipeline | 1 day |
| 21 | Add E2E tests | 3-5 days |
| 22 | Hash devices.secret | 1 day |
| 23 | Remove dummy Redis fallback | 30 min |
| 24 | Add upload rate limiting and quotas | 1-2 days |

### P3 — Enterprise Readiness

| # | Action | Effort |
|---|---|---|
| 25 | Audit logging table | 2-3 days |
| 26 | Multi-region CDN for media | 1 week |
| 27 | Observability (structured logging, APM, alerts) | 1 week |
| 28 | Health check endpoints | 2 hours |
| 29 | Backup/restore and DR plan | 1 week |
| 30 | SSO/SAML support | 1-2 weeks |
| 31 | Content scheduling with timezone support | 1-2 weeks |
| 32 | Device grouping and bulk operations | 1 week |

---

## 10. Architecture Recommendations

### 10.1 Replace Service Key Pattern

```
CURRENT:                          RECOMMENDED:
Client -> Server Action           Client -> Server Action
       -> service_role client            -> anon client + RPC
       -> bypasses ALL RLS               -> SECURITY DEFINER function
       -> full DB access                 -> scoped to specific operation
```

### 10.2 Consolidate Device Status System

Replace triple-redundancy (Postgres status + Realtime Presence + Redis heartbeat) with Redis as single source of truth. Derive status from Redis TTL. Remove Presence channels to save connections.

### 10.3 Fix Migration Hygiene

37 migrations in 8 days with multiple fixup migrations indicates no staging environment. Set up a development branch workflow.

---

## 11. Final Verdict

| Dimension | Rating | Key Issue |
|---|---|---|
| Security | Not Ready | Service key in actions, public bucket, no RBAC |
| Scalability | Not Ready | Polling architecture, unindexed FKs, no pagination |
| Reliability | Partial | Non-atomic updates, broken cron, silent failures |
| Code Quality | Partial | God components, any types, but good patterns |
| DevOps | Not Ready | No CI/CD, no staging, no monitoring |
| Architecture | Solid Foundation | Good multi-tenant model, needs hardening |

The system has a **solid architectural foundation** with good multi-tenant isolation, RLS on every table, atomic device claiming, and encrypted Android storage. However, **execution gaps create real vulnerabilities**. The P0 items must be addressed before any production deployment.

---

*End of Audit Report*
