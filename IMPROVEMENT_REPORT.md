# Supabase & Application Improvement Report

This report outlines security vulnerabilities, scaling issues, and general codebase improvements identified across the Supabase backend configuration and the Next.js frontend codebase.

## 1. Security Vulnerabilities

### 1.1 Supabase: `SECURITY DEFINER` Function Risks
**Issue:** The `increment_device_playtime` PostgreSQL function is marked as `SECURITY DEFINER`. 
- **Mutable Search Path:** The `search_path` parameter is not explicitly set. This is a vulnerability because a malicious user could alter the `search_path` to execute unintended code with the elevated privileges of the function's creator.
- **Public Execution:** It is currently executable by both the `anon` and `authenticated` roles via the REST API (`/rest/v1/rpc/increment_device_playtime`), meaning unauthenticated users could potentially manipulate device playtime metrics.
**Recommendation:** Add `SET search_path = ''` (or a specific secure schema) to the function definition. If it's only meant to be called server-side via Service Role, revoke `EXECUTE` privileges from `anon` and `authenticated` roles.

### 1.2 Codebase: Supabase RLS Bypass in Server Actions
**Issue:** In `app/customer/[team_slug]/screens/actions.ts`, the `createAdminClient()` (which uses the Service Role Key) is used for operations like `updateDeviceAssignment` and `deleteAndUnpairDevice`. This completely bypasses Row Level Security (RLS) policies, leaving cross-tenant boundary isolation up to manual `.eq('team_id', teamId)` checks in the application layer, which is error-prone.
**Recommendation:** Refactor these functions to use the standard authenticated client. Rely on Supabase RLS to enforce tenant isolation.

### 1.3 Codebase: Rate Limit Header Spoofing Risk
**Issue:** In `claimDevice` (`screens/actions.ts`), the client IP is extracted using `headersList.get('x-forwarded-for')`. Without strict proxy layer validation, this header can be easily spoofed to bypass the 5-attempt rate limit.
**Recommendation:** Use Next.js native `request.ip` or implement strict proxy layer verification. Alternatively, tie rate-limiting to the authenticated user ID rather than the IP address.

### 1.4 Supabase Auth: Leaked Password Protection Disabled
**Issue:** Supabase Auth is not currently checking passwords against HaveIBeenPwned.org.
**Recommendation:** Enable leaked password protection in the Supabase Auth settings to enhance account security.

---

## 2. Scaling & Performance Issues

### 2.1 Supabase: Auth RLS Initialization Plan
**Issue:** Multiple RLS policies across `profiles`, `teams`, `devices`, `assets`, and `claim_attempts` directly call `auth.uid()` or similar auth functions. This causes PostgreSQL to unnecessarily re-evaluate the function for *each row*, producing suboptimal query performance at scale.
**Recommendation:** Wrap all auth function calls in a `SELECT` statement within your RLS policies (e.g., replace `auth.uid()` with `(select auth.uid())`). This forces PostgreSQL to evaluate the function once per query rather than per row.

### 2.2 Supabase: Unindexed Foreign Keys
**Issue:** The following foreign keys lack covering indexes, which will result in slow sequential scans during `JOIN` operations or cascading deletes as the data grows:
- `devices.asset_id`
- `profiles.team_id`
**Recommendation:** Create B-tree indexes for these columns:
```sql
CREATE INDEX devices_asset_id_idx ON public.devices (asset_id);
CREATE INDEX profiles_team_id_idx ON public.profiles (team_id);
```

### 2.3 Supabase: Multiple Permissive Policies & Unused Indexes
**Issue:** 
- `devices` and `assets` tables have multiple permissive `SELECT` policies for the same roles (e.g., `authenticated`). Evaluating multiple policies slows down query execution.
- `devices_hardware_id_idx` and `devices_team_last_seen_idx` are currently unused, taking up disk space and slowing down write operations.
**Recommendation:** Consolidate redundant RLS policies into single comprehensive policies where possible. Drop the unused indexes if query analysis confirms they are not needed.

### 2.4 Codebase: Inefficient DB Polling
**Issue:** `ScreensClient.tsx` uses `setInterval` to poll the database every 120 seconds as a fallback. For users with multiple tabs open, this causes redundant and scaling database load.
**Recommendation:** Replace `setInterval` polling with `@tanstack/react-query` or `SWR`, configured to refetch only on window focus (`refetchOnWindowFocus`).

### 2.5 Codebase: Redundant Profile Fetching
**Issue:** `ScreensPage` and `AssetPage` duplicate logic to fetch user profiles and verify the `team_slug`, causing redundant database queries on every page load.
**Recommendation:** Extract this logic into a centralized layout or use React's `cache()` to memoize the profile fetch during the server-side rendering lifecycle.

---

## 3. General Codebase Improvements

### 3.1 DRY Principle Violation
**Issue:** Authentication and tenant verification logic is highly duplicated across `app/customer/[team_slug]/screens/page.tsx` and `app/customer/[team_slug]/asset/page.tsx`.
**Recommendation:** Create a reusable utility function (e.g., `lib/utils/auth.ts`) to handle server-side session and tenant validation.

### 3.2 Hardcoded Types vs. Supabase Generated Types
**Issue:** Frontend components (like `AssignModal`) use hardcoded string literals (e.g., `'Asset' | 'Playlist' | 'Schedule'`) instead of deriving them from the generated Supabase types (`Database['public']['Tables']['devices']['Row']['...']`).
**Recommendation:** Import and utilize the exact TypeScript types generated by Supabase to ensure compile-time safety and prevent drift if the database schema changes.

### 3.3 UX / Error Handling
**Issue:** 
- Missing React Error Boundaries: A crash in client components (e.g., `ScreensClient`) will unmount the entire page resulting in a blank white screen.
- Destructive actions (like deleting a device) use native `window.confirm()`, which breaks the UI aesthetic.
**Recommendation:** Implement `error.tsx` fallback boundaries and replace native confirm dialogs with custom React Modals.