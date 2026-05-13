# Security and Scaling Analysis Report

Based on the review of the codebase and backend schema (Supabase), I have identified several security vulnerabilities and scaling bottlenecks. Below is a list of changes you should implement and the reasoning behind each.

## 1. Security Vulnerabilities

### A. Route Guard Bypass via `user_metadata` (No Data Leak)
**Location:** `lib/supabase/middleware.ts`
**Issue:** The middleware determines a user's cross-tenant routing access by checking `user.app_metadata?.team_slug || user.user_metadata?.team_slug`. Supabase design allows users to modify their own `user_metadata` via the `supabase.auth.updateUser()` function. A malicious user could alter their `team_slug` in `user_metadata` to bypass the route guard and view another team's dashboard UI layout. However, **actual data is not leaked** because Postgres Row Level Security (RLS) on backend tables (`teams`, `assets`, `devices`) correctly filters by the `profiles.team_id` table rather than the easily tampered `user_metadata`. 
**Change:** Remove the fallback to `user_metadata`. Custom claims for routing should exclusively reside in `app_metadata` (which is secure and read-only for users), or team affiliation should be fetched securely from a `profiles`/`teams` table.

### B. Bypassing Row Level Security (RLS) with Service Role Key
**Location:** `app/customer/[team_slug]/asset/actions.ts`
**Issue:** Server actions (`insertAsset`, `getUploadUrl`, `deleteAsset`) instantiate the Supabase client using `process.env.SUPABASE_SERVICE_ROLE_KEY!`. This entirely circumvents Postgres Row Level Security (RLS), leaving data security completely dependent on application-level logic. This is an anti-pattern.
**Change:** Use the standard authenticated server client (`createClient()` from `@/lib/supabase/server`) instead. Implement robust RLS policies on the `assets` table and `workspace-media` storage bucket to enforce that a user can only insert or delete assets associated with their own `team_id`.

### C. Spoofed Heartbeats and Leaked Hardware IDs
**Location:** `app/player/actions.ts` and `public.devices` RLS policies
**Issue:** The `heartbeatDevice` endpoint uses an unauthenticated client. While an attacker cannot "guess" the UUID `deviceId`, they do not have to: the `anon_select_paired_devices` RLS policy allows `anon` access to SELECT all paired devices, leaking their `id` and `hardware_id`. An attacker can query the Supabase REST API for these IDs and use them to send spoofed heartbeats via the `anon_upsert_heartbeat` policy, falsely showing offline devices as online. *Note: An attacker cannot cause a DoS by refreshing pairing codes for already paired devices, because the `public_update_unpaired_device` RLS policy correctly prevents updates when `team_id IS NOT NULL`.*
**Change:** Remove the `anon_select_paired_devices` policy to stop leaking IDs. Implement proper device authentication: when a device is first paired, issue it a long-lived JWT or a unique cryptographic secret that it must use for subsequent requests, rather than trusting unverified inputs.

### D. Ineffective Rate Limiting for Device Claiming
**Location:** `app/customer/[team_slug]/screens/actions.ts`
**Issue:** The rate limit for `claimDevice` tracks failed attempts in the `login_attempts` table grouped by `user.id`. An attacker could bypass this by simply creating multiple free user accounts to brute-force the 6-character alphanumeric pairing codes.
**Change:** Enforce rate limiting by IP address, and/or rate limit against the specific pairing code globally to prevent distributed brute-force attacks.

---

## 2. Scaling Issues & Bottlenecks

### A. High Database Write Load on Every Heartbeat
**Location:** `app/player/actions.ts` (`heartbeatDevice`)
**Issue:** On every ping from a digital signage device, the application upserts a row directly into the primary PostgreSQL table (`device_heartbeats`). If you have thousands of devices pinging every few seconds/minutes, this will cause immense write lock contention, disk I/O, and index rebuild overhead, crippling the primary database.
**Change:** Stop writing heartbeats directly to Postgres on every ping. Instead, use an in-memory data store like Redis (using `SETEX`), or Supabase Realtime Presence, to track device connectivity status. You can then bulk-sync the final state to Postgres periodically if historical analytics are required.

### B. Redundant Database Queries in Server Actions
**Location:** Multiple files (`app/customer/[team_slug]/screens/actions.ts`, `app/customer/[team_slug]/asset/actions.ts`)
**Issue:** Almost every authenticated Server Action performs a separate database query to fetch the user's `team_id` from the `profiles` table (e.g., `supabase.from('profiles').select('team_id').eq('id', user.id).single()`). While not strictly an "N+1 query" problem (as it's only one extra query per action invocation, not one per item), it still adds unnecessary latency and read queries to the database under load.
**Change:** Inject the user's `team_id` directly into the Supabase auth JWT as a custom claim within `app_metadata` when the user signs up or changes teams. You can then retrieve it in memory via `await supabase.auth.getUser()`, completely eliminating the need for the secondary `profiles` query in every server action.
