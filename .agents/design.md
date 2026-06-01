# NuExis — UI/UX Design System (Web + Player)

NuExis is a **multi-tenant digital signage platform** with two distinct user experiences:

- **Web app (public + customer workspace dashboard)** for teams to manage screens, assets, and playlists.
- **Player UI** for devices that display content 24/7 and must remain reliable even without user interaction.

This document reflects the **current frontend UI/UX** implemented in the Next.js `app/` router and the token system in `app/globals.css`.

---

## 1) Product UX Principles

### 1.1 Premium enterprise SaaS feel
- Crisp typography, strong hierarchy, generous spacing.
- Subtle “glass + blur” where appropriate (dropdowns, sticky headers, floating panels).

### 1.2 Clarity at a glance
- Status and health are readable quickly: pills, dots, short labels.
- List views default to dense table layouts; grid cards are available when scanning is preferred.

### 1.3 Reliability-first for signage
- Player and customer areas use `ErrorBoundary` to avoid “blank screen” failure modes.
- Player UI optimizes for distance legibility and minimal interaction.

---

## 2) Information Architecture (Current Routes)

### Public & Auth
- `/` — Marketing landing page (hero + features)
- `/login` — “Find your workspace” (redirects to team login)
- `/signup` — Create a new workspace

### Customer Workspace (multi-tenant)
Tenant routes are scoped to a workspace slug:
- `/customer/[team_slug]/login` — Workspace login
- `/customer/[team_slug]/dashboard` — Overview dashboard (widgets + filters)
- `/customer/[team_slug]/screens` — Screens management (pairing + assignment)
- `/customer/[team_slug]/asset` — Assets library (upload + browsing)
- `/customer/[team_slug]/playlists` — Playlists management (create/edit)

Navigation placeholders currently appear in the UI:
- Schedules
- Settings

### Player
- `/player` — Pairing + playback UI for a signage device

---

## 3) Visual Language & Design Tokens

### 3.1 Source of truth
Global tokens are defined in:
- `app/globals.css` (`:root` and `:root[data-theme="dark"]`)

Use these tokens in CSS modules to keep pages theme-consistent.

### 3.2 Color system (core)

**Brand / Primary**
- `--primary`: `#094cb2` (light), `#60a5fa` (dark)
- `--primary-container`: `#dce8ff` (light), `#1e3a8a` (dark)
- `--primary-gradient`: premium CTAs, accents, avatars

**Surfaces (tiered)**
- `--surface-lowest`, `--surface-low`, `--surface-container`, `--surface-dim`, etc.
- Layer surfaces to create hierarchy before introducing heavier shadows.

**Text**
- `--on-surface` (primary)
- `--on-surface-muted` (secondary)
- `--on-surface-subtle` (tertiary/metadata)

**Borders / Hairlines**
- `--outline-variant` is the standard boundary color.
- Current UI favors subtle 1px borders on cards, tables, toolbars, and inputs.

**Semantic status accents**
- Online: green
- Offline: red
- Pairing: amber
- Error: `--error` + `--error-container`

### 3.3 Typography
Fonts (imported in `globals.css`):
- **Headlines**: Noto Serif (`--font-serif`)
- **Body**: Inter (`--font-body`)
- **Labels**: Public Sans (`--font-label`)

Usage guidelines:
- Serif: page titles, key “value” numbers, major headings.
- Label font: nav items, table headers, badges, controls, metadata.

### 3.4 Radius, elevation, and motion

**Radius**
- `--radius-sm` → `--radius-2xl`
- `--radius-full` for pills and primary buttons.

**Shadows**
- `--shadow-card` for subtle lift
- `--shadow-modal` for overlays, dropdowns, and dialogs

**Motion**
- `--transition-base` for hover/focus
- UI micro-interactions used across the app:
  - Hover lift (`translateY(-1px)`) on primary actions/cards
  - Shimmer progress bars during refresh operations
  - Short “success pulse” after data refresh

---

## 4) Layout System

### 4.1 Customer dashboard shell
Workspace pages share a consistent frame:
- **Fixed sidebar (desktop/tablet)**: 260px expanded → 80px collapsed
- **Sticky header**: translucent surface with blur
- **Main content padding**: `clamp(24px, 4vw, 48px)`
- **Mobile**: sidebar hidden; bottom navigation appears

### 4.2 Responsiveness
Common breakpoints:
- ≤ 1024px: compact sidebar layout
- ≤ 768px: bottom nav; stacked toolbars; reduced padding

---

## 5) Core UI Components (Current Implementation)

### 5.1 Navigation

**Sidebar (workspace)**
- Collapsible state persists via:
  - `localStorage`: `nuexis_sidebar_collapsed`
  - cookie: `nuexis_sidebar_collapsed`
- Active state uses a primary-tinted surface background.

**Header**
- Search input with keyboard shortcut: **Ctrl/Cmd + K**
- Profile dropdown includes a Theme selector:
  - toggles `<html data-theme="light|dark">`

### 5.2 Buttons
Global button primitives (in `globals.css`):
- `.btn`, `.btn-primary`, `.btn-secondary`

Guidelines:
- Use primary buttons for the main action (Add Screen / New Playlist / Create Workspace).
- Use secondary buttons for alternate paths or safer actions.

### 5.3 Forms
Global form primitives (in `globals.css`):
- `.form-group`, `.form-input` with focus ring and consistent label typography.

Auth pages use an “auth shell” pattern:
- centered card + subtle radial brand glow (`.auth-shell`)

### 5.4 Cards, tables, and dense “data UI”
Workspace pages repeatedly use:
- Card containers: `surface-lowest` + `outline-variant` + rounded corners
- Toolbars: search + view toggles + filter entry points
- Tables: sticky headers, row hover background, label-style headers
- Status indicators: pills/dots + short text labels

### 5.5 Modals & overlays
Common modal pattern:
- Full-screen overlay with dim/blur
- Centered modal content, `--shadow-modal`, close affordance
- Mobile: reduced padding, full-width dialogs, stacked footer buttons

Special overlays:
- Assets: floating upload panel with per-file progress + success/error states
- Screens: filter sidebar for advanced filters + preview modal
- Screens: optional toast for sync feedback (glass, bottom-right)

---

## 6) Key Feature UX Patterns

### 6.1 Workspace discovery → login
- Generic login (`/login`) collects a workspace slug and redirects to:
  - `/customer/{slug}/login`
- Workspace login communicates “tenant context” clearly (workspace badge + guidance popover).

### 6.2 Dashboard (overview widgets)
- Fixed curated widget grid (non-draggable).
- Widgets can be hidden (“remove”) and re-added via “Add Widget”.
- Filters include:
  - text search
  - status
  - content type
  - playlist / asset selectors
- Empty states explain the next step instead of stopping the user.

### 6.3 Screens management
Operational workflows:
- Pair device (**Add Screen**) → pairing modal → code entry on the player
- Assign content (asset/playlist) → assignment modal + preview
- Rename / Delete actions via confirmation modals

Interaction patterns:
- View mode toggle: Table (default) ↔ Grid
- Filters:
  - quick search in-toolbar
  - advanced filters in a side panel (status/orientation/date)
- Near-real-time presence:
  - status is derived from presence + fallback polling to prevent stale UI

### 6.4 Assets management
- Asset browsing and search follow the same toolbar conventions as Screens/Playlists.
- Upload feedback is explicit and persistent:
  - floating upload panel with progress bars and per-file outcomes.

### 6.5 Playlists management
- Create/edit uses a modal editor:
  - playlist name
  - ordered list of items (asset + duration)
- View mode toggle mirrors Screens for consistency.
- Updating a playlist can broadcast a refresh event to players using it.

### 6.6 Player UX (pairing + playback)
Player UI is optimized for distance readability and low interaction:
- Pairing screen:
  - large pairing code
  - countdown + progress bar
  - dark ambient background glows
- Paired playback:
  - media viewport rotation (0/90/180/270) without rotating controls
  - minimal overlay controls (fullscreen + menu)
  - menu sidebar for device actions (refresh/unpair/mute/orientation)

---

## 7) Accessibility & Interaction Standards

Current standards reflected in the UI:
- Visible focus states on inputs and interactive controls.
- Keyboard shortcut for header search (**Ctrl/Cmd + K**).
- Avoid color-only status communication (pills include labels).

Player-specific:
- Large type and high contrast for pairing code legibility.
- Controls sized for remote/mouse interaction (large hit targets).

---

## 8) Implementation Notes (How to keep the design consistent)

1. **Prefer tokens over hardcoded values**  
   Use `var(--primary)`, surface tiers, and `--outline-variant` inside CSS modules.

2. **Keep route shells consistent**  
   Customer pages should preserve: Sidebar + Header + standardized topbar layout.

3. **Re-use interaction patterns**  
   Search + view toggle + modals/side panels are shared across Screens/Assets/Playlists.

4. **Treat the player as a separate surface system**  
   The player intentionally diverges: dark-first, glass overlays, minimal chrome.
