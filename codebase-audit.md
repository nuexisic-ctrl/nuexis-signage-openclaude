# Comprehensive Codebase Audit Report

## 1. Executive Summary
This report provides a comprehensive technical audit of the Next.js multi-tenant digital signage application. The codebase has undergone recent improvements in scaling and assets management UI, but multiple critical security, architecture, performance, and UX issues remain. This report prioritizes transforming the application into a secure, scalable, enterprise-grade, and highly polished product.

## 2. Security Findings

### 2.1 Server-Side Request Forgery (SSRF) and XSS in Remote URL Widget
*   **Root Cause:** The `mime_type === 'application/x-widget-remote-url'` validation in `app/customer/[team_slug]/asset/actions.ts` only checks if the protocol is HTTPS. The `next.config.ts` has overly permissive CSP (`frame-src *`, `unsafe-inline`, `unsafe-eval`).
*   **Potential Impact:** An attacker can insert an internal network URL or a malicious third-party URL into a remote URL widget, which will then be rendered via an iframe on connected signage displays. This can lead to SSRF or Cross-Site Scripting (XSS).
*   **Severity:** High
*   **Reproduction Steps:**
    1. Create an asset with `application/x-widget-remote-url`.
    2. Set the `newFilePath` to `https://169.254.169.254/latest/meta-data/` (AWS metadata endpoint) or a malicious site.
    3. Push the widget to a screen.
*   **Production-Ready Fix:**
    1. Implement a strict per-tenant domain allowlist for remote URL widgets.
    2. Fix the CSP in `next.config.ts` to restrict `frame-src` to the allowlist.
    3. Update `app/api/player/media-url/route.ts` and `app/customer/[team_slug]/asset/actions.ts` to validate the URL against the allowlist.

### 2.2 Missing Rate Limiting on Widget Update and Asset Deletion Actions
*   **Root Cause:** Server actions like `updateWidgetAsset`, `deleteAsset`, and `deleteAssetsBulk` in `app/customer/[team_slug]/asset/actions.ts` do not implement rate limiting.
*   **Potential Impact:** Denial of Service (DoS). An attacker can repeatedly call these actions, exhausting database connections and API limits.
*   **Severity:** High
*   **Reproduction Steps:**
    1. Intercept a legitimate `updateWidgetAsset` request.
    2. Use a tool like Burp Suite or a simple script to replay the request 1000 times a second.
*   **Production-Ready Fix:** Implement Upstash Redis rate limiting on all mutating server actions in `app/customer/[team_slug]/asset/actions.ts`, similar to the implementation in `/api/player/media-url`.

### 2.3 Broken Access Control (IDOR) on Widget Editing
*   **Root Cause:** In `updateWidgetAsset`, while there is a check `existing.team_id !== teamId`, the `fetchError` check could potentially bypass authorization if `user` isn't properly scoped. The query uses `single()`, but does not strictly limit by `teamId` in the initial `select()` clause.
*   **Potential Impact:** An authenticated user from one team might be able to edit a widget belonging to another team if they can guess the `assetId`.
*   **Severity:** Medium
*   **Reproduction Steps:**
    1. Log in as User A (Team A).
    2. Obtain the `assetId` of a widget belonging to Team B.
    3. Call the `updateWidgetAsset` server action with the target `assetId`.
*   **Production-Ready Fix:** Change the query in `updateWidgetAsset` to strictly include `.eq('team_id', teamId)` before `.single()`.

### 2.4 HTML Widget XSS Weakness
*   **Root Cause:** The `application/x-widget-html` logic uses `DOMPurify.sanitize` but allows the `style` tag. Allowing arbitrary `<style>` tags can lead to CSS-based data exfiltration or UI redressing.
*   **Potential Impact:** Cross-Site Scripting (XSS) via CSS injections.
*   **Severity:** Medium
*   **Reproduction Steps:** Create an HTML widget and inject malicious CSS payloads.
*   **Production-Ready Fix:** Remove `style` from `ALLOWED_TAGS` in `DOMPurify` configuration. Enforce strict CSS isolation.

### 2.5 Secrets/Credentials Management
*   **Root Cause:** `.env.local` containing `SUPABASE_SERVICE_ROLE_KEY` was reportedly committed to the repo previously.
*   **Potential Impact:** Complete database compromise.
*   **Severity:** Critical
*   **Reproduction Steps:** Check git history.
*   **Production-Ready Fix:** Ensure the key is rotated. Implement pre-commit hooks (like `trufflehog` or `gitleaks`) to prevent future secrets leakage. Ensure service role key is NEVER exposed to the client.

## 3. Assets Page Deep Audit

### 3.1 Unbounded Pagination and Performance Bottleneck
*   **Issue:** `fetchFolderFiles` fetches all assets without cursor-based pagination.
*   **Impact:** Slow loading times and browser memory issues for tenants with large media libraries.
*   **Recommendation:** Implement infinite scrolling or cursor-based pagination in `fetchFolderFiles` and the `AssetClient.tsx`.

### 3.2 Race Conditions in Signed URL Generation
*   **Issue:** Signed URLs are generated per-asset in a `Promise.all` block. Rapid re-renders or folder navigations can trigger concurrent signing requests.
*   **Impact:** Supabase API limit exhaustion and UI lag.
*   **Recommendation:** Batch sign URLs via a custom Supabase RPC function. Cache short-lived signed URLs locally in the browser memory using a React context or Zustand store.

### 3.3 Folder Path Management and Infinite Loops
*   **Issue:** The `CreateFolderModal` allows nested folders, but there's no visible cycle detection (e.g., preventing moving a parent folder into its child).
*   **Impact:** Circular folder references leading to infinite loops during breadcrumb rendering or data fetching.
*   **Recommendation:** Implement strict backend validation in `moveAssetsToFolder` and `updateAssetFolder` to prevent cyclical relationships using a CTE (Common Table Expression) in Supabase.

### 3.4 Missing Error Boundaries for Widgets
*   **Issue:** If a complex widget (like custom HTML or World Clock) throws a JavaScript error during rendering in `WidgetEditContainer`, it can crash the entire Asset edit page.
*   **Impact:** Broken UX.
*   **Recommendation:** Wrap widget preview components in dedicated React Error Boundaries.

### 3.5 Loading State Inconsistencies
*   **Issue:** Uploading large assets lacks granular progress reporting (just a generic loading spinner).
*   **Impact:** Users might navigate away or assume the upload failed.
*   **Recommendation:** Implement XHR/Fetch upload progress tracking and display a determinate progress bar.

## 4. UI/UX Consistency Audit

### 4.1 Inconsistent Spacing and Typography
*   **Issue:** The application mixes generic utility classes (Tailwind) with custom CSS modules (`.module.css`). Padding and margins vary between `AssetCard`, `DeviceCard`, and dashboard widgets.
*   **Impact:** Unprofessional and disjointed feel.
*   **Recommendation:** Standardize on Tailwind CSS for all layout and spacing. Remove redundant CSS modules to enforce design tokens.

### 4.2 Modal Dialog Overload
*   **Issue:** The Assets page has 14 different modal components (e.g., `PushToScreenModal`, `BulkMoveModal`, `OnlineSlideshowWidgetModal`). Many share similar layouts but duplicate code.
*   **Impact:** High maintenance cost, inconsistent overlay z-indexes, and varying transition animations.
*   **Recommendation:** Create a single, generic `Dialog` component (e.g., using Radix UI or generic Tailwind wrapper) and pass the inner content as `children`.

### 4.3 Empty States and Error States
*   **Issue:** Empty folders or search results often just show a blank table or generic text. Error toasts (using `app/components/Toast.tsx`) lack varied visual weights (info vs. critical).
*   **Impact:** Poor user feedback loop.
*   **Recommendation:** Design dedicated "Empty State" illustrations and standardized action buttons (e.g., "Upload your first asset"). Upgrade the Toast system to support different visual severities.

## 5. Design System Evaluation

### 5.1 Recommendations for a Scalable Design System
*   **Typography:** Adopt Geist font systematically with semantic tokens (`text-title-h1`, `text-body-base`, `text-label-sm`).
*   **Color System:** Define a strict semantic palette (primary, secondary, success, warning, destructive, background-default, background-muted).
*   **Component Library:** Migrate to a headless UI library like Radix UI or generic shadcn/ui to standardize primitive components (Select, Dropdown, Dialog, Checkbox, Switch).
*   **Deprecation:** Remove custom implementations like `app/customer/[team_slug]/components/CustomSelect.tsx` and replace them with standard design system components.

## 6. Architecture Review

### 6.1 Database Architecture (Technical Debt)
*   **Issue:** The application uses Supabase extensively, but the schema lacks proper indexing on foreign keys (e.g., `team_id`, `folder_id`, `playlist_id`).
*   **Impact:** Sequential scans on large tables, causing massive performance degradation as data grows.
*   **Recommendation:** Create database migrations to add B-Tree indexes to all foreign key columns.

### 6.2 Frontend State Management
*   **Issue:** The app relies heavily on React Context (`AssetBrowserContext.tsx`) and prop drilling for complex state like multi-selection and drag-and-drop.
*   **Impact:** Unnecessary re-renders of the entire Asset Grid when a single item is selected.
*   **Recommendation:** Adopt a lightweight global state manager like Zustand or Jotai to manage ephemeral UI state (selection, drag state) independently of React's render tree.

### 6.3 Over-engineered / Redundant Abstractions
*   **Issue:** `AssetTableView.tsx` and `AssetBrowserTable.tsx` appear to duplicate table logic. `WidgetModals.tsx` and `ActionModals.tsx` are monolithic files that should be dynamically imported.
*   **Impact:** Large initial bundle size.
*   **Recommendation:** Use `next/dynamic` for all heavy modals (e.g., Code Editor, specific Widget settings). Consolidate table components into a single reusable generic `DataTable` component.

## 7. Scalability Roadmap

### 7.1 Scalability Bottlenecks
*   **WebSocket/Realtime Limits:** The player's use of Supabase Realtime for `postgres_changes` on the `devices` table will hit concurrent connection limits at 10,000+ screens.
*   **Redis Usage:** The `rateLimitAction` uses Redis per request. If Redis goes down or latency spikes, the application halts.

### 7.2 Recommendations
*   **Phase 1 (Immediate):** Implement robust connection pooling (PgBouncer) via Supabase. Add fallback caching for the rate limiter.
*   **Phase 2 (Medium Term):** Move player heartbeat and presence tracking entirely out of Postgres and into Upstash Redis to reduce database write load.
*   **Phase 3 (Long Term):** Implement a global CDN (e.g., Cloudflare) to cache and serve media assets directly, removing the need to hit the Next.js server or Supabase Storage for every media request.

## 8. Performance Findings

### 8.1 Inefficient Render Cycles
*   **Issue:** The `AssetClient.tsx` uses a heavy `useEffect` to fetch assets, which is then blocked by `Promise.all` for signed URLs.
*   **Recommendation:** Move data fetching to React Server Components (RSC) where possible. Only fetch signed URLs for items currently visible in the viewport using Intersection Observer.

### 8.2 Bundle Sizes
*   **Issue:** The inclusion of `@monaco-editor/react`, `recharts`, and `isomorphic-dompurify` drastically increases the client bundle size.
*   **Recommendation:** Code-split these libraries using Next.js Dynamic Imports (`next/dynamic` with `ssr: false`).

## 9. Code Quality Findings

### 9.1 Type Safety and Error Handling
*   **Issue:** Widespread use of `any` (e.g., in `fetchFolderFilesResult.files`, generic try-catch blocks).
*   **Recommendation:** Enforce strict TypeScript typing. Use a validation library like Zod for all server action inputs.

### 9.2 Dead / Unused Code
*   **Issue:** There are multiple placeholder files or duplicate naming conventions (e.g., `app/components/FlowClockRenderer.tsx` alongside other flow widgets).
*   **Recommendation:** Conduct a systematic code purge. Remove deprecated files.

## 10. Prioritized Action Plan

### 11.1 Quick Wins (1–2 days)
1.  **Fix Critical SSRF/XSS:** Implement domain allowlist for `application/x-widget-remote-url` and tighten CSP in `next.config.ts`.
2.  **Rate Limiting:** Add Redis rate limiters to all `app/customer/[team_slug]/asset/actions.ts` mutating endpoints.
3.  **Database Indexing:** Add missing foreign key indexes via Supabase SQL editor/migrations.
4.  **Fix IDOR Vulnerability:** Correct the `select()` query in `updateWidgetAsset` to enforce `team_id` earlier in the chain.

### 11.2 Medium-Term Improvements (1–4 weeks)
1.  **Implement Pagination:** Replace all unbounded queries (`fetchFolderFiles`, playlists, screens) with cursor-based pagination.
2.  **Optimize Signed URLs:** Batch signed URL generation and implement local caching.
3.  **UI Consolidation:** Replace the 14 custom modals with a single unified Dialog component and move complex widgets to dynamic imports.
4.  **Error Boundaries:** Add React Error Boundaries around major application sections and widget previews.

### 11.3 Long-Term Improvements (1–6 months)
1.  **Design System Migration:** Transition fully to a robust Headless UI system (like Radix UI) to enforce typography, spacing, and accessibility consistency.
2.  **State Management Overhaul:** Replace heavy prop drilling and Context with Zustand for optimized re-renders.
3.  **Architecture Shift for Players:** Migrate device presence and heartbeats from PostgreSQL to Redis.
4.  **Testing Strategy:** Implement End-to-End (E2E) testing with Playwright for all critical workflows (Upload, Create Widget, Assign to Screen).
