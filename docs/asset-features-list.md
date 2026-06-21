# Assets Page — Small Feature Improvements List

A living list of **small, incremental features** to improve the Assets page
(`app/customer/[team_slug]/assets/`). Each item is intentionally bite-sized
(a dot, a chip, a shortcut, a column) so it can be picked up and shipped
independently. Bigger refactors are intentionally excluded.

> Status legend: 🔴 not started · 🟡 in progress · 🟢 done (move as you ship)

---

## 1. Metadata & Surfacing Data

The asset object already carries `size_bytes`, `mime_type`, `created_at`, `color`, `folder_id` — but most of it isn't surfaced in the UI.

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 1.1 | **File size on the card** — the grid card meta currently shows only date + a type icon; add the human-readable size (e.g. `2.4 MB`) next to the date. `formatBytes` already exists in `types.ts`. | `AssetCard.tsx` | 🔴 |
| 1.2 | **File size column in the table** — the table has Name / Type / Date but no Size column. Add a right-aligned, sortable Size column. | `AssetTableView.tsx` | 🔴 |
| 1.3 | **Video duration badge** — show duration (e.g. `0:45`) on the video thumbnail corner (read from the `<video>` metadata that's already loaded for thumbnails). | `AssetCard.tsx`, `AssetTableView.tsx` | 🔴 |
| 1.4 | **Image dimensions chip** — hover or small chip showing `1920×1080` for images (cheap to read from the loaded thumbnail). | `AssetCard.tsx` | 🔴 |
| 1.5 | **"In use on N screens" indicator** — small chip/badge on each asset showing how many screens currently display it (cross-reference with devices). Helps spot assets that are safe to delete. | `AssetCard.tsx`, `AssetTableView.tsx` | 🔴 |
| 1.6 | **MIME-type tooltip** — hovering the type icon shows the full `mime_type` (the badge already has a `title`, extend it to show the friendly name + mime). | `AssetCard.tsx`, `AssetTableView.tsx` | 🔴 |
| 1.7 | **Relative "added" time** — show "Added 3 days ago" as a secondary line or hover, complementing the absolute date. | `AssetCard.tsx` | 🔴 |
| 1.8 | **Widget config summary** — for widget assets, show a one-line config summary (e.g. clock style, YouTube URL, countdown date) under the name. | `AssetCard.tsx` | 🔴 |

---

## 2. Storage & Quota

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 2.1 | **Total storage usage** — header shows asset *count*; add total size used (e.g. `1.2 GB across 47 assets`), computed by summing `size_bytes`. | `AssetClient.tsx` header | 🔴 |
| 2.2 | **Storage progress bar** — if a plan/quota limit is known, show a thin usage bar in the header. | header | 🔴 |
| 2.3 | **Per-folder size** — folders display an item count; add aggregate size of all contained files. | breadcrumbs / `AssetCard` folder view | 🔴 |
| 2.4 | **Largest-assets view** — a one-click preset (sort or filter) to surface the biggest files, useful for cleanup. | sort dropdown | 🔴 |
| 2.5 | **Folder item count badge** — folders currently show no count; add an `N` badge so empty vs full folders are obvious. | `AssetCard.tsx` (folder variant) | 🔴 |

---

## 3. Filters & Search

The page already has type/date/size filters and a search box with a clear (✕) button. Gaps:

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 3.1 | **Active-filter chips bar** — render removable chips (e.g. `Type: Video ✕`, `Size: >10MB ✕`) under the controls bar so users clear one filter at a time without opening the sidebar. | `AssetClient.tsx` | 🔴 |
| 3.2 | **"In use / Unused" filter** — filter to assets that are (or aren't) currently assigned to any screen — key for cleanup. | `FilterSidebar.tsx` | 🔴 |
| 3.3 | **Sort-by-size** option — the grid sort dropdown offers Created Date + Name only; add Size (largest/smallest). The table supports size via column sort but the dropdown doesn't. | sort dropdown | 🔴 |
| 3.4 | **Search by folder name** — extend search to match folder names and the current path, not just file names. | `filteredAssets` memo | 🔴 |
| 3.5 | **Search match highlighting** — bold the matched substring inside file names while searching. | `AssetCard`, `AssetTableView` | 🔴 |
| 3.6 | **Filter count badge on Filters button** — show a number (e.g. `Filters (2)`) instead of just a dot. | filter button | 🔴 |
| 3.7 | **Cross-folder search toggle** — when searching, currently scoped to the active folder; add a "search all folders" toggle for global search. | search box | 🔴 |
| 3.8 | **Duplicate detection** — surface assets with identical file names or matching sizes as a "Possible duplicates" filter. | `FilterSidebar.tsx` | 🔴 |

---

## 4. Sort Options

| # | Feature | Status |
|---|---------|--------|
| 4.1 | **Sort by Size** in the grid dropdown (largest/smallest first). | 🔴 |
| 4.2 | **Sort by Type** in the grid dropdown (group images, videos, widgets…). The table has it; the dropdown doesn't. | 🔴 |
| 4.3 | **Sort by "In use" / usage** — most-used assets first. | 🔴 |
| 4.4 | **Remember sort choice** in `localStorage` (like view mode & page size already are). | 🔴 |
| 4.5 | **Folders-first toggle** — folders always sort to the top currently; add a toggle to interleave them by date. | 🔴 |

---

## 5. Card & Table Visual Polish

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 5.1 | **Color dot/tag for folder color** — folders support a `color` but it's only visible as icon stroke; add a small visible color dot near the name for quick recognition. | `AssetCard.tsx` | 🔴 |
| 5.2 | **"New" pill** — assets added within the last 48h get a small `New` pill on the card/row. | `AssetCard`, `AssetTableView` | 🔴 |
| 5.3 | **Hover quick-actions on card** — Preview / Push / Download icons fade in on card hover, instead of requiring the "more" menu. | `AssetCard.tsx` | 🔴 |
| 5.4 | **Aspect-correct thumbnails** — video/image thumbnails are cover-cropped; add a hover "fit" that shows the true aspect ratio. | `AssetCard.tsx` | 🔴 |
| 5.5 | **Empty-folder visual treatment** — folders with 0 items get a muted/empty look so they stand out from populated ones. | `AssetCard.tsx` | 🔴 |
| 5.6 | **Density toggle** — comfortable vs compact card sizing for users with many assets. | view toggle group | 🔴 |
| 5.7 | **Group-by-type strip** — optional grouping header that clusters assets by type (Images, Videos, Widgets…) in the grid. | grid layout | 🔴 |

---

## 6. Folders & Organization

| # | Feature | Status |
|---|---------|--------|
| 6.1 | **Folder color picker on create** — `CreateFolderModal` should let you pick a color (the schema supports `color`). | 🔴 |
| 6.2 | **Rename / recolor folder** — extend rename modal to also edit the folder color. | 🔴 |
| 6.3 | **Folder tree / sidebar** — a collapsible folder tree on the side for deep hierarchies, instead of breadcrumbs-only navigation. | 🔴 |
| 6.4 | **Breadcrumb overflow** — long paths currently render fully; collapse middle segments into `…` with a dropdown. | 🔴 |
| 6.5 | **"Up one level" button** — explicit back button next to breadcrumbs (currently only breadcrumb clicks). | 🔴 |
| 6.6 | **Move folder into folder via drag** — folders are drop targets for files, but allow nesting folders into folders by drag too. | 🔴 |
| 6.7 | **Empty-folder count in breadcrumb** — show item counts on breadcrumb segments. | 🔴 |
| 6.8 | **Multi-select move via breadcrumb drop** — already supported; surface a hint/toast confirming target. | 🔴 |

---

## 7. Selection & Bulk Actions

Currently supports bulk **Move** and **Delete**. Gaps:

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 7.1 | **Bulk Download** — download selected files as a zip (or sequentially). | `selectedActionsContainer` | 🔴 |
| 7.2 | **Bulk Push to screens** — push a selection of assets to a screen (or several screens) at once. | `selectedActionsContainer` | 🔴 |
| 7.3 | **Bulk Rename (pattern)** — rename a selection with a pattern like `Playlist-{n}`. | `selectedActionsContainer` | 🔴 |
| 7.4 | **Bulk Add to Playlist** — create or append to a playlist from the selected assets. | `selectedActionsContainer` | 🔴 |
| 7.5 | **Indeterminate select-all checkbox** — show the mixed (−) state when *some* (not all) assets are selected. | global select checkbox | 🔴 |
| 7.6 | **Selection summary line** — "4 of 20 items selected · 12.3 MB · Videos: 3, Images: 1". | `selectedActionsContainer` | 🔴 |
| 7.7 | **Sticky bulk-action bar** — keep the selected-actions bar pinned when scrolled. | `selectedActionsContainer` | 🔴 |
| 7.8 | **Bulk move-to-folder autocomplete** — in `BulkMoveModal`, add a search/typeahead for the folder picker. | `BulkMoveModal.tsx` | 🔴 |

---

## 8. Upload Experience

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 8.1 | **Paste-to-upload** — support `Ctrl/Cmd+V` to paste image/video from clipboard directly into the library. | `AssetClient.tsx` | 🔴 |
| 8.2 | **Accept more types** — file input accepts `jpeg,png,mp4,webm,pdf`; consider `image/webp`, `image/gif`, `image/avif`, `mov`, `audio/*`. | file input + `validators.ts` | 🔴 |
| 8.3 | **Drag-onto-folder upload** — dragging files over a *folder card* uploads them into that folder (currently drops onto page → active folder only). | `AssetCard.tsx` (folder) | 🔴 |
| 8.4 | **Upload speed / ETA** — the upload panel shows progress; add KB/s and estimated time remaining per file. | `UploadPanel.tsx` | 🔴 |
| 8.5 | **Retry failed uploads** — a one-click retry button on failed items in the upload queue. | `UploadPanel.tsx` | 🔴 |
| 8.6 | **Duplicate-name handling** — warn or auto-suffix when uploading a file with a name that already exists in the folder. | `useAssetUpload.ts` | 🔴 |
| 8.7 | **Upload-to-current-folder hint** — when inside a folder, the drop overlay should clarify "Upload to *FolderName*". | drop overlay | 🔴 |
| 8.8 | **Cancel in-progress upload** — allow cancelling an upload mid-flight (queue currently supports waiting/cancelled states only loosely). | `UploadPanel.tsx` | 🔴 |

---

## 9. Preview & Actions

| # | Feature | Status |
|---|---------|--------|
| 9.1 | **Next/Previous in preview** — `AssetPreviewModal` is single-asset; add ◀ ▶ to step through the current view. | 🔴 |
| 9.2 | **Preview keyboard nav** — arrow keys to move between assets, `Esc` to close, space to play/pause video. | 🔴 |
| 9.3 | **Download from preview** — add a Download button inside the preview modal. | 🔴 |
| 9.4 | **Push-to-screen from preview** — add Push inside the preview modal so users don't close→reopen. | 🔴 |
| 9.5 | **Copy asset URL** — a "copy link" action (signed URL) for sharing/embedding. | 🔴 |
| 9.6 | **Multi-screen push** — `PushToScreenModal` selects one screen; allow pushing to several screens at once. | 🔴 |
| 9.7 | **Replace asset** — "Replace file" action that swaps the underlying file while keeping the same ID/assignments. | 🔴 |

---

## 10. Keyboard & Accessibility

| # | Feature | Status |
|---|---------|--------|
| 10.1 | **`Ctrl/Cmd+A`** — select all assets in the current view. | 🔴 |
| 10.2 | **`Escape`** — clear the current selection (search already does this). | 🔴 |
| 10.3 | **`/`** — focus the search box. | 🔴 |
| 10.4 | **`U`** — open the upload file picker (with modifier to avoid hijacking). | 🔴 |
| 10.5 | **`Backspace`** — navigate up one folder level. | 🔴 |
| 10.6 | **Arrow keys** — move focus between cards/rows; `Enter` opens, `Space` toggles select (Space already works on focused card/row). | 🔴 |
| 10.7 | **Keyboard shortcut hints** — tiny hints in tooltips on the upload/filter/sort buttons. | 🔴 |

---

## 11. Empty States & Onboarding

| # | Feature | Status |
|---|---------|--------|
| 11.1 | **"No results" with clear-filters CTA** — when filters yield nothing, show a "Clear all filters" button. | 🔴 |
| 11.2 | **First-run onboarding steps** — in the truly-empty library, suggest: Upload media → Organize into folders → Create a widget → Push to a screen. | 🔴 |
| 11.3 | **Empty-folder guidance** — empty folders should show "Drag files here or click Upload" inside, not just rely on the page empty state. | 🔴 |
| 11.4 | **Suggested widgets** — when clicking "Create Widget", show visual cards for each widget type with a short description. | 🔴 |

---

## 12. Table-Specific

| # | Feature | Status |
|---|---------|--------|
| 12.1 | **Sticky header row** — keep column headers visible while scrolling long lists. | 🔴 |
| 12.2 | **Sortable Size column** — ties to §1.2; clicking the Size header sorts by `size_bytes`. | 🔴 |
| 12.3 | **Column toggle** — let users hide/show columns they don't need (Date, Type, etc.). | 🔴 |
| 12.4 | **Row hover quick-actions** — reveal Push/Preview icons on row hover. | 🔴 |
| 12.5 | **Sticky selection checkbox column** — keep the checkbox column pinned when horizontally scrolling. | 🔴 |
| 12.6 | **Sort indicator consistency** — table uses `▲/▼` text; consider icon arrows matching the design system. | 🔴 |

---

## 13. Miscellaneous Niceties

| # | Feature | Status |
|---|---------|--------|
| 13.1 | **Favorites / star** — star frequently-used assets and add a "Favorites" quick filter. | 🔴 |
| 13.2 | **Tags / labels** — user-defined tags on assets for flexible grouping beyond folders. | 🔴 |
| 13.3 | **Recently-used sort** — sort by last time the asset was pushed/displayed. | 🔴 |
| 13.4 | **"Jump to top" button** — appears after scrolling for long lists. | 🔴 |
| 13.5 | **Copy file name** — click-to-copy the asset name with a toast. | 🔴 |
| 13.6 | **Asset count in tab title** — show `(47)` next to "Asset Library" for at-a-glance context. | 🔴 |
| 13.7 | **Thumbnail lazy-loading guard** — ensure offscreen thumbnails don't all fetch signed URLs eagerly (perf for large libraries). | 🔴 |
| 13.8 | **Dark/light thumbnail background** — for transparent PNGs, a checkerboard background in the thumbnail so transparency is visible. | 🔴 |

---

### Suggested order of attack (highest value, smallest effort first)

1. **1.1 + 1.2** Surface file size (card + table) · **3.1** Filter chips · **2.1** Total storage usage
2. **7.1** Bulk Download · **7.5** Indeterminate checkbox · **4.1** Sort by size
3. **8.1** Paste-to-upload · **9.1** Next/Previous in preview
4. **2.5 + 6.1** Folder count badge + folder color
5. Everything else, cherry-picked per sprint.

*Add new ideas to the relevant section as they come up. Mark items 🟢 when shipped and move them to the bottom of their section to keep pending work at the top.*
