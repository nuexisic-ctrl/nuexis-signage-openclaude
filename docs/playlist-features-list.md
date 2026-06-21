# Playlists Page — Small Feature Improvements List

A living list of **small, incremental features** to improve the Playlists experience
(`app/customer/[team_slug]/playlists/`). This covers **both** the list page
(`PlaylistsClient.tsx`) **and** the workspace detail page
(`[playlistId]/PlaylistWorkspace.tsx`). Each item is intentionally bite-sized so
it can be picked up and shipped independently. Bigger refactors are excluded.

> Status legend: 🔴 not started · 🟡 in progress · 🟢 done (move as you ship)

---

## 0. Consistency Fixes (quick wins)

These are small inconsistencies worth fixing before adding net-new features.

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 0.1 | **Unify "Campaign" vs "Playlist" wording** — Unified wording under the term "Playlist" everywhere. | `WorkspaceHeader.tsx`, `PlaylistWorkspace.tsx` | 🟢 |
| 0.2 | **Remove artificial refresh delay** — `handleRefresh` has a hardcoded `await new Promise(resolve => setTimeout(resolve, 550))` that makes refresh feel sluggish for no benefit. | `PlaylistsClient.tsx` | 🔴 |
| 0.3 | **Sortable columns in table** — unlike the Assets table, playlist columns aren't clickable to sort. Add sort to the table headers (ties into §3). | `PlaylistsClient.tsx` table | 🔴 |

---

## 1. List Page — Metadata & Surfacing Data

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 1.1 | **"Assigned to N screens" on each card/row** — the list query fetches items & duration but not screen assignments; show how many screens use each playlist so users can spot unused ones. Requires adding device assignment to the list query. | `PlaylistsClient.tsx` | 🔴 |
| 1.2 | **"Unused" indicator** — a subtle muted styling or badge for playlists assigned to 0 screens. | grid card / table row | 🔴 |
| 1.3 | **Item-type breakdown chip** — on each card, a tiny summary like `3 img · 2 vid · 1 clock` so the content mix is visible before opening. Data is partly there via items. | grid card | 🔴 |
| 1.4 | **Thumbnail strip on card** — instead of a generic `ListVideo` icon, show a small 2–4 thumbnail preview of the first few image/video items (mirrors what Assets does). | grid card | 🔴 |
| 1.5 | **Relative time consistency** — grid uses `formatRelativeTime`, table also uses it; created date in the table is raw `toISOString().split('T')[0]`. Standardize formatting. | table created date | 🔴 |
| 1.6 | **Color dot on table row** — grid shows the playlist color via icon border; the table also does, but add a small explicit color dot near the name for stronger recognition. | table row | 🔴 |
| 1.7 | **"New" pill** — playlists created/updated within 48h get a small `New`/`Updated` pill. | card / row | 🔴 |

---

## 2. List Page — Filters & Search

The list page has **no filter sidebar** (unlike Screens and Assets) and only name search.

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 2.1 | **Advanced Filter sidebar** — port the shared `FilterSidebar` pattern used by Screens/Assets: filter by assigned/unassigned, item count range, creation date, color. | `PlaylistsClient.tsx` | 🔴 |
| 2.2 | **Filter by assignment** — *Assigned* / *Unassigned* / *All* (most useful for cleanup). | filter sidebar | 🔴 |
| 2.3 | **Filter by color** — quick color-swatch filter to group visually-tagged playlists. | filter sidebar | 🔴 |
| 2.4 | **Clear-search (✕) button** — the search box has no clear button; add an inline X. | search box | 🔴 |
| 2.5 | **Search match highlighting** — bold the matched substring in playlist names. | card / row | 🔴 |
| 2.6 | **Search by item content** — extend search to match the names of assets within a playlist, not just the playlist name. | `filteredPlaylists` memo | 🔴 |
| 2.7 | **Active-filter chips bar** — removable chips under the controls bar to clear one filter at a time. | `PlaylistsClient.tsx` | 🔴 |

---

## 3. List Page — Sort Options

Currently no sort dropdown exists; the list is always newest-created first.

| # | Feature | Status |
|---|---------|--------|
| 3.1 | **Add a Sort dropdown** matching the Screens/Assets pattern (icon + menu). | 🔴 |
| 3.2 | **Sort by Last Updated** (most useful — surfaces recently edited playlists). | 🔴 |
| 3.3 | **Sort by Total Duration** / **Item Count**. | 🔴 |
| 3.4 | **Sort by Name** (A-Z / Z-A). | 🔴 |
| 3.5 | **Sort by Screen assignments** (most/least used). | 🔴 |
| 3.6 | **Remember sort choice** in `localStorage` (like view mode & page size). | 🔴 |

---

## 4. List Page — Bulk Actions & Selection

The list page currently has **no multi-select** at all (Screens and Assets both do).

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 4.1 | **Multi-select on cards/rows** — checkboxes + shift-range selection, matching the Screens/Assets pattern. | `PlaylistsClient.tsx` | 🔴 |
| 4.2 | **Bulk Delete** — delete several playlists at once with a confirm dialog. | bulk action bar | 🔴 |
| 4.3 | **Bulk Duplicate** — duplicate several playlists at once. | bulk action bar | 🔴 |
| 4.4 | **Bulk Push to screens** — assign a set of playlists to a screen group. | bulk action bar | 🔴 |
| 4.5 | **Bulk color change** — recolor a selection for visual grouping. | bulk action bar | 🔴 |
| 4.6 | **Select-all dropdown** (All / None) matching Screens/Assets. | global select | 🔴 |
| 4.7 | **Selection summary line** — "3 of 12 playlists selected". | bulk action bar | 🔴 |

---

## 5. List Page — Card & Table Polish

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 5.1 | **More menu per card** — grid cards only expose Delete; add a "..." menu with Duplicate / Push / Rename (open) / Delete to match the workspace. | grid card | 🔴 |
| 5.2 | **Duplicate from list** — currently only available inside the workspace; add a Duplicate action on the card/row. | card / row | 🔴 |
| 5.3 | **Rename from list** — inline rename via a menu action instead of opening the workspace. | card / row | 🔴 |
| 5.4 | **Hover quick-actions on card** — Preview / Open icons fade in on hover. | grid card | 🔴 |
| 5.5 | **Row hover quick-actions in table** — reveal Open/Duplicate icons on hover. | table row | 🔴 |
| 5.6 | **Empty state CTA** — the empty state has no "New Playlist" button; add one to match other pages' empty states. | empty state | 🔴 |
| 5.7 | **Density toggle** — comfortable vs compact cards. | view toggle | 🔴 |

---

## 6. List Page — Header & Stats

| # | Feature | Status |
|---|---------|--------|
| 6.1 | **Stats badges** — show total playlists, total items, and aggregate duration in the header (Screens has online/offline/playtime badges). | 🔴 |
| 6.2 | **"Last refreshed Xs ago"** next to the refresh button. | 🔴 |
| 6.3 | **Total storage used** across all playlist media (ties to workspace's per-playlist size). | 🔴 |

---

## 7. Workspace — Items Table

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 7.1 | **Thumbnail strip / filmstrip view** — an optional visual timeline of items with proportional widths based on duration, great for seeing the loop at a glance. | `PlaylistTable.tsx` | 🔴 |
| 7.2 | **Show item dimensions/size** — each row has Name/Type/Duration; add a subtle file size or dimensions secondary line. | `PlaylistTable.tsx` | 🔴 |
| 7.3 | **Duplicate item** — currently you can remove but not duplicate a row; add a "duplicate" action to clone an item. | `PlaylistTable.tsx` | 🔴 |
| 7.4 | **Move item to top / bottom** — quick buttons to jump an item to the start/end of the loop. | `PlaylistTable.tsx` | 🔴 |
| 7.5 | **Keyboard arrows to reorder** — when a row is focused, `Alt+↑/↓` moves it up/down. | `PlaylistTable.tsx` | 🔴 |
| 7.6 | **Per-item preview thumbnail size** — the 36px thumb is small; allow a larger hover preview. | `PlaylistTable.tsx` | 🔴 |
| 7.7 | **Drag handle affordance** — rows are draggable but show no `GripVertical` handle; add a visible handle column (`GripVertical` is already imported but unused). | `PlaylistTable.tsx` | 🔴 |
| 7.8 | **Duration presets dropdown** — instead of typing seconds, offer presets (5s, 10s, 15s, 30s, 1m). | duration cell | 🔴 |
| 7.9 | **Inline edit of multiple durations** — the batch bar sets one duration for all selected; add "apply to each" vs "distribute total" mode. | batch bar | 🔴 |

---

## 8. Workspace — Preview & Playback

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 8.1 | **Widget rendering in preview** — `PlaylistPreview` only plays image/video items and skips widgets; render clock/countdown/etc. in the preview for an accurate loop simulation. | `PlaylistPreview.tsx` | 🔴 |
| 8.2 | **Scrubber / seek** — the preview has play/pause/skip; add a draggable scrubber to jump to any item. | `PlaylistPreview.tsx` | 🔴 |
| 8.3 | **Playback speed** — 0.5×/1×/2× to quickly review long loops. | `PlaylistPreview.tsx` | 🔴 |
| 8.4 | **Loop count indicator** — show how many times the loop has played during the preview session. | `PlaylistPreview.tsx` | 🔴 |
| 8.5 | **Current-item highlight** — highlight which table row is currently playing in the preview (sync table ↔ preview). | `PlaylistTable.tsx` + preview | 🔴 |
| 8.6 | **Fullscreen preview** — expand the preview to fill the viewport. | `PlaylistPreview.tsx` | 🔴 |
| 8.7 | **Orientation toggle in preview** — simulate landscape vs portrait playback. | `PlaylistPreview.tsx` | 🔴 |

---

## 9. Workspace — Header & Save

| # | Feature | Status |
|---|---------|--------|
| 9.1 | **"Save now" button** — auto-save runs after 3s, but there's no explicit manual Save button (only Ctrl+S); surface one for discoverability. | 🔴 |
| 9.2 | **Discard changes** — with auto-save there's no easy "revert to last saved"; add a Discard action using `lastPersistedRef`. | 🔴 |
| 9.3 | **Unsaved-changes navigation guard** — warn before leaving with unsaved changes (auto-save mitigates this, but a guard helps during the 3s window). | 🔴 |
| 9.4 | **Last-saved timestamp** — show "Saved 2m ago" alongside the status dot. | 🔴 |
| 9.5 | **Version history / revisions** — the workspace tracks `playlistVersion` for concurrency; expose a lightweight history to view/restore past versions. | 🔴 |
| 9.6 | **Collaborator presence** — show who else is editing this playlist in real-time (ties to the concurrency version field). | 🔴 |

---

## 10. Workspace — Add Content & Asset Picker

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 10.1 | **Add widgets directly** — items can be images/videos via the asset browser, but widgets (clock, countdown, etc.) aren't addable from the workspace; allow inserting widgets. | `PlaylistWorkspace.tsx` | 🔴 |
| 10.2 | **Default duration for new items** — new items default to 10s; add a setting/default (e.g. remember last-used duration). | `handleAssetsSelected` | 🔴 |
| 10.3 | **Duplicate-detection on add** — warn if an asset already exists in the playlist to avoid accidental double-adds. | `handleAssetsSelected` | 🔴 |
| 10.4 | **Multi-folder asset browse** — confirm the picker can navigate folders to pick across the library. | `AssetBrowserModal` | 🔴 |
| 10.5 | **Recently-added assets first** — in the picker, surface recently uploaded assets for quick reuse. | `AssetBrowserModal` | 🔴 |
| 10.6 | **Drag assets from picker into table** — drag-and-drop from the asset browser directly into a specific position. | `PlaylistTable.tsx` | 🔴 |

---

## 11. Workspace — Bulk Actions Bar

| # | Feature | Status |
|---|---------|--------|
| 11.1 | **Bulk reorder** — move a selection of items up/down or to top/bottom together. | 🔴 |
| 11.2 | **Bulk duplicate** — duplicate the selected items in place. | 🔴 |
| 11.3 | **Bulk type-specific duration** — e.g. "set all videos to 30s, all images to 8s". | 🔴 |
| 11.4 | **Sticky batch bar** — keep the batch bar pinned when scrolling long playlists. | 🔴 |
| 11.5 | **Bulk export** — export selected items as a new playlist (subset extraction). | 🔴 |

---

## 12. Push to Screen

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 12.1 | **Show current assignment state** — in the modal, mark which screens already have this playlist vs will be newly assigned vs will be unassigned. | `PushToScreenModal.tsx` | 🔴 |
| 12.2 | **Unassign option** — allow removing the playlist from screens, not just adding. | `PushToScreenModal.tsx` | 🔴 |
| 12.3 | **Screen status indicators** — show online/offline dots next to each screen in the push modal so users know which will actually update. | `PushToScreenModal.tsx` | 🔴 |
| 12.4 | **Select all online** — quick action to push to all currently-online screens. | `PushToScreenModal.tsx` | 🔴 |
| 12.5 | **Push confirmation summary** — before applying, show "Will assign to 3 screens, remove from 1". | `PushToScreenModal.tsx` | 🔴 |
| 12.6 | **Group push** — push to a screen group instead of picking screens one by one. | `PushToScreenModal.tsx` | 🔴 |

---

## 13. Keyboard & Accessibility

The workspace already has Ctrl+Z/Y/S. Add:

| # | Feature | Status |
|---|---------|--------|
| 13.1 | **`Ctrl/Cmd+A`** — select all items (workspace) / playlists (list). | 🔴 |
| 13.2 | **`Delete`** — remove selected items (workspace). | 🔴 |
| 13.3 | **`Space`** — play/pause the preview when it's open. | 🔴 |
| 13.4 | **`Esc`** — clear selection / close preview. | 🔴 |
| 13.5 | **`/`** — focus search (list page). | 🔴 |
| 13.6 | **`N`** — new playlist (list page). | 🔴 |
| 13.7 | **Keyboard shortcut hints** — tooltips on Undo/Redo already exist; extend to Preview/Push/Save. | 🔴 |

---

## 14. Empty States & Onboarding

| # | Feature | Status |
|---|---------|--------|
| 14.1 | **List empty-state CTA** — add a "New Playlist" button to the empty list state (currently just text). | 🔴 |
| 14.2 | **First-run guidance** — suggest a starter workflow: create → add media → preview → push. | 🔴 |
| 14.3 | **Workspace empty-state hints** — the empty table has an "Add Media" button; add a secondary hint about widgets once supported. | 🔴 |
| 14.4 | **Template library** — pre-built playlist templates (e.g. "Morning loop", "Menu board") to start from. | 🔴 |

---

## 15. Miscellaneous Niceties

| # | Feature | Status |
|---|---------|--------|
| 15.1 | **Favorites / pin** — pin frequently-edited playlists to the top of the list. | 🔴 |
| 15.2 | **Tags / labels** — user-defined tags for cross-cutting grouping beyond color. | 🔴 |
| 15.3 | **Playlist description / notes** — an optional notes field for internal context (per playlist). | 🔴 |
| 15.4 | **Copy as** — duplicate a playlist's structure into a new one with a different name prompt. | 🔴 |
| 15.5 | **Export playlist** — download the playlist definition (JSON) for backup/sharing. | 🔴 |
| 15.6 | **Total loop count / playtime** — show estimated daily playtime ("This loop plays ~480×/day"). | 🔴 |
| 15.7 | **Scheduling hint** — note that playlists run continuously; link to schedule feature if available. | 🔴 |
| 15.8 | **"Jump to top" button** — appears after scrolling long item lists. | 🔴 |

---

### Suggested order of attack (highest value, smallest effort first)

1. **0.1** Unified Campaign/Playlist wording · **0.2** Remove artificial refresh delay · **0.3 + 3.1** Sort dropdown + sortable columns
2. **1.1** "Assigned to N screens" · **5.1** More menu per card · **5.6** Empty-state CTA
3. **2.1/2.2** Filter sidebar with assigned/unassigned · **4.1/4.2** Multi-select + bulk delete
4. **8.1** Widget rendering in preview · **9.1** Explicit Save button
5. Everything else, cherry-picked per sprint.

*Add new ideas to the relevant section as they come up. Mark items 🟢 when shipped and move them to the bottom of their section to keep pending work at the top.*
