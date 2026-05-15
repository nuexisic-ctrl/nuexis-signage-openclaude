# Security & Scalability Audit Report

## 1. Executive Summary
This report details the findings of an exhaustive security and architectural audit of the NuExis Digital Signage Next.js application and its Supabase backend. Several critical vulnerabilities and scalability bottlenecks were identified that pose immediate risks to data integrity, system availability, and performance under load.

**Critical Findings:**
- **Broken Application Logic via Overly Permissive DB Trigger:** A `SECURITY DEFINER` Postgres trigger intended to lock down anonymous edits inadvertently blocks all legitimate `authenticated` Server Actions from updating device configurations.
- **Massive Data Leak via RLS:** The `assets` table has a policy allowing the `public` role to read all asset metadata across all tenants.
- **Arbitrary File Upload:** Missing sanitization in the signed URL generation allows attackers to upload unrestricted file types and potentially execute path traversal attacks.
- **Postgres Meltdown via Heartbeats:** The architecture uses Postgres as a high-frequency time-series database for device heartbeats (`last_seen_at`), which will cause severe transaction log (WAL) bloat and DB lockups at scale.

---

## 2. Backend/Database Vulnerabilities (via MCP)

### 2.1 Public Data Leak on `assets` Table (RLS Misconfiguration)
**Severity:** CRITICAL
**Issue:** I queried the `pg_policies` table and found the `anon_select_assets` policy:
```sql
{"schemaname":"public","tablename":"assets","policyname":"anon_select_assets","roles":"{public}","cmd":"SELECT","qual":"true"}
```
This policy grants unauthenticated and cross-tenant users absolute read access to the entire `assets` table. An attacker can scrape all filenames, sizes, and bucket paths across all organizations.

### 2.2 Broken Device Updates via Overly Aggressive Trigger
**Severity:** CRITICAL (Functionality Blocker)
**Issue:** The `check_anon_heartbeat_update` trigger blocks any update to `devices` (except `total_playtime_seconds`) unless the user is the `service_role`. 
```sql
if coalesce(auth.role(), 'anon') <> 'service_role' then
  if new.name is distinct from old.name ... then
    raise exception 'Device rows can only be changed through trusted server actions';
```
**Impact:** Because the application's Next.js Server Actions (e.g., `updateDeviceAssignment`, `updateDeviceName`) use `createClient()` (which authenticates as the user, not the service role), **every attempt a customer makes to rename a screen or change its assignment will crash** with a database exception. The developer misunderstood that Next.js Server Actions using the user's token still operate under the `authenticated` database role.

### 2.3 Unvalidated Team Creation / Privilege Escalation
**Severity:** HIGH
**Issue:** The `handle_new_user` function runs as `SECURITY DEFINER` on user signup. It blindly extracts `team_slug` from `new.raw_user_meta_data` and unconditionally inserts a new team into the `teams` table, assigning the user as `owner`. An attacker can manipulate their signup payload to maliciously squat on competitor team slugs (DoS) or bypass intended onboarding flows.

### 2.4 Leaked Password Protection Disabled
**Severity:** MEDIUM
**Issue:** Supabase Advisors report that leaked password protection is currently disabled on the Auth instance.

---

## 3. Application Security Flaws

### 3.1 Unrestricted Arbitrary File Upload via Signed URLs
**Location:** `app/customer/[team_slug]/asset/actions.ts` -> `getUploadUrl`
**Severity:** HIGH
**Issue:** The endpoint generates signed upload URLs directly from user input (`fileName`) without sanitizing path traversal characters or validating the file type. 
```typescript
const path = `${teamId}/${Date.now()}-${fileName}`
const { data, error } = await supabase.storage.from('workspace-media').createSignedUploadUrl(path)
```
**Impact:** An attacker can pass `fileName = "../../../malicious.html"` or upload malware (`.exe`, `.sh`). While `insertAsset` later validates the MIME type for the DB record, the malicious file is already successfully hosted on your storage bucket.

### 3.2 Inconsistent Authorization (Fragile IDOR Defense)
**Location:** `app/customer/[team_slug]/screens/actions.ts` -> `updateDeviceAssignment` & `deleteAndUnpairDevice`
**Severity:** MEDIUM
**Issue:** While RLS currently protects against cross-tenant modifications, the Server Actions themselves fail to include `.eq('team_id', teamId)` in their update/delete queries (unlike `updateDeviceName` which correctly implements it). Relying *solely* on Postgres RLS without application-level assertions is a violation of defense-in-depth principles.

### 3.3 Metric Manipulation via Integer Overflow
**Location:** `app/player/actions.ts` -> `incrementPlaytime`
**Severity:** LOW
**Issue:** The action accepts a user-provided `seconds` integer and passes it directly to the `increment_device_playtime` RPC. An attacker can pass `seconds: 2147483647` or negative values to corrupt analytics and playtime billing metrics.

---

## 4. Scalability Bottlenecks

### 4.1 Edge Middleware Database Queries (N+1 Latency)
**Location:** `lib/supabase/middleware.ts`
**Issue:** On cache-misses, the middleware executes a Postgres query:
```typescript
const { data: profile } = await supabase.from('profiles').select('teams(slug)').eq('id', user.id).single()
```
**Impact:** Middleware runs on the Edge. Making direct Postgres connections/queries from Edge middleware dramatically increases TTFB (Time To First Byte). Database lookups should be deferred to React Server Components (Layouts/Pages) which run in the same region as the database, utilizing Next.js `cache`.

### 4.2 Postgres Meltdown via High-Frequency Heartbeats
**Location:** `updateDeviceLastSeen` (Action) & `update_device_statuses` (DB Function)
**Issue:** The application issues direct `UPDATE` statements to the `devices` table every time a screen pings its heartbeat (`last_seen_at`), and a function recalculates `online`/`offline` status based on timestamps.
**Impact:** Postgres uses MVCC (Multi-Version Concurrency Control). Every update creates a new row version. Doing this for thousands of screens every few seconds will cause catastrophic WAL (Write-Ahead Log) bloat, vacuuming failures, and table lock contention. 

---

## 5. Actionable Remediation Plan

### Fix 1: Correct Database Triggers & Policies (Run via Supabase SQL Editor)
```sql
-- 1. Remove the public data leak on assets
DROP POLICY IF EXISTS "anon_select_assets" ON public.assets;

-- 2. Fix the overly aggressive Trigger to only block 'anon', allowing 'authenticated'
CREATE OR REPLACE FUNCTION public.check_anon_heartbeat_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Only block if the user is truly anonymous (the devices)
  if coalesce(auth.role(), 'anon') = 'anon' then
    if new.id is distinct from old.id
       or new.team_id is distinct from old.team_id
       or new.name is distinct from old.name
       or new.content_type is distinct from old.content_type
       or new.asset_id is distinct from old.asset_id
       or new.scale_mode is distinct from old.scale_mode
       or new.orientation is distinct from old.orientation
    then
      raise exception 'Devices cannot modify their own configurations.';
    end if;
  end if;
  return new;
end;
$function$;

-- 3. Fix the RPC Integer Overflow vulnerability
CREATE OR REPLACE FUNCTION public.increment_device_playtime(p_device_id uuid, p_hardware_id text, p_secret text, p_seconds integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_seconds < 0 OR p_seconds > 3600 THEN
    RAISE EXCEPTION 'Invalid playtime increment';
  END IF;

  UPDATE devices
  SET total_playtime_seconds = total_playtime_seconds + p_seconds
  WHERE id = p_device_id
    AND hardware_id = p_hardware_id
    AND secret = p_secret;
END;
$function$;
```

### Fix 2: Secure Server Actions (TypeScript)
Update `app/customer/[team_slug]/asset/actions.ts` to sanitize file uploads:
```typescript
import sanitize from 'sanitize-filename'; // Add this library

export async function getUploadUrl(teamSlug: string, fileName: string): Promise<GetUploadUrlResult> {
  // ... auth checks ...
  
  // SANITIZE: Prevent path traversal
  const safeFileName = sanitize(fileName);
  // VALIDATE: Enforce strict file extensions
  if (!safeFileName.match(/\.(png|jpg|jpeg|mp4|webm|pdf)$/i)) {
    return { success: false, error: 'Invalid file type.' };
  }

  const path = `${teamId}/${Date.now()}-${safeFileName}`;
  // ... generate signed url ...
}
```

Update `app/customer/[team_slug]/screens/actions.ts` to enforce defense-in-depth:
```typescript
export async function updateDeviceAssignment(teamSlug: string, deviceId: string, data: AssignmentData) {
  // ... auth checks ...
  const { data: updated, error: updateError } = await supabase
    .from('devices')
    .update({ /* ... */ })
    .eq('id', deviceId)
    .eq('team_id', teamId) // ADDED: Explicit ownership constraint
    .select('id');
}
```

### Fix 3: Architecture Adjustments for Scalability
1. **Remove DB queries from Middleware:** Remove the `profiles` fetch from `middleware.ts`. Rely entirely on the JWT `app_metadata` to determine the `team_slug`. The team slug can be injected into the JWT during the initial login/signup flow, making edge authorization purely cryptographic and lightning-fast.
2. **Migrate Heartbeats to Redis / Upstash:** Do not update Postgres for device heartbeats. Screens should send heartbeats to a Redis cache with a TTL of 120 seconds. The frontend should query Redis to check if a screen is "Online", entirely bypassing Postgres MVCC bloat.
