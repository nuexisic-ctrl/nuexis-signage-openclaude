# App Responsive Design & Popup/Modal System — Implementation Plan

**Status:** Planning (analysis only — no code changes yet)
**Date:** 2026-06-21
**Author:** NuExis Engineering
**Scope:** Make every customer-facing page fully responsive (mobile-first), convert in-page flows to popup/modal-driven interactions where appropriate, and improve the overall UI consistency across the app.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Core Problems Identified](#2-core-problems-identified)
3. [Design Principles & Breakpoint Strategy](#3-design-principles--breakpoint-strategy)
4. [Shared Layout & Shell Fixes](#4-shared-layout--shell-fixes)
5. [Unified Popup / Modal System](#5-unified-popup--modal-system)
6. [Page-by-Page Responsive Plan](#6-page-by-page-responsive-plan)
7. [Mobile UX Improvements](#7-mobile-ux-improvements)
8. [Visual & UI Consistency Improvements](#8-visual--ui-consistency-improvements)
9. [Accessibility Improvements](#9-accessibility-improvements)
10. [Testing & QA Strategy](#10-testing--qa-strategy)
11. [Phased Implementation Roadmap](#11-phased-implementation-roadmap)
12. [File Inventory (what changes)](#12-file-inventory-what-changes)

---

## 1. Current State Analysis

### 1.1 Architecture overview

The app is a **Next.js 15 (App Router)** multi-tenant digital signage platform. The customer experience lives under `app/customer/[team_slug]/` with a shared shell:

```
layout.tsx          → Server Component. Reads sidebar-collapsed cookie, renders <Sidebar> + <main> + <HeaderWrapper>.
components/Sidebar  → Fixed left sidebar (desktop) + bottom nav (mobile ≤768px).
components/Header   → Sticky top bar with search, theme, profile dropdown.
layout.module.css   → Defines .main { margin-left: 260px } shell.
```

**Pages (all under `app/customer/[team_slug]/`):**
- `dashboard/` — KPI cards, widgets grid (12-col → 6-col → 1-col), filters bar, tables.
- `screens/` — Grid + table views, controls bar, filter sidebar, bulk action bar.
- `assets/` — Folder tree + file grid/table, upload panel, filter sidebar.
- `playlists/` — List page (grid/table) + `[playlistId]/` detail workspace (editor table + info panel).
- `groups/` — Screen groups management.
- `settings/` — Profile/theme/language cards.
- `login/` — Team login.

### 1.2 What already works (don't break these)

- **Sidebar** already collapses to icons at ≤1024px and hides entirely at ≤768px, replaced by a **mobile bottom nav** with horizontal scroll + scroll indicators (`components/sidebar.module.css`). This is good.
- **Header** has a `@media (max-width: 640px)` block that hides the ⌘K kbd hint and collapses the profile button to an icon.
- **Dashboard widgets grid** has a 3-tier responsive system (12-col / 6-col / 1-col) with per-widget span variables (`--widget-span-lg/md/sm`).
- **Screens page** has a 768px breakpoint that stacks the topbar, controls bar, and footer; the grid goes to single column.
- **Modal component** (`components/Modal.tsx`) already has focus trapping, ESC-to-close, overlay-click-to-close, and a 480px max-width with a `max-height` guard at ≤480px.
- **Playlist workspace** has a 768px breakpoint that stacks the info panel below the content and makes modals full-width.

### 1.3 The underlying issue: **responsiveness is bolted on, not foundational**

The single most telling finding: the **`.main` shell with `margin-left: 260px`** is **copy-pasted across 5 separate `.module.css` files** (`layout.module.css`, `dashboard.module.css`, `screens.module.css`, `asset.module.css`, `playlists.module.css`). Each page re-implements its own `@media (max-width: 768px)` reset of that margin. This means:

- Inconsistencies are inevitable (one page's padding doesn't match another's).
- Adding a new page requires re-pasting the same 30 lines of shell CSS.
- Fixing a responsive bug requires hunting across 5 files.

---

## 2. Core Problems Identified

| # | Problem | Where | Impact |
|---|---------|-------|--------|
| P1 | **Duplicated `.main` shell** — margin/padding/resets copied across 5 CSS files | `dashboard/screens/asset/playlists/layout *.module.css` | Drift, maintenance burden, inconsistent mobile padding |
| P2 | **No consistent mobile breakpoints** — pages mix 380/430/480/640/768/1024 thresholds arbitrarily | All page CSS | Unpredictable layout shifts; gaps at odd widths |
| P3 | **Tables force horizontal scroll on mobile** — `min-width: 860px` screens table, fixed-column playlist table | `screens.module.css`, `workspace.module.css` | Thumb-scroll required to see basic columns; poor UX |
| P4 | **No "card list" fallback** for table-heavy views on phones | screens, assets, playlists | Data tables are desktop-first; mobile users get a degraded scroll |
| P5 | **3+ different modal systems** — `components/Modal.tsx` (480px), inline `modalOverlay` in `workspace.module.css` (540px), `assets/Modal.module.css`, and bespoke overlays in PushToScreenModal (860px) | 29 modal files | Inconsistent sizing, animation, close behavior, focus handling |
| P6 | **Some modals are NOT popups** — playlist detail is a full route (good), but some inline panels (info panel, filter sidebars) don't become popups/sheets on mobile | playlists workspace, assets filter sidebar | Sidebar panels crowd the small screen instead of overlaying |
| P7 | **Form inputs and buttons have fixed heights** (`42px` everywhere) that are fine for touch but spacing doesn't compress on mobile | screens controls bar, workspace action bar | Cramped controls on phones |
| P8 | **Filter sidebars are not responsive sheets** — `FilterSidebar` on screens/assets uses a fixed right sidebar that needs to become a slide-over on mobile | `screens/FilterSidebar.module.css`, `assets/FilterSidebar.module.css` | Filters inaccessible or squashed on mobile |
| P9 | **Touch targets** — some icon-only buttons are 32–34px (below the 44px Apple/Google minimum) | sidebar toggle (34px), workspace remove buttons (32px) | Hard to tap accurately |
| P10 | **`100dvh` vs `100vh`** — mixed usage; modals use `100vh`, workspace uses `92dvh` | modal CSS files | Mobile browser chrome causes jumpiness on `vh` |
| P11 | **No reduced-motion support** — animations (slideDown, spin, pulse) ignore `prefers-reduced-motion` | globals.css, all modal CSS | Accessibility concern for motion-sensitive users |
| P12 | **Zoom system is global but rigid** — `[data-zoom]` rescales root font-size; doesn't adapt container widths well at the extremes | `globals.css` | "Larger" zoom can blow out narrow layouts |

---

## 3. Design Principles & Breakpoint Strategy

### 3.1 Principles

1. **Mobile-first, progressively enhanced.** Default styles target the smallest viewport; `min-width` media queries add desktop layout. (Current code is desktop-first with `max-width` overrides — we invert this for the shell.)
2. **One shell, one source of truth.** The `.main` container lives in `layout.module.css` only. Page modules never set `margin-left`.
3. **Popups over panels on small screens.** Sidebars, info panels, and filter drawers become **bottom sheets / slide-overs** below the tablet breakpoint.
4. **Tables become card lists on phones.** No table wider than the viewport on ≤640px — switch to a stacked card layout.
5. **44px minimum touch targets.** All interactive elements ≥44×44px on touch devices.
6. **Respect `prefers-reduced-motion`.** All animations gated behind a media query.
7. **Consistency over novelty.** Reuse the design tokens already in `globals.css` (`--surface-*`, `--radius-*`, `--transition-*`).

### 3.2 Standardized breakpoints (adopt app-wide)

```css
/* Mobile-first breakpoints — use min-width to enhance upward */
$sm:  480px;   /* large phones */
$md:  768px;   /* tablets / small laptops */
$lg:  1024px;  /* desktop */
$xl:  1280px;  /* wide desktop */
```

| Range | Name | Layout behavior |
|-------|------|-----------------|
| < 480px | phone | Single column, bottom nav, bottom sheets, card lists |
| 480–767px | large phone / small tablet | Single column, bottom nav, card lists, slide-overs |
| 768–1023px | tablet | Collapsed icon sidebar, 2-column grids, side panels OK |
| 1024–1279px | laptop | Expanded sidebar (260px), multi-column |
| ≥ 1280px | desktop | Full sidebar, widest grids, multi-panel workspaces |

> **Migration note:** Existing `max-width: 768px` rules are kept during migration but new CSS uses `min-width: 768px` enhancements. The two approaches can coexist; we standardize over time.

---

## 4. Shared Layout & Shell Fixes

**Goal:** Eliminate the 5-way duplication of the `.main` shell.

### 4.1 Consolidate into `layout.module.css`

Currently every page re-declares:

```css
.main {
  margin-left: 260px;
  width: calc(100% - 260px);
  /* ...plus the sidebar-collapsed + 768px overrides */
}
```

**Fix:** Each page's top-level wrapper uses a shared class from `layout.module.css` (e.g. `.pageContainer`) and **never** sets `margin-left`. The shell handles sidebar offset via the existing `body.sidebar-collapsed` toggle and the `[data-sidebar-nav]` presence.

- `layout.module.css` keeps `.shell`, `.main`, and the responsive overrides — **the only place** these live.
- `dashboard.module.css`, `screens.module.css`, `asset.module.css`, `playlists.module.css` **remove** their `.main`/`.shell` rules. Pages render into `<div className={layoutStyles.pageInner}>…` inside the existing `<main>`.

### 4.2 Mobile bottom-nav safe area

`layout.module.css` `.main` already adds `padding-bottom: 96px` at ≤768px to clear the bottom nav. Verify this is **not duplicated** (it currently is, in each page module). After consolidation it lives only here. Add `env(safe-area-inset-bottom)` for notched phones:

```css
@media (max-width: 768px) {
  .main { padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px)); }
}
```

---

## 5. Unified Popup / Modal System

**Goal:** Replace the 3–4 ad-hoc modal implementations with **one** system supporting multiple variants.

### 5.1 Extend `components/Modal.tsx` into a variant-driven component

Add a `variant` prop:

| Variant | Use case | Behavior |
|---------|----------|----------|
| `dialog` (default) | Confirm, rename, small forms | Centered, 480px max, current behavior |
| `sheet-bottom` | Mobile-first pickers, filters, quick actions | Slides up from bottom on mobile, centered dialog on ≥768px |
| `sheet-side` | Filter sidebars, info panels, asset browsers | Slide-over from right (desktop) / full-screen sheet (mobile) |
| `fullscreen` | Complex editors, large asset pickers, push-to-screen | Near-fullscreen with max-width 860px on desktop |

All variants share:
- Focus trapping (already implemented).
- ESC + overlay-click close (already implemented).
- Lock body scroll while open (add via `useEffect`).
- `prefers-reduced-motion` → instant transitions.
- Consistent header (title + subtitle + close button) and optional footer slot.

### 5.2 Replace bespoke overlays

| Current | Replace with |
|---------|--------------|
| `workspace.module.css` `.modalOverlay` (Push to Screen) | `<Modal variant="fullscreen">` |
| `assets/Modal.module.css` | `<Modal variant="dialog">` |
| `assets/PushToScreenModal.module.css` overlay | `<Modal variant="fullscreen">` |
| Inline filter sidebars (screens, assets) | `<Modal variant="sheet-side">` triggered by the existing "Filters" button |
| Playlist info panel on mobile | Becomes a `sheet-side` or collapses into a disclosure |

### 5.3 Bottom-sheet pattern for mobile popups

For `sheet-bottom` and `sheet-side` on ≤768px:
- Anchored to viewport edge with `border-radius` only on the non-anchored corners.
- Drag handle (visual affordance) at top.
- `max-height: 85dvh` with internal scroll.
- Backdrop dims the page behind.

```css
/* Conceptual — lives in the unified Modal.module.css */
.sheetBottom {
  position: fixed;
  inset: auto 0 0 0;
  max-height: 85dvh;
  border-radius: 20px 20px 0 0;
  animation: slideUp 280ms cubic-bezier(0.16, 1, 0.3, 1);
}
@media (min-width: 768px) {
  .sheetBottom { /* becomes centered dialog */ }
}
```

---

## 6. Page-by-Page Responsive Plan

### 6.1 Dashboard (`dashboard/`)

**Current:** Works decently; KPI grid is 2-col at 768px, 1-col at 480px.

**Changes:**
- Remove duplicated `.main` shell (use shared).
- **Filters bar** (`filtersBar`): at ≤640px, wrap into a `<Modal variant="sheet-bottom">` triggered by a "Filters" button showing active-count badge. Currently it's an inline block that crowds the top.
- **Widget tables** (e.g. screens table widget): already scroll horizontally; add a "view all" that opens a `fullscreen` modal with the full table rather than forcing horizontal scroll in-widget.
- **Status breakdown** widget: at ≤480px the 2-col legend/chart grid stacks vertically (add rule).
- Ensure `fixedOverviewGrid` cards don't overflow with long numbers (add `min-width: 0` and truncation).

### 6.2 Screens (`screens/`)

**Current:** Topbar/controls bar stack at 768px; grid → 1 col; table forces horizontal scroll (`min-width: 860px`).

**Changes (highest priority — this is the most-used mobile page):**
- **Table → card list at ≤768px.** Render each device as a card (name, status pill, content, uptime) instead of the 860px-wide table. Keep the table for ≥769px. Add a `DeviceCardMobile` component (or reuse/adapt `DeviceCard.module.css` which already exists).
- **Controls bar** (`controlsBar`): at ≤640px, hide the inline search/filter row and expose via a sticky compact bar with icon buttons that open `sheet-bottom` modals (search, filter, sort, view-toggle).
- **Filter sidebar** (`FilterSidebar`): becomes a `sheet-side` modal on ≤1024px, triggered by the Filters button. Currently it's a 320px right sidebar that subtracts from content width (`margin-right: 320px`) — on mobile this is unusable.
- **Bulk action bar** (`bulkBar`): currently `position: fixed; bottom: 24px` — on mobile this collides with the bottom nav. Move it to `bottom: calc(80px + env(safe-area-inset-bottom))` when bottom nav is visible (≤768px).
- **Pagination footer**: already stacks at 768px; bump touch targets from 34px → 44px.
- **Pair modal** and device modals: route through unified `<Modal>`.

### 6.3 Assets (`assets/`)

**Current:** Folder tree sidebar + file grid/table; filter sidebar; upload panel.

**Changes:**
- Remove duplicated `.main` shell.
- **Folder tree / filter sidebar**: at ≤1024px, collapse into a `sheet-side` modal opened from a "Browse folders" / "Filters" button. Tree navigation on a phone sidebar is cramped.
- **Asset table** (`AssetTableView`): provide a card-grid fallback at ≤768px (the grid view already works; default mobile users to grid, hide the table toggle).
- **Upload panel** (`UploadPanel`): on mobile, open as a `sheet-bottom` or `fullscreen` modal rather than an inline panel.
- **Widget modals** (Countdown, CountUp, Flow, WorldClock, OnlineSlideshow): all route through unified `<Modal variant="dialog">`. Several currently use `assets/Modal.module.css` — consolidate.
- **Push to Screen modal**: use `variant="fullscreen"`.
- **Asset preview modal**: ensure media scales with `max-height: 80dvh` on mobile.

### 6.4 Playlists — List (`playlists/`)

**Current:** Grid + table list with search/pagination. Already has a 768px breakpoint.

**Changes:**
- Remove duplicated `.main` shell.
- **Create playlist** flow: open as `<Modal variant="dialog">` (already modal-based) — just ensure it's using the unified component.
- List cards: ensure long names/dates truncate and don't break grid at ≤480px.

### 6.5 Playlists — Detail Workspace (`playlists/[playlistId]/`)

**Current:** Two-column (table + 300px info panel) on desktop; stacks at 768px. Has its own inline `modalOverlay` for Push to Screen.

**Changes:**
- **Info panel** (`infoPanel`): on ≤1024px (not just 768px), convert to a `sheet-side` toggle opened from the action bar, instead of always-visible 260–300px sidebar that eats horizontal space on tablets. On desktop it stays as-is.
- **Content table**: at ≤768px, render items as **draggable cards** (reorderable list) instead of a multi-column table. The current table has columns (drag handle, thumb, name, type, duration, size, resolution, remove) — too many for a phone. Card shows: thumb + name + type + duration control + remove.
- **Batch action bar** (`batchBar`): same bottom-nav collision fix as screens.
- **Push to Screen modal**: replace inline `modalOverlay` with unified `<Modal variant="fullscreen">`.
- **Action bar** (`headerRow .actions`): already wraps at 768px; collapse text labels to icons at ≤640px (the `.actionBtnLabel` hide rule at 1024px exists — extend logic).
- **Title input**: `clamp(1.3rem, 2.5vw, 1.7rem)` is fine; ensure it doesn't push action buttons off-screen at ≤380px (already `flex-wrap`).

### 6.6 Groups (`groups/`)

**Changes:**
- Verify table/list is responsive; add card fallback at ≤768px if it's table-based.
- Group edit / member management modals → unified `<Modal>`.

### 6.7 Settings (`settings/`)

**Current:** Card-based; only 1 `@media` rule (likely fine).

**Changes:**
- **Two-column layout** (if pageLayout has a sidebar): stack at ≤768px.
- **Theme/language selectors**: ensure tap-friendly (currently radio-style cards — good). Verify they wrap at ≤480px.
- Remove any duplicated shell.

### 6.8 Login (`login/`, `signup/`)

**Current:** Centered auth cards via `.auth-shell` (globals.css). Already mobile-friendly (padding: 40px 20px).

**Changes:**
- Minor: reduce top padding on short viewports; ensure form inputs are ≥44px tall (they are — `12px 16px` padding).
- No major work.

---

## 7. Mobile UX Improvements

### 7.1 Navigation
- Bottom nav (exists) — keep. Ensure it doesn't overlap the bulk/batch action bars (z-index and bottom offset coordination).
- Consider a **persistent "back" affordance** on detail routes (playlist workspace) since mobile users can't rely on sidebar breadcrumb visibility.

### 7.2 Gestures & touch
- Enforce 44px minimum on: sidebar toggle (34→44), workspace remove buttons (32→44), pagination buttons (34→44 at mobile — already bumped to 44 in screens).
- Add `touch-action: manipulation` on buttons to eliminate 300ms tap delay.
- Swipe-to-dismiss on bottom sheets (optional, phase 3).

### 7.3 Forms on mobile
- All form inputs already 42px — good for touch.
- Ensure modals with forms scroll internally (`overflow-y: auto` on body, sticky header/footer) so the submit button stays reachable. The unified Modal enforces this.

### 7.4 Performance on mobile
- Lazy-load heavy chart libraries (dashboard) — only mount charts when their widget is visible (IntersectionObserver).
- Reduce backdrop-filter blur stacks on mobile (multiple `backdrop-filter: blur()` layers are expensive) — cap at one blurred layer per screen on ≤768px.

---

## 8. Visual & UI Consistency Improvements

### 8.1 Token discipline
- All colors, radii, spacing must use `globals.css` tokens. Audit for hardcoded hex values (several exist in `screens.module.css` shadows, batch bars). Replace with `var(--*)`.
- The batch bars (screens + workspace) hardcode dark glass (`rgba(15,23,42,0.9)`) with separate `[data-theme="light"]` overrides — unify into a token like `--batch-bar-bg`.

### 8.2 Spacing rhythm
- Standardize page vertical rhythm: header gap (24px desktop / 20px mobile) — already consistent in shell. Page sections use 20px gaps. Cards use 16px internal padding (16/20/24 across zoom).

### 8.3 Empty states & loading
- A shared `EmptyState` component exists (`components/EmptyState.tsx`) — ensure all pages use it rather than ad-hoc empty markup (screens has its own `.emptyState`; assets has another). Consolidate.
- Loading skeletons: `globals.css` `.skeleton` exists; ensure all `loading.tsx` files use it (dashboard and assets do).

### 8.4 Typography scale
- `clamp()` is used well for page titles (`clamp(1.55rem, 3vw, 2rem)`). Extend `clamp()` usage to card titles and table headers for smoother scaling instead of fixed `rem` jumps.

---

## 9. Accessibility Improvements

- **`prefers-reduced-motion`**: wrap all `@keyframes` consumers. Add a global rule:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
- **Focus visibility**: ensure all interactive elements have `:focus-visible` outlines (modal close button, nav items). Several rely on `:hover`-only states.
- **ARIA**: the unified Modal already has `role="dialog" aria-modal`. Ensure sheet variants announce correctly (`role="dialog"` + `aria-label`).
- **Color contrast**: verify `--on-surface-subtle` on `--surface-low` meets WCAG AA in both themes (likely fine, but audit).
- **Keyboard**: bottom-sheet and slide-over variants must support Tab cycling and ESC (inherited from Modal base).

---

## 10. Testing & QA Strategy

### 10.1 Device/viewport matrix
Test every page at: 360×640 (small phone), 390×844 (iPhone 14), 768×1024 (iPad portrait), 1024×768 (iPad landscape), 1280×800 (laptop), 1920×1080 (desktop).

### 10.2 Automated checks
- **Playwright/Vitest** visual regression at the 3 key breakpoints (mobile 390, tablet 768, desktop 1280) for: dashboard, screens, assets, playlists list, playlist workspace, settings.
- **axe-core** accessibility scan in the existing `testsprite_tests` harness on each page.
- Lighthouse mobile audit per page (target ≥90 perf, ≥95 a11y).

### 10.3 Manual checklist per page
- [ ] No horizontal scroll at any breakpoint ≥360px.
- [ ] All interactive elements ≥44px tap target.
- [ ] Modals open, scroll, and close correctly; body scroll locks.
- [ ] Bottom nav never overlaps content or action bars.
- [ ] Tables either scroll cleanly or convert to cards at ≤768px.
- [ ] Light + dark theme both correct.

---

## 11. Phased Implementation Roadmap

### Phase 1 — Foundation (no visual regressions)
1. Consolidate the `.main` shell into `layout.module.css`; strip duplicates from the 5 page modules.
2. Adopt the standardized breakpoint scale (document; don't force-migrate yet).
3. Add `prefers-reduced-motion` global guard.
4. Add `env(safe-area-inset-bottom)` to bottom nav clearance.

**Exit criteria:** App looks identical on desktop; mobile padding comes from one place.

### Phase 2 — Unified Modal System
5. Extend `components/Modal.tsx` with `variant` prop (dialog / sheet-bottom / sheet-side / fullscreen) + body-scroll lock + footer slot.
6. Migrate the bespoke overlays (workspace Push-to-Screen, assets Modal, PushToScreenModal) onto the unified component.

**Exit criteria:** One modal component serves all 29 modal use-cases; behavior is consistent.

### Phase 3 — Screens page (highest mobile traffic)
7. Add device card-list fallback at ≤768px.
8. Convert FilterSidebar to `sheet-side` modal on ≤1024px.
9. Compact controls bar with icon-button → sheet triggers on ≤640px.
10. Fix bulk action bar bottom-nav collision.
11. Bump pagination touch targets to 44px.

**Exit criteria:** Screens page fully usable one-handed on a phone.

### Phase 4 — Assets + Playlists Workspace
12. Assets: collapse folder tree + filter sidebar into sheet-side on ≤1024px; upload panel → sheet on mobile.
13. Playlist workspace: info panel → sheet-side on ≤1024px; content table → draggable cards on ≤768px.
14. Both: consolidate widget/action modals onto unified Modal.

**Exit criteria:** Assets and playlist editor fully responsive.

### Phase 5 — Dashboard, Groups, Settings, polish
15. Dashboard: filters bar → sheet on mobile; widget tables → "view all" fullscreen modal.
16. Groups: card fallback + modal consolidation.
17. Settings: verify stacking; token cleanup.
18. Global: replace hardcoded colors with tokens; consolidate EmptyState usage.

**Exit criteria:** Whole app responsive and consistent.

### Phase 6 — Testing & hardening
19. Add breakpoint visual-regression tests.
20. axe-core + Lighthouse audits; fix findings.
21. Manual device-matrix pass.

---

## 12. File Inventory (what changes)

**Created:**
- `components/Modal.tsx` — extended with `variant` prop (modify existing).
- `components/Modal.module.css` — new sheet/fullscreen variant styles.
- `screens/DeviceCardMobile.tsx` (or reuse `DeviceCard`) — mobile card list item.
- `playlists/[playlistId]/components/PlaylistItemCard.tsx` — mobile draggable card.

**Modified (shell consolidation):**
- `app/customer/[team_slug]/layout.module.css` — canonical `.main` shell + safe-area.
- `dashboard/dashboard.module.css` — remove `.main`/`.shell` duplication.
- `screens/screens.module.css` — remove `.main`/`.shell`; add mobile card list + compact controls.
- `assets/asset.module.css` — remove `.main`/`.shell`.
- `playlists/playlists.module.css` — remove `.main`/`.shell`.
- `app/globals.css` — add `prefers-reduced-motion` guard + any new tokens.

**Modified (modal migration):**
- `playlists/[playlistId]/workspace.module.css` — remove inline `.modalOverlay`; info-panel sheet rules.
- `assets/Modal.module.css`, `assets/PushToScreenModal.module.css` — deprecate in favor of unified Modal.
- All 29 modal `.tsx` files — adopt `<Modal variant=…>` (incremental; can be done feature-by-feature).

**Modified (responsive):**
- `components/sidebar.module.css` — touch-target + bottom-nav z-index coordination.
- `screens/FilterSidebar.module.css`, `assets/FilterSidebar.module.css` — sheet-side conversion.
- Each page's controls/topbar CSS — mobile stacking refinements.

---

*This plan is analysis-only. No code or database changes have been made. Implementation should proceed phase-by-phase with visual regression checks between phases.*
