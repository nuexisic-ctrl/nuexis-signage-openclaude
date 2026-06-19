# Playlist System Redesign — Implementation Plan

**Status:** Planning (analysis only — no code or database changes)
**Date:** 2026-06-19
**Author:** NuExis Engineering
**Scope:** Dedicated-route playlist experience, editor workspace, info panel, content table, performance/scalability, and cross-platform (Web + Android) compatibility.

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Recommended Routing Architecture](#2-recommended-routing-architecture)
3. [Database Impact Analysis](#3-database-impact-analysis)
4. [Frontend Architecture Plan](#4-frontend-architecture-plan)
5. [Caching Strategy](#5-caching-strategy)
6. [State Management Strategy](#6-state-management-strategy)
7. [UX/UI Recommendations](#7-uxui-recommendations)
8. [Performance Optimization Plan](#8-performance-optimization-plan)
9. [Web Player Compatibility Plan](#9-web-player-compatibility-plan)
10. [Android Player Compatibility Plan](#10-android-player-compatibility-plan)
11. [Migration Strategy](#11-migration-strategy)
12. [Phased Implementation Roadmap](#12-phased-implementation-roadmap)
13. [Risks and Mitigation Strategies](#13-risks-and-mitigation-strategies)
14. [Final Recommended Architecture](#14-final-recommended-architecture)
15. [Appendix A — Data Contracts](#appendix-a--data-contracts)
16. [Appendix B — Key Code Paths Referenced](#appendix-b--key-code-paths-referenced)

---

## 1. Current Architecture Analysis

### 1.1 What exists today

The playlist feature is a **single-page, modal-driven experience**. There is no dedicated route per playlist; everything happens at `/customer/[team_slug]/playlists` inside one client component.

**Entry point — `app/customer/[team_slug]/playlists/page.tsx`**
- Server Component that authenticates via `getCachedUser()`, resolves the team from `profiles.team_id`, and verifies `profile.teams.slug === team_slug`.
- Fetches **playlists** and **assets** concurrently with `Promise.all`.
- Playlist query: `playlists` → `select('id, name, created_at, updated_at, playlist_items(duration_seconds)')` limited to **100 rows**, ordered by `created_at desc`.
- Asset query: `assets` → `select('id, file_name, file_path, mime_type, size_bytes')` limited to **100 rows**, excluding folders.
- Passes everything to `<PlaylistsClient>`.

**List view — `app/customer/[team_slug]/playlists/PlaylistsClient.tsx`**
- Manages **all state in `useState`** (no global store): `playlists`, `items`, `isModalOpen`, `editingPlaylistId`, pagination, view mode, search.
- Grid + table views with **client-side pagination** (5/10/25/50/100 per page) and search filter.
- Clicking a playlist **opens a modal** (`handleEdit`) which calls the `getPlaylistItems` server action to load items.
- "Refresh" manually re-runs the Supabase client query (with an artificial 550 ms delay for the progress bar animation).
- After save, it **re-fetches all playlists** from the Supabase browser client to refresh the list.

**Editor — inside the same modal**
- A flat list of `{ type, asset_id, duration_seconds }` rows. No drag-reorder, no preview, no undo/redo, no save-status indicator.
- Asset selection uses a `CustomSelect` dropdown populated from the page's initial assets list (capped at 100).
- `handleSave` calls either `createPlaylist` or `updatePlaylist` server actions, then closes the modal.
- After an update, it **broadcasts a realtime `refresh` event** on channel `playlist-broadcast-{id}` so any open web player re-fetches.

**Server actions — `app/customer/[team_slug]/playlists/actions.ts`**
- `getAuthenticatedTeamId()` reads `team_id` from the **JWT `app_metadata`** (never trusts client input) — a strong security pattern to preserve.
- `createPlaylist` / `updatePlaylist` validate every `asset_id` against the DB (team ownership + not a folder), then call **atomic SECURITY DEFINER RPCs** (`create_playlist_atomic`, `update_playlist_atomic`) so the header + items insert/update in a single transaction.
- `requireOwner()` gates all mutations — only workspace owners can edit playlists.
- Rate-limited via `rateLimitAction()` (Upstash Redis).

**Realtime contract (important for cross-platform)**
- The CMS manually broadcasts `refresh` on a **broadcast channel** named `playlist-broadcast-{playlistId}`.
- The web player's `PlaylistEngine.tsx` subscribes to that broadcast event and re-fetches items with a fade transition.
- The Android `PlaylistEngine.kt` does **not** subscribe to this broadcast — it relies on polling `getDeviceState()` / the manifest version. This is an existing inconsistency the redesign must address.

### 1.2 Database state observed (via Supabase MCP)

| Table | Rows | RLS | Notes |
|---|---|---|---|
| `playlists` | 2 | ✅ | `id, team_id, name, created_at, updated_at`. No status, no description, no owner. |
| `playlist_items` | 4 | ✅ | `id, playlist_id, type(image\|video\|widget), asset_id, widget_type, widget_config(jsonb), duration_seconds, sort_order, created_at`. No per-item `updated_at`, no `resolution`/`size_bytes` (denormalized from assets at read time). |
| `assets` | 14 | ✅ | `id, team_id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color`. **No width/height columns** — resolution is not stored today. |
| `devices` | 4 | ✅ | Has `playlist_id`, `content_type`, `orientation`, `scale_mode`, `current_manifest_version`. |
| `screen_groups` | 2 | ✅ | Groups can reference a `playlist_id` (resolves via `resolve_device_state`). |

**Existing RPCs relevant to playlists (all SECURITY DEFINER):**
- `create_playlist_atomic`, `update_playlist_atomic` — transactional writes.
- `get_player_playlist_items(p_hardware_id, p_secret, p_playlist_id)` — player-facing item fetch (auth via hardware_id + secret).
- `get_player_manifest(p_device_id, p_session_token)` — **session-token based**, returns the resolved manifest + `manifest_version`. This is the newer/preferred player path.
- `trg_fn_precompute_manifest_version()` — trigger that recomputes a **SHA-256 manifest hash** on `devices` row changes, stored in `devices.current_manifest_version`. The hash is over `content_type:asset_id:playlist_id:orientation:items_json`.
- `notify_devices_for_playlist(p_playlist_id)` — bumps `updated_at` on devices using the playlist (directly or via groups), which retriggers the manifest-version trigger.
- `trg_fn_on_playlist_item_change` / `trg_fn_on_playlist_update` — triggers that fan out device notifications on item/playlist changes.

**RLS on playlists/playlist_items** is team-scoped via `profiles.team_id` subqueries — correct and consistent. Any new columns on these tables inherit existing policies automatically (column-level RLS is not enabled).

### 1.3 Key problems this redesign must solve

1. **No deep linking / sharing** — playlists live behind a modal; URLs can't point to a specific playlist. Refresh or back-button loses context.
2. **No undo/redo, no autosave, no save status** — the editor is a flat, brittle form. One bad click (e.g. deleting all items) is unrecoverable.
3. **No preview** — you can't see how a playlist will play without pushing it to a device.
4. **Hard 100-row limits** — `limit(100)` on both playlists and assets. Won't scale to enterprise customers.
5. **Resolution column impossible today** — `assets` has no width/height. The requested "Resolution" table column requires either reading metadata at upload time or extracting it lazily.
6. **Push-to-Screen friction** — assigning a playlist to screens requires leaving playlists and going to Screens → device assignment. The "Push to Screen" action should be reachable from the playlist workspace.
7. **Cross-platform sync gap** — web player uses broadcast channels; Android uses manifest polling. A redesign that changes the item shape or sync signal must update both, or players will drift.
8. **No real-time multi-user awareness** — two owners editing the same playlist will silently overwrite each other (last-write-wins via `update_playlist_atomic`).

---

## 2. Recommended Routing Architecture

### 2.1 Recommendation: **Path-segment routes (not query strings)**

The brief suggests `/customer/{team_slug}/playlists?id={unique_playlist_id}`. I **recommend against query-string routing** for the primary identifier and instead propose a **path-segment** design. Rationale:

| Concern | Query-string (`?id=`) | Path-segment (`/[id]`) |
|---|---|---|
| SEO / shareability | URLs read as "playlists with a filter" | URLs read as "a specific resource" |
| Next.js caching | Harder — `searchParams` opts the page out of static optimization and forces dynamic rendering per-request | Segment params integrate cleanly with `generateStaticParams`, prefetching, and RSC streaming |
| Back/forward semantics | Merges list + detail into one history entry; back-button surprises users | Detail page is a real history entry; back returns to the list (matches Figma/Notion/Linear) |
| Deep-link clarity | `?id=abc-123` is ambiguous (filter? selection?) | `/playlists/abc-123` is unambiguous |
| Server-side data loading | Must read `searchParams` (a Promise) and re-fetch per navigation | Reads `params.id`; can be prefetched by `<Link>` |

This matches how every modern SaaS product (Notion, Linear, Figma files, Vercel projects, GitHub repos) models a "document with its own page."

### 2.2 Proposed route structure

```
app/customer/[team_slug]/playlists/
├─ page.tsx                      → List page (index). KEEP current, enhance.
├─ loading.tsx                   → List skeleton (exists)
├─ playlists.module.css          → (exists)
├─ PlaylistsClient.tsx           → List client (exists, refactor)
├─ actions.ts                    → List-level actions (exists, extend)
└─ [playlistId]/
   ├─ page.tsx                   → Detail workspace (Server Component)
   ├─ loading.tsx                → Workspace skeleton
   ├─ not-found.tsx              → "Playlist not found / access denied"
   ├─ PlaylistWorkspace.tsx      → 'use client' editor shell
   ├─ workspace.module.css       →
   ├─ components/
   │  ├─ WorkspaceHeader.tsx     → Title, breadcrumb, action bar
   │  ├─ PlaylistToolbar.tsx     → Undo/Redo/Preview/Push/Save status
   │  ├─ PlaylistTable.tsx       → Virtualized content table
   │  ├─ PlaylistInfoPanel.tsx   → Stats panel
   │  ├─ PlaylistPreview.tsx     → In-place preview player
   │  └─ PushToScreenModal.tsx   → Assign to devices/groups
   └─ actions.ts                 → Detail-level actions (load, reorder, etc.)
```

**Resulting URLs:**
- List: `/customer/acme/playlists`
- Detail: `/customer/acme/playlists/d3f1...` (UUID from `playlists.id`)
- 404/forbidden: a friendly `not-found.tsx` rather than a raw error.

### 2.3 Why UUID path segments are correct here

The existing primary key `playlists.id` is a `gen_random_uuid()`. We **do not need a new identifier** — the UUID is already unique, unguessable (safe to put in a URL), and indexed as the PK. This avoids a "public slug" column and avoids guessability concerns (unlike sequential IDs).

> **Decision:** Use the existing `playlists.id` UUID directly as the route segment. No new `slug` column, no `?id=` query string.

### 2.4 Navigation requirements (all satisfied by this design)

| Requirement | How it's met |
|---|---|
| Every playlist has a unique identifier | UUID PK = route segment |
| Clicking navigates to a dedicated page | List rows render `<Link href={\`.../playlists/${id}\`}>` (not `onClick` modals) |
| Feels like large SaaS document/project routes | Standard Next.js dynamic segment + `loading.tsx` |
| Fast, seamless navigation | `<Link>` **prefetches** the RSC payload on hover/focus; list stays mounted |
| Browser back/forward | Each detail page is a real history entry; back → list |
| Deep linking & sharing | URL is self-contained; server resolves + authorizes on load |

### 2.5 Authorization on the detail route

The detail `page.tsx` must (mirroring the existing list page's secure pattern):
1. `getCachedUser()` — reject if unauthenticated → redirect to login.
2. Read `team_id` from JWT `app_metadata` (NOT from the URL or client).
3. Fetch the playlist with `.eq('id', playlistId).eq('team_id', teamId).single()` — a cross-team guess of a UUID simply returns "not found," giving **no information leak** about other teams' playlist IDs.
4. Return `notFound()` on miss. The `not-found.tsx` is team-scoped and gives a polished empty state.

This keeps the existing security posture (team isolation via RLS + explicit `.eq('team_id')`) intact.

---

## 3. Database Impact Analysis

### 3.1 The redesign is **largely frontend-first** — most requested features need **zero schema changes**

| Requested feature | Schema change needed? | Why |
|---|---|---|
| Dedicated routes | ❌ No | Uses existing `playlists.id` UUID |
| Total Items | ❌ No | `count` of `playlist_items` |
| Total Playlist Size (MB/GB) | ❌ No | `SUM(assets.size_bytes)` via join |
| Total Playback Duration | ❌ No | `SUM(playlist_items.duration_seconds)` |
| Last Updated / Created | ❌ No | `playlists.updated_at` / `created_at` exist |
| Playlist Status | ⚠️ See 3.2 | No `status` column today |
| Resolution column | ⚠️ See 3.3 | `assets` has no width/height |
| Undo/Redo, Preview, Push | ❌ No | Pure frontend (undo) / reuses existing RPCs (push) |

### 3.2 "Playlist Status" — definition required (schema-optional)

There is no `status` column today. "Status" could mean several things; pick one (recommendation in §7.4):

- **(A) Publishing/assignment status** (computed, no column): "Draft / Assigned to 3 screens / Unassigned." Derivable from `devices.playlist_id` + `screen_groups.playlist_id`. ✅ Recommended — zero schema change and the most useful signal.
- **(B) Lifecycle status** (needs column): `draft | published | archived` on `playlists`. Requires a migration + check constraint. Only do this if product wants explicit publish gating.
- **(C) Sync status** (computed): "Synced / Pending on 2 devices." Derivable from manifest version vs. device-reported version. Powerful but needs a device-status join.

> **Recommendation:** Ship (A) first (computed, no migration). Layer (B) only if publish-gating becomes a product requirement.

### 3.3 "Resolution" column — requires asset metadata (schema change)

The content table asks for a **Resolution** column, but `assets` stores no width/height. Two options:

- **(A) Lazy extraction** (no schema change): read dimensions from the blob/metadata at load time. Expensive for large lists, not cacheable, blocks the table render. ❌ Not recommended for scale.
- **(B) Persisted metadata** (recommended, needs migration): add `width int`, `height int` to `assets`, backfill on upload and via a one-time job for existing assets. The CMS already processes uploads server-side, so dimension extraction (e.g., `image-size` for images; ffprobe/probe for video) fits naturally. This makes Resolution a cheap indexed column read.

> **Recommendation:** Add `width`/`height` to `assets` (nullable). Backfill lazily — rows without it simply show "—" until the asset is re-touched. This is the **one schema change** materially required by the requested table columns.

### 3.4 Optional, forward-looking schema additions (NOT required for v1)

If product later wants robust collaboration/edit history, these become relevant (defer unless scoped):

- `playlists.description text` — for richer info panels.
- `playlists.status text` — if explicit publish gating (option B above) is adopted.
- `playlists.updated_by uuid → auth.users` — "who last edited" for multi-user awareness.
- A `playlist_revisions` table — only if true revision history (beyond in-session undo) is wanted. Heavy; defer.

None of these are required to deliver the brief. The plan deliberately minimizes DB surface area because the existing RPC + trigger architecture is already strong.

### 3.5 Impact on existing RPCs & triggers (must remain compatible)

The redesign **must not break** these contracts, since both players depend on them:

- `create_playlist_atomic` / `update_playlist_atomic` — the editor's save path. Reuse as-is. (The new undo/redo is client-side and still serializes to the same `items` shape.)
- `get_player_manifest` + `trg_fn_precompute_manifest_version` — the **cross-platform sync backbone**. Any change to item ordering/composition automatically flows through the manifest hash. **Do not change the manifest hash inputs** without coordinating both players.
- `notify_devices_for_playlist` / `trg_fn_on_playlist_item_change` — already fire on writes. The new editor saves via the same RPCs, so device notification continues to work with no changes.
- RLS policies — adding nullable columns to `assets` requires **no policy changes** (column-level RLS is off).

### 3.6 Storage (no change)

Media lives in the `workspace-media` private bucket, paths scoped by `team_id`. Signed URLs are issued via `getSignedMediaUrl` (web) and the storage signing RPCs (player). The redesign reuses all of this — the preview player and table thumbnails use the same signing flow.

---

## 4. Frontend Architecture Plan

### 4.1 Framework context (what we build on)

- **Next.js 16** (App Router) + **React 19**. Server Components by default, `'use client'` islands.
- **Styling:** CSS Modules + design tokens (`--surface-*`, `--on-surface-*`, `--outline-*`). No Tailwind in app code despite it being a dev dep. **Match this.**
- **i18n:** a custom `useTranslation()` hook with locale files in `lib/i18n/locales/{en,de,es,fr,hi,it,ja,nl,pt,sv}.ts`. All user-facing strings **must** go through `t()`.
- **Icons:** `lucide-react`. **State/UI feedback:** existing `toast` (`app/components/Toast.tsx`), `modalStack` (`lib/utils/modalStack.ts`).
- **Supabase:** server client via `createClient()` (cookie-based), browser client via `lib/supabase/client.ts`. `resilientFetch` wraps all fetches.

### 4.2 Component decomposition

```
┌─ PlaylistWorkspace (client) ────────────────────────────────────────┐
│  ┌─ WorkspaceHeader ─────────────────────────────────────────────┐  │
│  │  Breadcrumb  •  Inline-editable Title  •  Action bar          │  │
│  │  [Undo][Redo] | [Preview] [Push to Screen] | ⋯ [Duplicate]    │  │
│  │  [Delete]              Save status • "Updated 2m ago"          │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌─ Two-column body ──────────────────────────────────────────────┐  │
│  │  ┌─ Content area (flex-grow) ─────┐  ┌─ Info Panel (fixed) ──┐ │  │
│  │  │  PlaylistTable (virtualized)    │  │  Total Items          │ │  │
│  │  │  + "Add Media" / drag-reorder   │  │  Total Size           │ │  │
│  │  │  + inline duration editing      │  │  Total Duration       │ │  │
│  │  │                                 │  │  Last Updated         │ │  │
│  │  │  (Preview overlay toggles here) │  │  Created              │ │  │
│  │  └─────────────────────────────────┘  │  Status (assigned?)   │ │  │
│  │                                       │  Assigned Screens ↗   │ │  │
│  │                                       └───────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.3 Server vs Client split

- **`[playlistId]/page.tsx` (Server Component):**
  - Auth + team verification (reuse the list page's exact pattern).
  - Fetch the playlist header, items (joined with `assets` for `file_name, mime_type, size_bytes, width, height`), and a precomputed summary (`total_items`, `total_size_bytes`, `total_duration_seconds`) — ideally from a single summary RPC or an aggregate query.
  - Fetch assigned devices/groups (for the Info Panel "Assigned Screens" + Push modal preselection).
  - Pass as typed `initialData` props to the client workspace. This gives instant first paint with server-rendered data and a streaming `loading.tsx`.

- **`PlaylistWorkspace.tsx` (`'use client'`):**
  - Holds the optimistic editor state, undo/redo history, save-status machine, and realtime subscription.
  - Hydrates from `initialData`; all mutations go through server actions and reconcile back.

### 4.4 New server actions (detail route) — `actions.ts`

All reuse the existing secure helpers (`getAuthenticatedTeamId`, `requireOwner`, `rateLimitAction`):

| Action | Purpose | Backing |
|---|---|---|
| `getPlaylistForEditor(playlistId)` | Header + items + summary + assignments | RLS select + join |
| `reorderPlaylistItems(playlistId, orderedIds[])` | Drag-reorder persistence | `update_playlist_atomic` (full replace with new order) or a targeted sort_order write |
| `updatePlaylistItemDuration(itemId, seconds)` | Inline duration edit | targeted `playlist_items` update |
| `duplicatePlaylist(playlistId)` | "Duplicate Playlist" | new RPC `duplicate_playlist` (see §11) or a create+copy sequence |
| `pushPlaylistToScreens(playlistId, deviceIds[], groupIds[])` | "Push to Screen" | reuse `updateDeviceAssignment` for each device (sets `content_type='Playlist', playlist_id`) |
| `deletePlaylist(playlistId)` | "Delete Playlist" | reuse existing `deletePlaylist` |

> Reuse over rebuild: most mutations already exist as RPCs. The editor's "Save" still calls `update_playlist_atomic`; undo/redo just feed different `items` arrays to it.

### 4.5 Undo/Redo design (client-side, no schema)

- Maintain a bounded **history stack** of immutable item-list snapshots (e.g., last 50 states) inside the workspace.
- Push a snapshot **before** each mutation (add/remove/reorder/duration edit).
- Undo pops current → history; Redo pops redo → current. Standard `zundo`-style pattern, but **hand-rolled** to avoid a new dependency and to stay consistent with the codebase's "no external state lib" style.
- Keyboard: `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` (or `Ctrl+Y`) redo. Buttons mirror this.
- History is **per-session, in-memory**. Persisting cross-session revisions is explicitly out of scope (would need §3.4's `playlist_revisions` table).
- Because save goes through `update_playlist_atomic`, "unsaved changes" can be tracked by diffing the working tree against the last-persisted snapshot — this drives the Save Status indicator.

### 4.6 Deep-linking & share behavior

- The URL `/customer/{slug}/playlists/{id}` **is** the share link. Anyone on the team who opens it lands on the same workspace.
- The workspace reads `params.playlistId`; no client-side routing state needed for identity.
- Selection/highlight state (e.g. "currently previewing item 3") is **not** in the URL by default — keeping it clean. Optional: `?item={itemId}` if deep-linking a specific item is later wanted, but this opts the page out of static caching, so default to not.

---

## 5. Caching Strategy

A layered cache, consistent with the codebase's existing patterns (React `cache()` for server request scope, `caches` API in the web player, manual localStorage for view prefs).

### 5.1 Layers

| Layer | Where | TTL / invalidation | Contents |
|---|---|---|---|
| **L1 — React request cache** | Server (`cache()` like `getCachedUser`) | per-request | Dedupes `auth.getUser`, profile, and the editor's summary within a single render. Already used for auth; extend to the playlist fetch. |
| **L2 — Next.js Data Cache / RSC payload** | Server (fetch-level + segment) | `revalidatePath` on save (already called) | The detail `page.tsx` RSC output is cached and invalidated by the existing `revalidatePath('/customer/{slug}/playlists')`. Add revalidation of the **detail path** too. |
| **L3 — Client query cache** | Browser (custom, in `PlaylistWorkspace`) | Manual + realtime-evicted | Editor data keyed by `playlistId`. Updated optimistically and reconciled after action results. |
| **L4 — Asset metadata cache** | Browser (memory map) | LRU, bounded | `{ assetId → {file_name, mime_type, size_bytes, width, height, signedUrl?} }` reused across the table, preview, and asset picker. Avoids re-fetching the same asset rows. |
| **L5 — Media blob cache** | Browser (`caches` API) | eviction-on-change (existing pattern) | The web player already uses `caches.open('nuexis-playlist-cache')` keyed by stable filepath (`https://local-media-cache/{filePath}`) rather than expiring signed URLs. **Reuse this exact keying** for preview thumbnails/clips. |
| **L6 — localStorage prefs** | Browser | indefinite | View preferences (already done: `playlistsViewMode`, `nuexis_playlists_per_page`). Add table column visibility/order prefs. |

### 5.2 Invalidation rules

- **On save (create/update/delete/duplicate/push):** server action calls `revalidatePath` for **both** the list path and the specific detail path. The existing `notify_devices_for_playlist` + manifest trigger handle device-side invalidation automatically.
- **On realtime `refresh`:** invalidate L3 for the affected `playlistId` and refetch the editor summary. The web player already listens on `playlist-broadcast-{id}`; the **editor should listen on the same channel** so co-editors see each other's saves (see §6.4).
- **Asset list:** cached at L4; invalidated when a new asset is uploaded (out of scope for this redesign, but the key is stable by `assetId` so uploads simply add new entries).

### 5.3 What NOT to cache

- **Signed media URLs** with long TTLs — they expire (default 3600s). The existing web player correctly keys blobs by **filepath**, not signed URL. Keep this discipline.
- **Per-user auth state** beyond the request — already handled by `getCachedUser`.

---

## 6. State Management Strategy

### 6.1 No new global state library

The codebase deliberately avoids Redux/Zustand — every page is a self-contained client component with `useState`. **Match this.** Adding a global store for a single feature would break consistency and add bundle weight. The workspace's state is local and component-scoped.

### 6.2 Workspace state shape

```ts
type WorkspaceState = {
  playlist: PlaylistMeta            // id, name, created_at, updated_at
  items: PlaylistItemRow[]          // working tree (optimistic)
  history: { past: Snapshot[]; future: Snapshot[] }  // undo/redo
  saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
  lastSavedAt: string | null
  selection: Set<string>            // selected item ids (bulk ops)
  preview: { open: boolean; itemId?: string }
  assignments: { devices: Device[]; groups: ScreenGroup[] }
  realtime: { peers: number; lastRemoteUpdate: string | null }
}
```

### 6.3 Optimistic updates (the core UX win)

Every editor mutation follows the **optimistic-then-reconcile** pattern:

1. Apply the change to `items` immediately (UI feels instant).
2. Push the pre-change snapshot to `history.past`; clear `history.future`.
3. Set `saveState = 'dirty'`.
4. Fire the server action (debounced for duration typing; immediate for add/remove/reorder).
5. On success: `saveState = 'saved'`, `lastSavedAt = now`, reconcile any remote diff.
6. On error: **rollback** from history, `saveState = 'error'`, show toast. Never leave the UI in a state that doesn't match the server.

This is the single biggest perceived-performance improvement and requires no new dependencies.

### 6.4 Real-time & collaboration (multi-user)

- Subscribe to `playlist-broadcast-{playlistId}` (the channel the web player already uses) **and** to Postgres Changes on the `playlist_items` table filtered by `playlist_id` for **this** playlist.
- On a remote change: surface a non-blocking banner ("Another editor updated this playlist — click to refresh") rather than auto-clobbering local edits. Auto-clobber while a user is mid-edit is the classic collaborative-editing footgun; last-write-wins via the atomic RPC is the safety net, but we avoid surprising the user.
- Optional future: CRDT/OT for true concurrent editing — **out of scope**; the banner + reconcile approach is the enterprise-acceptable v1.

### 6.5 Save-status state machine

```
idle ──edit──▶ dirty ──autosave/debounce──▶ saving ──ok──▶ saved ──edit──▶ dirty
                                   │                      └──error──▶ dirty (rolled back) + toast
```

Debounced autosave (e.g., 800 ms after last keystroke for duration fields) plus an explicit "Save" button for major structural changes. The "Save Status" indicator in the header reflects this state with a small dot + label ("Saving…", "Saved", "Unsaved changes").

---

## 7. UX/UI Recommendations

### 7.1 Workspace header action placement (the brief's key UX question)

Based on modern SaaS conventions (Figma, Linear, Notion, Google Docs):

| Action | Placement | Justification |
|---|---|---|
| **Undo / Redo** | Top-left of the toolbar, adjacent to the title | Universally left-positioned (mirrors Google Docs / Figma). Icon-only buttons with tooltips. Keyboard shortcuts primary. |
| **Save Status** | Top-right, immediately left of the action buttons | "Saved • 2m ago" / "Saving…" — persistent, glanceable, non-blocking. Green/grey/amber dot. |
| **Last Updated** | Top-right, paired with Save Status | "Updated 2m ago by [name]" — contextual metadata, low priority. |
| **Preview** | Primary toolbar button (left-of-center, distinct color) | Frequent, high-value action. Opens an in-place overlay (not a new route) so context is preserved. |
| **Push to Screen** | Primary toolbar button, visually emphasized (accent/filled) | The "publish" action — the culmination of editing. Distinct from secondary actions. |
| **Duplicate Playlist** | Overflow menu (`⋯`) | Destructive-adjacent, infrequent. Keeps the toolbar clean. |
| **Delete Playlist** | Overflow menu (`⋯`), destructive styling (red text) | Never a primary button — prevents accidents. Confirms with the playlist name. |

**Layout sketch:**
```
[← Playlists]  My Lobby Loop            [↶][↷]  |  [▶ Preview]  [⇪ Push to Screen]  ⋯    ● Saved · 2m ago
               (inline-editable title)                                              Duplicate
                                                                                    ─────────
                                                                                    Delete (red)
```

### 7.2 Reduce clicks / friction (UX goals)

- **Inline-rename:** click the title to edit in place; Enter/click-away commits. No modal.
- **Inline duration edit:** click a duration cell → numeric stepper → autosaves on blur.
- **Drag-to-reorder:** the table rows are draggable (grip handle on hover). Persists via `reorderPlaylistItems`.
- **Add Media from within the table:** "Add Media Item" row at the bottom opens the asset picker (reuse the asset list + a searchable, virtualized picker to drop the 100-row cap).
- **Bulk operations:** multi-select rows → bulk duration set / bulk delete (reuse the new `lib/utils/selection.ts` helper that's already being added in the working tree).
- **Preview-before-push:** "Preview" plays the playlist in a scaled device frame using the **same renderers** the web player uses (`PlayableItem`, widgets, etc.) — no separate preview engine to maintain.

### 7.3 Content table columns (recommendation)

The brief's proposed columns + my analysis:

| Column | Keep? | Notes |
|---|---|---|
| **Drag handle** (implicit) | ➕ Add | Enables reorder; standard in sortable tables |
| **Thumbnail** | ➕ Add (recommended) | Small image/video poster; dramatically improves scannability. Cheap if from cached blob. |
| **Title** (asset file_name) | ✅ Keep | Primary identifier |
| **Type** (image/video/widget) | ✅ Keep | Use icon + label |
| **Duration** | ✅ Keep | Inline-editable |
| **Size** | ✅ Keep | From `assets.size_bytes` |
| **Resolution** | ✅ Keep (needs §3.3 migration) | `{width}×{height}` from new `assets.width/height` |
| **Last Modified** | ✅ Keep | Per-item `updated_at` — **needs adding to `playlist_items`** OR derive from `assets.created_at`. Recommend deriving from asset to avoid another column, shown as "asset age." |
| **Status/Errors** (e.g., "Asset deleted") | ➕ Optional | Warns if an item's `asset_id` no longer resolves (defensive; can happen if an asset is deleted) |

**Additional recommendation:** make columns **configurable** (show/hide, persisted to localStorage), mirroring the existing per-page/view-mode persistence pattern. Enterprise users expect this.

### 7.4 Info panel (the brief's required fields)

All derivable without schema change:

| Field | Source |
|---|---|
| Playlist Name | `playlists.name` (editable) |
| Total Items | `count(playlist_items)` |
| Total Playlist Size | `SUM(assets.size_bytes)` over items |
| Total Playback Duration | `SUM(playlist_items.duration_seconds)` |
| Last Updated | `playlists.updated_at` |
| Created | `playlists.created_at` |
| Playlist Status | **(A) Computed assignment status** (Recommended): "Assigned to 3 screens" / "Draft (unassigned)" from `devices` + `screen_groups` |

Compute these once on the server (single aggregate query or a summary RPC) and pass to the panel — don't compute in the client loop.

### 7.5 Design consistency with the rest of NuExis CMS

- Reuse the existing CSS-module + design-token system (`--surface-low`, `--outline-variant`, `--on-surface-muted`, etc.) — visible in `playlists.module.css` and the inlined styles in `PlaylistsClient.tsx`.
- Reuse `CustomSelect`, `toast`, `modalStack`, the empty-state pattern, the table/pagination footer pattern, and the success-pulse animation already in the list view.
- Header treatment should mirror the new `Header.tsx` (avatar, search, theme/language/zoom) at the app level — the **workspace header** is a page-level sub-header with a back breadcrumb, distinct from the global header.

---

## 8. Performance Optimization Plan

Targets: scale to enterprise customers with thousands of assets and playlists with hundreds/thousands of items.

### 8.1 Pagination

- **List page:** replace `limit(100)` with **cursor-based pagination** (keyset on `(created_at, id)`). Offset pagination re-scans; keyset is O(log n) and stable under inserts. The existing page-number UI can remain, but back it with cursor pagination for deep pages.
- **Items table:** for the typical case (hundreds of items), load all and **virtualize** (§8.4). For pathological cases (thousands), paginate the table with "Load more" using keyset on `sort_order`.

### 8.2 Virtualization for large playlists

- Render only visible rows using a windowing technique. Given the codebase has **no virtualization dependency**, options:
  - **(A) Hand-rolled windowing** (`IntersectionObserver` + translateY) — zero deps, full control, consistent with codebase philosophy. Recommended for v1.
  - **(B) Add a lib (`@tanstack/react-virtual`)** — battle-tested, small. Acceptable if hand-rolling proves brittle.
- Virtualize both the **content table** and the **asset picker** (which can have thousands of assets). The picker is the more urgent virtualization target.

### 8.3 Optimistic UI updates

- Covered in §6.3. Every mutation is optimistic; the table updates before the server responds. This eliminates perceived latency for add/remove/reorder/duration edits.

### 8.4 Fast route transitions

- `<Link>` from the list **prefetches** the detail RSC payload on hover/focus — Next.js does this automatically. First paint of the detail page is effectively instant for prefetched links.
- `loading.tsx` per route gives an immediate skeleton while the server query runs.
- Server-render the initial data (no client-side fetch waterfall) — the workspace hydrates with data already in hand.
- Avoid opting the detail page out of caching: keep identity in the **path segment**, not `searchParams` (§2.1).

### 8.5 Intelligent caching

- See §5. The big wins: L4 asset-metadata cache (shared across table + preview + picker), L5 blob cache reuse (same keys as the web player), and React `cache()` for request-scoped dedup.

### 8.6 Asset metadata caching

- The table needs `file_name, mime_type, size_bytes, width, height` per item. Fetch these **joined** in the server query (one round trip), then cache by `assetId` at L4. When the asset picker is opened, it reads from the same cache — no duplicate fetches.

### 8.7 Offline support

- **Web player:** already robust — `caches` API keyed by filepath, offline fallback in `PlaylistEngine.tsx`. The redesign **preserves** this; preview reuses the same cache.
- **CMS workspace:** offline editing is **not** a v1 goal (it implies a conflict-resolution layer). What we *do* support:
  - The table and preview work offline for already-cached assets.
  - Mutations queue via a simple "pending actions" buffer and replay on reconnect (optional, defer). At minimum, show a "You're offline — changes can't be saved" banner and disable Save.
- **Android:** already has full offline playback (`startOfflinePlaybackFromCache`, cached manifest). No change needed.

### 8.8 Background data synchronization

- **Web player:** realtime `refresh` broadcast already triggers re-fetch. The redesign should also have the **editor** listen so co-editors sync (§6.4).
- **Android:** background sync via WorkManager-style polling on `getDeviceState` + the manifest version. The manifest hash (`current_manifest_version`) means a device only re-downloads content when the hash actually changed — this is already optimal and must be preserved.
- **Editor → devices:** saving calls `update_playlist_atomic`, whose trigger calls `notify_devices_for_playlist`, which bumps `devices.updated_at`, which retriggers the manifest-version trigger, which changes `current_manifest_version`, which the device's next poll detects. **This chain already works end-to-end and requires no change.**

### 8.9 Real-time updates

- Two channels:
  1. **Player refresh** (existing): broadcast `refresh` on `playlist-broadcast-{id}` → web player re-fetches with fade. Keep.
  2. **Editor collaboration** (new): editor subscribes to the same broadcast + Postgres Changes on `playlist_items` for co-editor awareness (§6.4).
- The manifest-version system gives **implicit realtime** to players without a realtime subscription — polling the version is cheap (one column) and changes only when content changes.

### 8.10 Bundle & render performance

- Keep the detail page's client JS small: the workspace is the only large client island; the rest is server-rendered.
- Widget renderers (Weather, NewsTicker, FlowClock, etc.) are heavy — **lazy-load** them in the preview via `next/dynamic` so the table-only path stays light. The web player already imports them eagerly; the editor preview should not.

---

## 9. Web Player Compatibility Plan

The web player (`app/player/PlaylistEngine.tsx` + `app/player/actions.ts`) is the in-browser signage renderer. The redesign must keep it working.

### 9.1 What the web player depends on (do not break)

- `getPlaylistItems(playlistId, hardwareId, secret)` → `get_player_playlist_items` RPC. **Item shape must stay stable.**
- `getSignedMediaUrl(filePath, hardwareId, secret)` → signed URL signing. **Filepath keying stays.**
- Realtime broadcast `playlist-broadcast-{playlistId}` event `refresh`. **Channel name + event name stay.**
- `caches.open('nuexis-playlist-cache')` keyed by `https://local-media-cache/{filePath}`. **Cache key scheme stays.**
- Widget mime-type branching (`application/x-widget-*`). **Widget contract stays.**

### 9.2 Compatibility concerns & solutions

| Concern | Solution |
|---|---|
| Editor changes item ordering | `sort_order` is already the player's order source; reorder just changes `sort_order`. No player change. |
| Editor adds new widget types | Player must add a renderer branch. Gate new widgets behind a feature check so old players fail gracefully ("unsupported widget" fallback already exists per-widget). |
| Preview uses same renderers | **Reuse** `PlayableItem` from the player in the preview overlay — single source of truth for rendering. Extract it to a shared module if coupling is a concern. |
| Signed-URL expiry during long preview sessions | Reuse the player's dedup + on-demand signing (`signingPromisesRef`). Don't pre-sign all items. |
| Asset deletion while in a playlist | Player shows empty/broken item; the table should show a "missing asset" warning (§7.3). Defensive on both sides. |

### 9.3 Preview player reuse strategy

The workspace "Preview" should render the **exact same** `PlaylistEngine`-style component the player uses, but:
- Scaled into a device-frame aspect ratio (reuse `ScaledScreenPreview.tsx` if it fits).
- Not tied to `hardwareId/secret` (it's an editor preview, not a paired device) — so it must use the **CMS auth context** to fetch items + signed URLs. This means a **CMS-scoped variant** of item fetching (`getPlaylistItems` already exists as a CMS server action; reuse it) and CMS-scoped signed URLs (the assets bucket is the same; signing uses the user's session, not device credentials).

> **Action item:** factor a headless `PlaylistRenderer({ items, resolveUrl })` component shared by both the player and the preview, differing only in how items/URLs are resolved. This is the single most important refactor for cross-platform rendering consistency.

---

## 10. Android Player Compatibility Plan

The Android player (`apps/android-player/.../PlaylistEngine.kt`, `ContentSyncManager.kt`) uses a **different sync model** than the web player.

### 10.1 Current Android sync model

- `ContentSyncManager.syncSignageContent()` polls `getDeviceState(hardwareId, secret)`.
- Detects change by comparing `state.updated_at` (and content fields) to cached `lastUpdatedAt`.
- On change → `loadPlaylistContent` → `PlaylistEngine.start` → `getPlaylistItems` (RPC) → cache manifest JSON locally.
- **Offline:** `startOfflinePlaybackFromCache()` uses the cached manifest JSON.
- `trg_fn_precompute_manifest_version` gives `current_manifest_version` (SHA-256), so `get_player_manifest` returns the version; the device can short-circuit "no change."

### 10.2 Existing inconsistency to resolve

- Web player uses **realtime broadcast** for instant refresh.
- Android uses **polling** (no realtime subscription in `RealtimeClient.kt` for playlist changes — it exists but isn't wired to playlist refresh).
- **Result:** web players update in ~1s; Android players update on next poll (up to 30s in the online-check loop, faster while actively syncing).

**Redesign recommendation:** standardize both players on the **manifest-version** model as the source of truth, and treat the broadcast channel as an **optimization** (web-only fast path), not a contract. Specifically:
- The manifest version (`current_manifest_version`) changes iff content changes (trigger-guaranteed). Both players should compare versions.
- Android should reduce poll latency by subscribing to Realtime on `devices` row changes for its own `device_id` (Postgres Changes), then immediately re-fetch the manifest. This closes the web/Android latency gap.
- This keeps the broadcast channel as an optional CMS→web fast path without forcing Android to adopt it.

### 10.3 Compatibility concerns & solutions

| Concern | Solution |
|---|---|
| New `assets.width/height` columns (§3.3) | Android doesn't read these today — **no impact**. The manifest RPC doesn't return them. Keep the manifest payload unchanged. |
| Item reorder | `sort_order` respected by Android (`items.sortedBy { it.sort_order }`). No change. |
| New item types/widgets | Android `MediaEngine.playWidget` must handle new mime types; same gating discipline as web. |
| Duplicate playlist | Creates a new `playlists.id`; assigned devices unaffected. No player change. |
| Manifest hash inputs | **Must remain** `content_type:asset_id:playlist_id:orientation:items_json`. Changing these would desync every device. Document as a versioned contract. |
| Offline manifest cache | Android caches the item JSON in `StorageManager.setCachedManifest`. The item shape is unchanged, so offline playback continues to work. |

### 10.4 Future platform readiness

- Because sync is **contract-defined** (manifest version + item shape + widget mime types), a future iOS/embedded player implements the same contract. The redesign doesn't add platform-specific assumptions.
- Recommendation: formalize the **Player Sync Contract** as a versioned document (`PLAYER_CONTRACT.md`) listing: manifest version inputs, item JSON shape, widget mime types, cache key scheme, realtime channel/event names. Any change to these bumps the contract version; players check `manifest_version` + a `contract_version` if needed.

---

## 11. Migration Strategy

### 11.1 Data migrations (mostly none)

The redesign is **frontend-first**. The only schema change the brief's columns require is `assets.width/height` (nullable). Migration approach:

1. **Add columns** `width int NULL, height int NULL` to `assets`. (One migration; no downtime — nullable, default NULL.)
2. **Backfill:** populate on new uploads (add dimension extraction to the existing upload server action). For existing assets, a one-time background job iterates assets, extracts dimensions, and updates rows. Rows not yet backfilled show "—" in the Resolution column.
3. **No data backfill needed** for playlists/playlist_items — no structural change.

### 11.2 Code migration (route introduction)

- The new `[playlistId]/` route is **additive** — it doesn't remove the list page. Both coexist during rollout.
- The list page's "click → modal" behavior is changed to "click → navigate," but the modal code can remain temporarily behind a flag for safe rollback.
- Server actions are **reused**, not replaced — low migration risk.

### 11.3 New RPC: `duplicate_playlist` (optional)

"Duplicate Playlist" can be implemented either as:
- **(A) Client orchestration:** fetch items → `createPlaylist` with copied items. Two round trips, non-atomic.
- **(B) New RPC `duplicate_playlist(p_playlist_id)`:** atomic server-side copy (new `playlists` row + cloned `playlist_items` with new IDs + new `sort_order`). Recommended for correctness and to match the existing atomic-RPC pattern. Name it with a `_v1` suffix or version the contract if item shape may evolve.

> Recommendation: add `duplicate_playlist` as a SECURITY DEFINER RPC following the existing `create_playlist_atomic` template. This is the one new backend artifact.

### 11.4 Rollout & rollback

- **Feature flag** (`NEXT_PUBLIC_PLAYLIST_WORKSPACE` or server-side flag) gates the new route/navigation. Allows dark launch + instant rollback.
- Rollback = revert navigation to modal; the new route can stay (harmless) or be removed. No data migration to reverse.
- Backfill job is idempotent and safe to re-run.

---

## 12. Phased Implementation Roadmap

Sequenced to deliver value early and de-risk. Each phase is independently shippable.

### Phase 0 — Foundations (no UI change)
- Formalize the **Player Sync Contract** doc (manifest inputs, item shape, widget mimes, cache keys, realtime channel/event).
- Add `assets.width/height` columns + upload-time extraction + lazy backfill job.
- Add `duplicate_playlist` RPC.
- Add the `[playlistId]/` route skeleton with auth + 404, server-rendered read-only view.

### Phase 1 — Dedicated Route & Navigation
- List page: change click → `<Link>` navigation; remove modal for edit.
- Detail page: WorkspaceHeader (breadcrumb, title, back), server-rendered info panel + read-only table.
- `loading.tsx` + `not-found.tsx`.
- Deep-linking/sharing works end-to-end.

### Phase 2 — Editor Workspace (core)
- Client workspace with optimistic add/remove/reorder (drag), inline duration edit.
- Undo/redo (history stack + keyboard).
- Save-status machine + autosave.
- Virtualized content table + configurable columns.
- Realtime editor co-awareness (banner on remote change).

### Phase 3 — Power Features
- In-place **Preview** (reuse player renderers; CMS-scoped URL resolution).
- **Push to Screen** modal (reuse `updateDeviceAssignment`; preselect assigned devices).
- **Duplicate** + **Delete** (overflow menu, confirmations).
- Asset picker with search + virtualization (drops the 100-row cap).

### Phase 4 — Scale & Polish
- List page keyset pagination (drop `limit(100)`).
- Realtime Postgres Changes for items; collapse web/Android sync gap (Android Realtime subscription).
- Column show/hide persistence, keyboard shortcuts, accessibility pass.
- Performance instrumentation (route transition time, table render time for 1k items).

### Phase 5 — Forward-Looking (optional)
- Explicit publish lifecycle (`playlists.status`) if product wants gating.
- Per-item `updated_at` / editor attribution.
- True concurrent editing (CRDT) if multi-user editing becomes core.

---

## 13. Risks and Mitigation Strategies

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Breaking the manifest-version contract desyncs all players | Med | **Critical** | Document the contract (Phase 0); never change hash inputs without bumping a version; both players compare versions. |
| R2 | Realtime broadcast desync between web (broadcast) and Android (poll) | High | Med | Standardize on manifest-version as truth; broadcast = web fast-path only; wire Android to Realtime in Phase 4. |
| R3 | Optimistic updates cause UI/server divergence on error | Med | Med | Always rollback from history on error; show toast; never persist dirty state silently. |
| R4 | Last-write-wins overwrites a co-editor's changes | Med | Med | Co-editor awareness banner (§6.4); reconcile on remote change; never auto-clobber during active edit. |
| R5 | Large playlists (1k+ items) jank the table | Med | Med | Virtualization (§8.2); server aggregate for summary (don't sum in client); keyset pagination. |
| R6 | `limit(100)` on assets breaks the picker for big libraries | High | Med | Virtualized, searchable asset picker; server-side filtering. |
| R7 | Signed-URL expiry breaks long preview sessions | Low | Low | On-demand, deduped signing (existing pattern); key blobs by filepath. |
| R8 | `assets.width/height` backfill job is slow/stalls | Low | Low | Nullable columns; lazy backfill; "—" until populated; idempotent job. |
| R9 | Undo/redo memory growth on long sessions | Low | Low | Bound history to N (e.g., 50) snapshots; immutable refs. |
| R10 | Route introduction breaks existing bookmarks/links | Low | Low | List URL unchanged; new route is additive; feature flag for rollout. |
| R11 | Removing the edit modal breaks in-flight behavior | Low | Med | Ship behind flag; keep modal code for rollback until Phase 2 stable. |
| R12 | Preview renderer divergence from live player | Med | Med | Extract shared `PlaylistRenderer`; single source of truth (§9.3). |
| R13 | Cross-team UUID guess leaks playlist existence | Very Low | Low | Detail page queries with `.eq('team_id')`; misses return `notFound()` uniformly — no oracle. |
| R14 | New widget types unsupported on old players | Med | Med | Per-widget graceful fallback (exists); gate new widgets; version the widget mime contract. |

---

## 14. Final Recommended Architecture

### 14.1 Summary decisions

1. **Routing:** Path-segment dynamic route `/customer/{team_slug}/playlists/{playlistId}` using the existing UUID PK. **No query strings, no new slug column.** Each playlist is a real history entry, deep-linkable, shareable, prefetchable.
2. **Database:** **Frontend-first.** Only schema addition is nullable `assets.width/height` (for the Resolution column) + optional `duplicate_playlist` RPC. All other requested info (totals, status, size, duration) is computed server-side from existing columns. The manifest-version + atomic-RPC architecture is **preserved as the sync backbone**.
3. **Frontend:** Self-contained client workspace (no global store, matching codebase conventions), server-rendered initial data, optimistic mutations with rollback, in-memory undo/redo, debounced autosave, realtime co-editor awareness.
4. **Performance:** Virtualized table + asset picker, keyset pagination, layered cache (React `cache()` → RSC cache → client asset-metadata cache → blob cache reusing the player's filepath keys → localStorage prefs), optimistic UI, prefetch-based fast route transitions.
5. **Cross-platform:** Standardize both players on the **manifest-version** as the source of truth; keep the broadcast channel as a web fast-path; close the Android latency gap via Realtime subscription on its `devices` row. Extract a shared `PlaylistRenderer` so preview and live playback never diverge. Formalize a **versioned Player Sync Contract**.
6. **UX:** Toolbar with Undo/Redo (left), Preview + Push (primary, center-right), Duplicate/Delete (overflow), Save Status + Last Updated (far right). Inline rename/duration, drag reorder, bulk ops, in-place preview, configurable columns. Full i18n via existing `t()`.

### 14.2 Justification (why this architecture)

- **It changes the least to gain the most.** The backend is already enterprise-grade (atomic RPCs, RLS, manifest versioning, device notification triggers). The redesign's wins are almost entirely in routing + editor UX + performance, which are frontend concerns. Minimizing DB/contract change minimizes risk to live players.
- **It preserves every existing contract.** Both the web and Android players keep working unchanged through Phase 1–3 because item shape, cache keys, manifest inputs, and the broadcast channel all remain stable.
- **It scales.** Virtualization + keyset pagination + layered caching handle enterprise-sized libraries and playlists. The current `limit(100)` ceilings are removed.
- **It matches the codebase.** No new state library, no Tailwind in app code, CSS Modules + design tokens, `useTranslation()` everywhere, reuse of `toast`/`modalStack`/`CustomSelect`. A new engineer recognizes every pattern.
- **It's safely rollable.** Additive routing + feature flag + reusable actions mean each phase ships independently and rolls back cleanly.

### 14.3 What is explicitly **out of scope** (deferred unless re-scoped)

- Cross-session revision history (`playlist_revisions` table).
- True concurrent/CRDT editing.
- Explicit publish lifecycle status column (`draft/published/archived`).
- Offline CMS editing with conflict resolution (offline *playback* is already covered).
- Per-item editor attribution / `updated_by`.

---

## Appendix A — Data Contracts

### A.1 Playlist editor item (CMS-side, unchanged shape)

```ts
type PlaylistItemInput = {
  type: 'image' | 'video' | 'widget'
  asset_id: string | null
  duration_seconds: number
  widget_type?: string | null
  widget_config?: unknown
  sort_order: number
}
```
This is exactly what `create_playlist_atomic` / `update_playlist_atomic` accept today. Undo/redo and reorder serialize to this same shape.

### A.2 Player manifest item (unchanged)

From `get_player_manifest` / `get_player_playlist_items`:
```ts
type PlayerItem = {
  id: string
  type: string
  asset_id: string | null
  duration_seconds: number
  sort_order: number
  asset?: { id, file_name, file_path, mime_type, size_bytes } | null
  // player-items RPC also returns: widget_type, widget_config
}
```
**Do not change.** Both players parse this.

### A.3 Manifest version inputs (must remain stable)

Hashed (SHA-256) by `trg_fn_precompute_manifest_version`:
```
content_type || ':' || asset_id || ':' || playlist_id || ':' || orientation || ':' || items_json
```
Any change here desyncs every device. Treat as a versioned contract.

### A.4 Realtime contract

- Channel: `playlist-broadcast-{playlistId}` (Supabase Realtime).
- Event: `refresh`, payload `{ timestamp }`.
- Web player listens; editor will listen (Phase 2). Android: treat as optional; rely on manifest version + (Phase 4) Realtime on `devices` row.

### A.5 Cache key contract (web)

- Blob cache: `caches.open('nuexis-playlist-cache')`, key `https://local-media-cache/{filePath}`. Stable across signed-URL expiry. **Preserve.**

---

## Appendix B — Key Code Paths Referenced

| Concern | Path |
|---|---|
| List page (server) | `app/customer/[team_slug]/playlists/page.tsx` |
| List page (client) | `app/customer/[team_slug]/playlists/PlaylistsClient.tsx` |
| CMS playlist actions | `app/customer/[team_slug]/playlists/actions.ts` |
| Screens / push assignment | `app/customer/[team_slug]/screens/actions.ts` (`updateDeviceAssignment`) |
| App shell / auth | `app/customer/[team_slug]/layout.tsx`, `lib/supabase/server.ts` (`getCachedUser`, `requireOwner`) |
| Global header | `app/customer/[team_slug]/components/Header.tsx` |
| Web player engine | `app/player/PlaylistEngine.tsx`, `app/player/actions.ts` |
| Android player | `apps/android-player/.../ContentSyncManager.kt`, `.../playback/PlaylistEngine.kt` |
| Toast / modals / selection | `app/components/Toast.tsx`, `lib/utils/modalStack.ts`, `lib/utils/selection.ts` |
| i18n | `lib/i18n/locales/{en,…,sv}.ts` |
| Backend RPCs (via MCP) | `create_playlist_atomic`, `update_playlist_atomic`, `get_player_manifest`, `get_player_playlist_items`, `trg_fn_precompute_manifest_version`, `notify_devices_for_playlist` |

---

*End of plan. No code, database, or migration changes have been made. This document is the sole deliverable.*
