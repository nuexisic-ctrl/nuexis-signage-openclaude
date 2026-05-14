# Codebase Review Tasks

This document contains a comprehensive analysis of the codebase, categorized by area of concern. Each issue includes an actionable prompt that you can copy and paste into the AI to resolve the problem.

## 1. Security Vulnerabilities

### 1.1 Supabase RLS Bypass in Screen Actions
**Issue:** `app/customer/[team_slug]/screens/actions.ts` uses `createAdminClient()` (Service Role Key) for operations like `updateDeviceAssignment` and `deleteAndUnpairDevice`. This bypasses Supabase Row Level Security (RLS) entirely, leaving cross-tenant boundary checks entirely up to application logic, which is risky.
**Prompt to fix:**
> Refactor `updateDeviceAssignment` and `deleteAndUnpairDevice` in `app/customer/[team_slug]/screens/actions.ts` to use the standard authenticated `createClient` instead of `createAdminClient`. Ensure that the operations rely on Supabase Row Level Security (RLS) to enforce tenant isolation based on the `team_id`, rather than relying solely on manual `.eq('team_id', teamId)` application checks.

### 1.2 Rate Limit Header Spoofing Risk
**Issue:** In `app/customer/[team_slug]/screens/actions.ts`, the `claimDevice` function extracts the client IP using `headersList.get('x-forwarded-for')`. In many environments, without strict proxy validation, headers can be spoofed by malicious clients to bypass the 5-attempt rate limit.
**Prompt to fix:**
> Update the rate-limiting logic in `app/customer/[team_slug]/screens/actions.ts` within `claimDevice`. Avoid directly trusting `x-forwarded-for` for rate-limiting. Refactor this to use Next.js's native `request.ip` (passed via middleware or context) or implement strict verification of the proxy layers. Alternatively, rate-limit strictly by the user's ID/token instead of IP.

---

## 2. Scaling Issues

### 2.1 Inefficient Polling Fallback
**Issue:** `ScreensClient.tsx` uses a `setInterval` loop to fetch device statuses every 120 seconds as a fallback to realtime subscriptions. This can cause unnecessary database load if a user has multiple inactive tabs open.
**Prompt to fix:**
> In `app/customer/[team_slug]/screens/ScreensClient.tsx`, replace the 120-second `setInterval` database polling fallback with `SWR` or `@tanstack/react-query`. Configure it to refetch only on window focus or network reconnection to avoid flooding the database with redundant requests from inactive background tabs.

### 2.2 Redundant Server-side Auth/Profile Fetching
**Issue:** `ScreensPage` and `AssetPage` duplicate the exact same code to fetch the user's profile and verify the `team_slug`. This triggers an additional query to the `profiles` table on every single page load.
**Prompt to fix:**
> Both `AssetPage` and `ScreensPage` independently fetch the user profile and cross-reference `userTeamSlug`. Extract this logic into a cached utility function (e.g., `getValidatedTeam(teamSlug)`) using React's `cache()` to prevent redundant database queries during server-side rendering, or move this logic to a centralized layout file.

---

## 3. Frontend & UX Issues

### 3.1 Missing Error Boundaries
**Issue:** The application lacks React Error Boundaries. If a client component like `ScreensClient` crashes (e.g., due to a failed realtime subscription or bad data), it will crash the entire page and present a blank screen.
**Prompt to fix:**
> Create an `error.tsx` file in `app/customer/[team_slug]/` to act as a React Error Boundary. It should catch unhandled errors from `ScreensPage` and `AssetPage` and display a user-friendly fallback UI with a "Try Again" button, preventing the entire application from crashing to a white screen.

### 3.2 Poor UX on Destructive Actions (Native Confirm)
**Issue:** In `ScreensClient.tsx`, deleting a device triggers a native browser `window.confirm()` dialog. This breaks the polished aesthetic of the application and provides a jarring user experience compared to the custom Modals used elsewhere.
**Prompt to fix:**
> In `app/customer/[team_slug]/screens/ScreensClient.tsx`, remove the native `window.confirm()` dialog used for deleting a screen. Implement a custom React Modal component for the deletion confirmation, matching the style and aesthetic of the existing `PairModal` and `AssignModal`.

---

## 4. Codebase Quality & Structure

### 4.1 DRY Principle Violation (Auth Logic)
**Issue:** The authentication and tenant verification logic is copy-pasted across `app/customer/[team_slug]/screens/page.tsx` and `app/customer/[team_slug]/asset/page.tsx`.
**Prompt to fix:**
> Extract the duplicated authentication, profile fetching, and team slug verification logic found in `ScreensPage` and `AssetPage` into a reusable server-side utility function in a new file (e.g., `lib/utils/auth.ts`). Update both pages to consume this single source of truth.

### 4.2 Hardcoded Magic Strings & Missing Type Synergy
**Issue:** `AssignModal` in `ScreensClient.tsx` uses hardcoded string unions for `contentType` (`'Asset' | 'Playlist' | 'Schedule'`) and `scaleMode`. These should be synced automatically with the generated Supabase types (`Database['public']['Tables']['devices']['Row']['...']`).
**Prompt to fix:**
> Refactor `app/customer/[team_slug]/screens/ScreensClient.tsx` and related action files to remove hardcoded string literal types for `content_type` and `scale_mode`. Import and use the exact types from `@/types/supabase` to ensure compile-time safety and prevent drift between the database schema and the frontend.

### 4.3 Missing Automated Tests
**Issue:** There are no automated tests (unit or integration) for critical core flows, such as asset uploads or the atomic database update mechanism in `claimDevice`.
**Prompt to fix:**
> Set up a testing framework (e.g., Vitest or Jest) and write unit tests for the core server actions in `app/customer/[team_slug]/screens/actions.ts` (specifically testing `claimDevice` rate-limiting and atomic updates) and `app/customer/[team_slug]/asset/actions.ts`. Ensure edge cases like failed uploads and invalid pairing codes are covered.