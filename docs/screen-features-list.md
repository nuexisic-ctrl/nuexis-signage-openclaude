# Screens Page — Small Feature Improvements List

A living list of **small, incremental features** to improve the Screens page
(`app/customer/[team_slug]/screens/`). Each item is intentionally bite-sized
(a dot, a chip, a shortcut, a column) so it can be picked up and shipped
independently. Bigger refactors are intentionally excluded.

> Status legend: 🔴 not started · 🟡 in progress · 🟢 done (move as you ship)

---

## 1. Status & Stats Badges

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 1.1 | **Clickable stat badges** — clicking the green "Online" / grey "Offline" count badge in the header instantly filters the list to that status (toggle off on second click). | `ScreensClient.tsx` header stats | 🔴 |
| 1.2 | **Percentage uptime chip** — small "98% up" pill next to each stat badge, computed from `total_playtime_seconds` vs age. | header stats | 🔴 |
| 1.3 | **Stale-device warning dot** — a small amber dot on cards/rows for screens offline for >7 days, so truly dormant devices stand out from recently-disconnected ones. | `DeviceCard`, `DeviceTableRow` | 🔴 |
| 1.4 | **"Never seen" flag** — screens with `last_seen_at === null` get a subtle "Never connected" tag distinct from regular offline. | `DeviceIcon.tsx` (`formatLastSeen`) | 🔴 |
| 1.5 | **Pairing pulse** — screens in `pairing` status show a gently pulsing indicator (currently a static badge). | `StatusBadge` | 🔴 |

---

## 2. Filters & Search

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 2.1 | **Active-filter chips bar** — render removable chips (e.g. `Status: Online ✕`, `Group: Lobby ✕`) under the controls bar so users can clear one filter at a time without opening the sidebar. | `ScreensClient.tsx` | 🔴 |
| 2.2 | **"No content" filter** — add an *Assigned / Unassigned* option to the status filter to quickly find screens with nothing playing. | `FilterSidebar.tsx` | 🔴 |
| 2.3 | **Content-type filter** — filter by kind (Image, Video, Playlist, Clock, YouTube, etc.) using the existing `getContentKind`. | `FilterSidebar.tsx` | 🔴 |
| 2.4 | **Clear-search (✕) button** — add an inline X inside the search box to clear it in one click. | search box | 🔴 |
| 2.5 | **Search by group name** — extend search matching to include the names of groups a screen belongs to (not just name/status). | `filteredDevices` memo | 🔴 |
| 2.6 | **Search match highlighting** — bold/highlight the matched substring inside screen names while searching. | `DeviceCard`, `DeviceTableRow` | 🔴 |
| 2.7 | **Filter count badge on the Filters button** — show a number (e.g. `Filters (3)`) instead of just a dot when filters are active. | filter button | 🔴 |
| 2.8 | **"Last seen" date filter** — mirror the "Date Added" filter for last-seen, to find dormant screens by activity. | `FilterSidebar.tsx` | 🔴 |

---

## 3. Sort Options

Currently only *Created Date* and *Name* are sortable. Add:

| # | Feature | Status |
|---|---------|--------|
| 3.1 | **Sort by Last Seen** (most → least recent) — the single most useful missing sort for finding disconnected screens. | 🔴 |
| 3.2 | **Sort by Status** (online first). | 🔴 |
| 3.3 | **Sort by Total Playtime** (most active first). | 🔴 |
| 3.4 | **Sort by Content type**. | 🔴 |
| 3.5 | **Remember sort choice** in `localStorage` (like view mode & page size already are). | 🔴 |

---

## 4. Card & Table Visual Polish

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 4.1 | **Orientation badge** — a tiny rotation icon (↻ 90°) on cards/rows whose orientation ≠ 0, so rotated screens are obvious at a glance. | `DeviceCard`, `DeviceTableRow` | 🔴 |
| 4.2 | **Group badges in table rows** — the grid card shows group pills; the table row currently doesn't. Mirror them. | `DeviceTableRow.tsx` | 🔴 |
| 4.3 | **Empty-content visual treatment** — cards/rows with no assigned content get a subtle dashed border or muted styling so unassigned screens are easy to spot. | `DeviceCard.module.css` | 🔴 |
| 4.4 | **"New" pill** — screens added within the last 48h get a small `New` pill next to their name. | `DeviceCard`, `DeviceTableRow` | 🔴 |
| 4.5 | **Relative "Added" time** — card shows absolute date; add a hover/secondary relative line ("Added 3 days ago"). | `DeviceCard.tsx` | 🔴 |
| 4.6 | **Scale-mode chip** — small `Fit`/`Stretch`/`Zoom` chip on the card meta (data is already fetched, just not surfaced). | `DeviceCard.tsx` | 🔴 |
| 4.7 | **App/OS version in tooltip** — surface `app_version` / `os_version` (already queried) via the content tooltip or a dedicated info hover. | `DeviceIcon.tsx` | 🔴 |
| 4.8 | **Density toggle** — comfortable vs compact card sizing for users with many screens. | view toggle group | 🔴 |

---

## 5. Selection & Bulk Actions

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 5.1 | **Bulk Assign content** — add an "Assign" action to `SelectedActions` to push the same asset/playlist to many screens at once. | `SelectedActions.tsx` | 🔴 |
| 5.2 | **Bulk Rename (pattern)** — rename many screens with a pattern like `Lobby-{n}`. | `SelectedActions.tsx` | 🔴 |
| 5.3 | **Bulk Move to group** — add/remove selected screens from a group in one action. | `SelectedActions.tsx` | 🔴 |
| 5.4 | **Indeterminate select-all checkbox** — show the mixed (−) state when *some* (not all) screens are selected. | global select checkbox | 🔴 |
| 5.5 | **Selection summary line** — "3 of 12 screens selected · Online: 2, Offline: 1" for context. | `SelectedActions.tsx` | 🔴 |
| 5.6 | **Sticky bulk-action bar** — when scrolled, keep the selected-actions bar pinned so bulk ops are always reachable. | `SelectedActions.tsx` | 🔴 |

---

## 6. Keyboard & Accessibility

| # | Feature | Status |
|---|---------|--------|
| 6.1 | **`Ctrl/Cmd+A`** — select all screens (scoped to the list). | 🔴 |
| 6.2 | **`Escape`** — clear the current selection. | 🔴 |
| 6.3 | **`/`** — focus the search box. | 🔴 |
| 6.4 | **Arrow keys** — move focus between cards/rows. | 🔴 |
| 6.5 | **`R`** — trigger refresh (with modifier to avoid hijacking typing). | 🔴 |
| 6.6 | **Keyboard shortcut hints** — show tiny hints in tooltips on the filter/sort/refresh buttons. | 🔴 |

---

## 7. Data Freshness & Realtime

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 7.1 | **"Last updated Xs ago"** next to the refresh button so users know how stale the data is. | header refresh button | 🔴 |
| 7.2 | **Manual reconnect button** in the connection-lost banner (currently just a message). | connection error banner | 🔴 |
| 7.3 | **Soft toast on status change** — when a screen flips online↔offline in real-time, show a brief non-blocking toast. | `useDevicePresence.ts` | 🔴 |
| 7.4 | **Online-count live pulse** — the "Online" stat badge briefly pulses when the count changes. | header stats | 🔴 |

---

## 8. Table-Specific

| # | Feature | Status |
|---|---------|--------|
| 8.1 | **Sticky header row** — keep column headers visible while scrolling long lists. | 🔴 |
| 8.2 | **Copy device-ID button** — the `ID: XXXXXXXX` cell becomes click-to-copy with a toast. | 🔴 |
| 8.3 | **Per-device playtime column** — add a column (or hover info) for individual `total_playtime_seconds`. | 🔴 |
| 8.4 | **Column toggle** — let users hide/show columns they don't need (content, last seen, etc.). | 🔴 |
| 8.5 | **Sortable column headers** — click a column header to sort by it (ties into §3). | 🔴 |
| 8.6 | **Row hover quick-actions** — reveal Preview/Edit icons on row hover instead of always relying on the actions cell. | 🔴 |

---

## 9. Empty States & Onboarding

| # | Feature | Status |
|---|---------|--------|
| 9.1 | **"No results" with clear-filters CTA** — when filters yield nothing, show a "Clear all filters" button in the empty state. | 🔴 |
| 9.2 | **Suggested next steps** in the first-run empty state (pair a screen → assign content → group it). | 🔴 |
| 9.3 | **Empty-groups hint** — if there are zero groups, show a one-line nudge to create one. | 🔴 |

---

## 10. Miscellaneous Niceties

| # | Feature | Status |
|---|---------|--------|
| 10.1 | **Card hover quick-actions** — Preview / Edit buttons fade in on card hover. | 🔴 |
| 10.2 | **Mini activity sparkline** — tiny last-24h activity bar on each card (stretch goal). | 🔴 |
| 10.3 | **Portrait/landscape card aspect** — grid card aspect ratio reflects the screen's orientation. | 🔴 |
| 10.4 | **Toast on copy** — confirm clipboard actions with a toast (pairs with 8.2). | 🔴 |
| 10.5 | **"Jump to top" button** — appears after scrolling for long lists. | 🔴 |
| 10.6 | **Drag handle for manual order** — custom user-defined ordering persisted per team. | 🔴 |

---

### Suggested order of attack (highest value, smallest effort first)

1. **3.1** Sort by Last Seen · **2.1** Filter chips · **1.1** Clickable stat badges
2. **4.1** Orientation badge · **4.2** Group badges in table · **4.3** Empty-content treatment
3. **5.1** Bulk Assign · **6.1–6.3** Core keyboard shortcuts
4. **7.1** Last-updated timestamp · **7.2** Reconnect button
5. Everything else, cherry-picked per sprint.

*Add new ideas to the relevant section as they come up. Mark items 🟢 when shipped and move them to the bottom of their section to keep pending work at the top.*
