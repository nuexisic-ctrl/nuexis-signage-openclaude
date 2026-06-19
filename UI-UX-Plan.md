# Screens & Assets — UI/UX Improvement Plan

## How to read this
This plan is a single, comprehensive roadmap for resolving visual, structural, and behavioral issues identified during the UX audit of the Screens and Assets management pages in the customer workspace dashboard. 

For each issue, we outline:
* **Problem**: A description of the current behavior and its impact on the user experience.
* **Fix approach**: The technical resolution recommended to correct the issue.
* **Files touched**: Clickable links to the affected files, including line number references where applicable.
* **Effort**: Categorized as **S** (Small, <2 hours), **M** (Medium, 2–8 hours), or **L** (Large, >8 hours).
* **Priority**: Categorized as **P0** (Critical blocker or functional bug), **P1** (Important standard/accessibility issue), or **P2** (Suboptimal visual/hierarchy tweak).

---

## Priority legend (P0/P1/P2) + effort (S/M/L)
* **P0 (Critical)**: Blockers, data integrity issues, broken features, and performance leaks that must be resolved in Phase 1.
* **P1 (High)**: Accessibility gaps, consistency issues, missing user feedback, and duplicate components to be resolved in Phase 2.
* **P2 (Medium/Low)**: visual alignment, hardcoded configuration cleanup, mobile refinements, and secondary data issues to be resolved in Phase 3.
* **Effort**:
  * **S (Small)**: Straightforward CSS adjustments, minor conditional checks, or file deletions.
  * **M (Medium)**: Component refactoring, wiring new event handlers, or adding translation keys.
  * **L (Large)**: Consolidating modules, designing unified modals, or restructuring state management.

---

## Phase roadmap (P0 → P1 → P2)

### 1. Functional Bugs (P0) — 17 issues

#### 1. Assets Filter Sidebar Options (Audio/PDF/Document/Folder) Do Nothing
* **Problem**: The advanced filter sidebar offers filters for audio, pdf, document, and folder, but selecting them returns no results because the client-side filter logic only handles images, videos, and widgets.
* **Fix approach**: Update the filter block in the assets list view to correctly check and match mime-types for folders, audios, PDFs, and general document types.
* **Files touched**: 
  * [assets/FilterSidebar.tsx:108](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/FilterSidebar.tsx#L108) (options offered)
  * [assets/AssetClient.tsx:772-776](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetClient.tsx#L772-L776) (filtering logic)
* **Effort**: S
* **Priority**: P0

#### 2. AssetTableView Sort Headers Never Wired
* **Problem**: Clicking table headers in the Asset table view triggers sort state change events inside the table, but the parent asset client never receives the events because the `sortBy` and `setSortBy` state handlers are not passed down as props.
* **Fix approach**: Pass `sortBy` and `setSortBy` from the parent client component down to the table view component.
* **Files touched**: 
  * [assets/AssetTableView.tsx:128](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetTableView.tsx#L128) (table header click handler)
  * [assets/AssetClient.tsx:1359](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetClient.tsx#L1359) (instantiation of TableView)
* **Effort**: S
* **Priority**: P0

#### 3. Screens Client "Updated Date" Sort is a Lie
* **Problem**: The sorting selector offers "Updated Date (Newest)" and "Updated Date (Oldest)", but the sorting logic falls back directly to `created_at` because the screen devices payload has no `updated_at` field.
* **Fix approach**: Rename the sort options in the dropdown and localization files to "Created Date" to align with the underlying database sort capability, or fetch the actual `updated_at` field from Supabase if available.
* **Files touched**: 
  * [screens/ScreensClient.tsx:633](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreensClient.tsx#L633) (sort options mapping)
  * [screens/ScreensClient.tsx:409-414](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreensClient.tsx#L409-L414) (sorting execution block)
* **Effort**: S
* **Priority**: P0

#### 4. Assets Client "Updated Date" Sort is a Lie
* **Problem**: The sort selector on the Assets page offers "Updated Date", but the code executes a fallback sorting using `created_at`.
* **Fix approach**: Rename the dropdown labels and UI translations to "Created Date (Newest/Oldest)" to match the true sorting behavior of the database.
* **Files touched**: 
  * [assets/AssetClient.tsx:833](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetClient.tsx#L833) (sort check logic)
  * [assets/AssetClient.tsx:1198-1200](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetClient.tsx#L1198-L1200) (dropdown options list)
* **Effort**: S
* **Priority**: P0

#### 5. Dead Code File: BulkActionsBar (Screens)
* **Problem**: The file `BulkActionsBar.tsx` is defined in the screens directory but is never imported, rendered, or referenced in the project.
* **Fix approach**: Safely remove `BulkActionsBar.tsx` and its references, or wire it up to support bulk status adjustments.
* **Files touched**: 
  * [screens/BulkActionsBar.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/BulkActionsBar.tsx) (entire file)
* **Effort**: S
* **Priority**: P0

#### 6. Dead Code File: UploadZone (Assets)
* **Problem**: The asset library defines a drag-and-drop component `UploadZone.tsx`, but it is completely unused.
* **Fix approach**: Delete the file and its associated CSS module to clean up the codebase.
* **Files touched**: 
  * [assets/UploadZone.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/UploadZone.tsx) (entire file)
  * [assets/UploadZone.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/UploadZone.module.css) (entire file)
* **Effort**: S
* **Priority**: P0

#### 7. Dead Code File: FolderContentsModal (Assets)
* **Problem**: The `FolderContentsModal.tsx` file contains duplicate modals for displaying folder listings that are never called.
* **Fix approach**: Delete this unused file.
* **Files touched**: 
  * [assets/FolderContentsModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/FolderContentsModal.tsx) (entire file)
* **Effort**: S
* **Priority**: P0

#### 8. Computed But Unrendered Status Counters (Screens)
* **Problem**: `ScreensClient.tsx` calculates `onlineCount`, `offlineCount`, and `totalPlaytimeSeconds` on every render, but these variables are never rendered in the JSX.
* **Fix approach**: Render these summary metrics in a status banner in the screens header area to provide quick diagnostic value to the user.
* **Files touched**: 
  * [screens/ScreensClient.tsx:417-419](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreensClient.tsx#L417-L419) (declarations)
* **Effort**: S
* **Priority**: P0

#### 9. Dummy "More Options" 3-Dots in GroupsSection
* **Problem**: A three-dots icon button is shown for each row in the Groups Section list, but clicking it only stops event propagation without opening a menu or triggering any action.
* **Fix approach**: Wire the button to open a dropdown context menu containing "Edit Group", "Delete Group", and "Assign Playlist" options, matching the screen card actions.
* **Files touched**: 
  * [screens/GroupsSection.tsx:471-481](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/GroupsSection.tsx#L471-L481) (unwired button)
* **Effort**: M
* **Priority**: P0

#### 10. Fabricated Device IDs in DeviceTableRow
* **Problem**: The table row shows a fake device ID formatted as `NX-xxxx-x` derived from a string slice, misleading administrators into thinking it's the official identifier.
* **Fix approach**: Display the actual UUID (truncated for space) or completely remove the fake ID field from the table columns.
* **Files touched**: 
  * [screens/DeviceTableRow.tsx:134](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeviceTableRow.tsx#L134) (fabricated ID construction)
* **Effort**: S
* **Priority**: P0

#### 11. Performance: 1s setInterval Timers in DeviceTableRow
* **Problem**: Each `DeviceTableRow` mounts its own 1-second interval timer. If a team has 100 screens, this mounts 100 separate timers running in parallel, causing excessive CPU usage and duplicate re-renders.
* **Fix approach**: Remove the local row timers. Lift relative timestamp updates to a single shared 60-second ticker at the client container level (`ScreensClient.tsx`), which fits the original throttle intent.
* **Files touched**: 
  * [screens/DeviceTableRow.tsx:51-56](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeviceTableRow.tsx#L51-L56) (1s row timer)
  * [screens/ScreensClient.tsx:31](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreensClient.tsx#L31) (unreferenced `RELATIVE_TIME_TICK_MS` ticker variable)
* **Effort**: M
* **Priority**: P0

#### 12. Bulk Move Target Folder Same-Folder Disable Bug
* **Problem**: In the Bulk Move Modal, the "Move Here" button is disabled if `selectedAssets[0]` already lives in the target folder, preventing other selected assets that are in different folders from being moved.
* **Fix approach**: Check if *all* selected assets reside in the target folder, and only disable the button if there is no net-movement for the entire selection.
* **Files touched**: 
  * [assets/BulkMoveModal.tsx:315](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/BulkMoveModal.tsx#L315) (disable rule)
* **Effort**: S
* **Priority**: P0

#### 13. PushToScreenModal Uncleaned Timeout
* **Problem**: When a push action succeeds, it sets a 700ms timeout `window.setTimeout(onSuccess, 700)` to close the modal. If the component unmounts before it fires, it leaks the timer and calls callbacks on a destroyed react element.
* **Fix approach**: Capture the timeout reference on creation and clear it inside the component's cleanup callback.
* **Files touched**: 
  * [assets/PushToScreenModal.tsx:77](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/PushToScreenModal.tsx#L77) (timeout instantiation)
* **Effort**: S
* **Priority**: P0

#### 14. Competing Optimistic Toasts in Move Operations
* **Problem**: When moving assets, an optimistic success toast is triggered immediately. If the server action subsequently fails, an error toast is launched, leaving two contradictory notifications on the screen.
* **Fix approach**: Store the toast reference and dismiss or update it when the asynchronous operation completes, or only show the toast after the operation has finished.
* **Files touched**: 
  * [assets/AssetClient.tsx:615-617](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetClient.tsx#L615-L617) (optimistic toast triggers)
* **Effort**: S
* **Priority**: P0

#### 15. Orphaned Storage Objects on DB Insertion Failures
* **Problem**: In the media upload pipeline, the file is uploaded directly to Supabase storage. If the following database insertion (`insertAsset`) fails, the storage object remains in the bucket with no DB metadata, creating orphaned storage files.
* **Fix approach**: Wrap the database transaction in a try-catch block. If `insertAsset` fails, trigger a cleanup call (`supabase.storage.from('workspace-media').remove([filePath])`) to delete the storage file.
* **Files touched**: 
  * [assets/useAssetUpload.ts:118-130](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/useAssetUpload.ts#L118-L130) (upload transaction flow)
* **Effort**: M
* **Priority**: P0

#### 16. Screens Group Filter Cookie Mismatch
* **Problem**: The group filters configuration is read from `localStorage` on initial client mount. This client-only initialization causes UI layout shifts and hydration mismatches on server-rendered layout blocks.
* **Fix approach**: Read and store state consistently using URL search params or cookie sync configurations instead of client-only local storage.
* **Files touched**: 
  * [screens/ScreensClient.tsx:145-150](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreensClient.tsx#L145-L150) (client restoration hook)
* **Effort**: M
* **Priority**: P0

#### 17. ScreenPreviewModal Uncleaned iframe Nodes
* **Problem**: When closing the Screen Preview Modal, the embedded iframe rendering the player preview is not immediately destroyed, causing the preview audio or visual state to linger for a moment.
* **Fix approach**: Ensure the iframe element is unrendered immediately upon clicking close instead of waiting for the overlay transition to finish.
* **Files touched**: 
  * [screens/ScreenPreviewModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreenPreviewModal.tsx) (render conditional check)
* **Effort**: S
* **Priority**: P0

---

### 2. Loading / Empty / Error States (P1) — 10 issues

#### 18. Missing Error Boundary Around Device Table
* **Problem**: If a single device payload is corrupt or fails to parse, the entire screens table component fails to load, showing a white screen.
* **Fix approach**: Wrap `DeviceTable` and `DeviceCard` components inside React `ErrorBoundary` components to catch errors gracefully and display a warning banner.
* **Files touched**: 
  * [screens/ScreensClient.tsx:758](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreensClient.tsx#L758) (Table invocation)
* **Effort**: M
* **Priority**: P1

#### 19. Missing Error Boundary Around Asset Grid/Table
* **Problem**: Visual exceptions on asset files (e.g. failing to render a widget preview) take down the entire Asset page.
* **Fix approach**: Wrap the asset list renderer inside a local component error boundaries container.
* **Files touched**: 
  * [assets/AssetClient.tsx:1277-1382](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetClient.tsx#L1277-L1382) (Grid/Table conditional rendering)
* **Effort**: M
* **Priority**: P1

#### 20. Screens Page Skeleton Layout Mismatch
* **Problem**: When the Screens page loading skeleton mounts, it always renders a series of table rows, even if the user has selected grid view mode.
* **Fix approach**: Conditionally render card outline skeletons or row skeletons based on the active view mode cookie.
* **Files touched**: 
  * [screens/ScreensClient.tsx:694-713](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreensClient.tsx#L694-L713) (loading block)
* **Effort**: S
* **Priority**: P1

#### 21. Assets Page Lack of Skeleton Loading State in Grid Mode
* **Problem**: The assets page loading layout does not render grid card skeletons, showing only a spinner.
* **Fix approach**: Create a skeleton component matching the asset cards and show it during assets load.
* **Files touched**: 
  * [assets/loading.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/loading.tsx) (skeleton structure)
* **Effort**: M
* **Priority**: P1

#### 22. Screens Empty State Hardcoded English Text
* **Problem**: The empty screens container uses hardcoded English text bypasses the translation system.
* **Fix approach**: Wrap all instructions inside `t()` translation tags and add keys to language resource JSON files.
* **Files touched**: 
  * [screens/ScreensClient.tsx:716-725](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreensClient.tsx#L716-L725) (empty state block)
* **Effort**: S
* **Priority**: P1

#### 23. Assets Empty State Lacks Upload Action
* **Problem**: The empty assets state tells the user to "Upload images or videos above", but lacks a direct button in the empty container itself, causing extra mouse movements.
* **Fix approach**: Add an "Upload Files" action button directly in the center of the empty state screen.
* **Files touched**: 
  * [assets/AssetClient.tsx:1265-1275](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetClient.tsx#L1265-L1275) (empty state)
* **Effort**: S
* **Priority**: P1

#### 24. No Loading Feedback During Widget Saving Actions
* **Problem**: Creating or editing widget models does not disable inputs or show a saving spinner, which can lead to double form submissions on slow connections.
* **Fix approach**: Introduce a loading state tracking variable and apply the `disabled` property to submit buttons while the request is pending.
* **Files touched**: 
  * [assets/WidgetModalsContainer.tsx:56](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/WidgetModalsContainer.tsx#L56) (widget save trigger)
* **Effort**: S
* **Priority**: P1

#### 25. Simulated Upload Progress Timer Hangs
* **Problem**: The upload progress bar increases to 90% using a random interval timer. If the actual network upload is interrupted, the progress bar remains stuck at 90% without indicating a failure.
* **Fix approach**: Use XHR upload listeners or fetch progress events to display the real file progress, and handle timeout errors properly.
* **Files touched**: 
  * [assets/useAssetUpload.ts:81-89](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/useAssetUpload.ts#L81-L89) (progress simulation block)
* **Effort**: M
* **Priority**: P1

#### 26. Websocket/Realtime Presence Disconnect Feedback Missing
* **Problem**: If the browser loses its internet connection, screens show outdated statuses (online/offline) without warning the operator that the connection was lost.
* **Fix approach**: Show a connection status indicator on the screens page if the real-time presence channel drops.
* **Files touched**: 
  * [screens/useDevicePresence.ts](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/useDevicePresence.ts) (realtime channel hooks)
* **Effort**: M
* **Priority**: P1

#### 27. Screen Groups Empty State Lacks Action Button
* **Problem**: When a workspace has no screen groups, the groups section shows "No groups created yet" but has no button to create one there.
* **Fix approach**: Add a "Create Group" button inside the groups section empty state.
* **Files touched**: 
  * [screens/GroupsSection.tsx:324-332](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/GroupsSection.tsx#L324-L332) (empty state block)
* **Effort**: S
* **Priority**: P1

---

### 3. Accessibility (P1) — 16 issues

#### 28. Keyboard Navigation: DeviceCard Lack of Focus and Key Handlers
* **Problem**: Screen cards are not reachable using keyboard Tab controls and do not support activation triggers.
* **Fix approach**: Add `tabIndex={0}` to the outer card elements, set focus styles, and add an `onKeyDown` handler to trigger modal details on `Enter`/`Space`.
* **Files touched**: 
  * [screens/DeviceCard.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeviceCard.tsx) (outer div structure)
* **Effort**: S
* **Priority**: P1

#### 29. Keyboard Navigation: AssetCard Lack of Focus and Key Handlers
* **Problem**: Asset grid cards cannot be focused or opened via keyboard shortcuts.
* **Fix approach**: Add `tabIndex={0}`, standard focus outline styles, and keydown activation triggers to match the list table controls.
* **Files touched**: 
  * [assets/AssetCard.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetCard.tsx) (outer div wrapper)
* **Effort**: S
* **Priority**: P1

#### 30. Screens Global Checkbox Lacks Keyboard Focus Rings
* **Problem**: The global select checkbox does not show a focus ring when tabbed onto, making it hard to see keyboard focus.
* **Fix approach**: Add focus styling rules (e.g. `:focus-visible`) in the checkbox module files.
* **Files touched**: 
  * [screens/ScreensClient.tsx:510](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreensClient.tsx#L510) (input element)
* **Effort**: S
* **Priority**: P1

#### 31. Assets Global Checkbox Lacks Keyboard Focus Rings
* **Problem**: The bulk selection checkbox on the Assets page has no keyboard focus ring.
* **Fix approach**: Apply focus style modifiers in the global select CSS block.
* **Files touched**: 
  * [assets/AssetClient.tsx:1035](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetClient.tsx#L1035) (input element)
* **Effort**: S
* **Priority**: P1

#### 32. Custom Select Dropdowns Lack Arrow Navigation
* **Problem**: Custom select dropdowns (e.g., group filters) can be opened with the keyboard but do not support selection using arrow keys.
* **Fix approach**: Implement keyboard event handlers (`ArrowUp`/`ArrowDown`/`Escape`) in the select components.
* **Files touched**: 
  * [screens/GroupFilterDropdown.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/GroupFilterDropdown.tsx) (dropdown select logic)
* **Effort**: M
* **Priority**: P1

#### 33. FilterSidebar Options Lack Keyboard Support
* **Problem**: The filters panel doesn't support keyboard traps, allowing keyboard focus to escape behind the panel.
* **Fix approach**: Implement focus traps inside the sidebar slideout block when it is active.
* **Files touched**: 
  * [assets/FilterSidebar.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/FilterSidebar.tsx) (sidebar container)
* **Effort**: M
* **Priority**: P1

#### 34. PairModal Focus Trap Missing
* **Problem**: Opening the pairing modal does not trap keyboard focus, allowing users to tab onto background items.
* **Fix approach**: Implement a focus trap utility or use a library to capture focus when the modal opens, returning it to the trigger button when closed.
* **Files touched**: 
  * [screens/PairModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/PairModal.tsx) (modal wrapper)
* **Effort**: M
* **Priority**: P1

#### 35. AssignModal Focus Trap Missing
* **Problem**: The content assignment modal allows focus to escape, breaking accessibility guidelines.
* **Fix approach**: Wrap the layout in a focus trapping container and focus the first element on open.
* **Files touched**: 
  * [screens/AssignModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/AssignModal.tsx) (modal wrapper)
* **Effort**: M
* **Priority**: P1

#### 36. Screens RenameModal Focus Trap Missing
* **Problem**: Rename dialog does not capture keyboard tabs, making it hard to use with a keyboard.
* **Fix approach**: Implement a focus trap.
* **Files touched**: 
  * [screens/RenameModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/RenameModal.tsx) (modal element)
* **Effort**: M
* **Priority**: P1

#### 37. Screens DeleteModal Focus Trap Missing
* **Problem**: The screen deletion confirmation modal does not trap keyboard focus.
* **Fix approach**: Wrap the delete modal in a focus trap.
* **Files touched**: 
  * [screens/DeleteModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeleteModal.tsx) (modal element)
* **Effort**: M
* **Priority**: P1

#### 38. PushToScreenModal Focus Trap Missing
* **Problem**: When pushing assets to screens, the modal doesn't prevent focus from escaping.
* **Fix approach**: Apply a keyboard focus trap.
* **Files touched**: 
  * [assets/PushToScreenModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/PushToScreenModal.tsx) (modal shell)
* **Effort**: M
* **Priority**: P1

#### 39. BulkMoveModal Focus Trap Missing
* **Problem**: The folder navigation tree inside the move modal does not capture focus.
* **Fix approach**: Capture and trap focus.
* **Files touched**: 
  * [assets/BulkMoveModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/BulkMoveModal.tsx) (modal shell)
* **Effort**: M
* **Priority**: P1

#### 40. CreateFolderModal Focus Trap Missing
* **Problem**: The folder creation popover does not trap focus.
* **Fix approach**: Trap focus when modal mounts.
* **Files touched**: 
  * [assets/CreateFolderModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/CreateFolderModal.tsx) (dialog component)
* **Effort**: M
* **Priority**: P1

#### 41. Decorative Icons Lack aria-hidden Attributes
* **Problem**: Many decorative Lucide icons lack `aria-hidden="true"`, causing screen readers to read their names, which disrupts navigation.
* **Fix approach**: Add `aria-hidden="true"` to all decorative icons on both pages.
* **Files touched**: 
  * [screens/DeviceTableRow.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeviceTableRow.tsx) (table row icons)
  * [assets/AssetCard.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetCard.tsx) (media icons)
* **Effort**: S
* **Priority**: P1

#### 42. Asset Table Thumbnails Lack Descriptive Alt Tags
* **Problem**: Asset thumbnail image elements use empty string alt tags (`alt=""`), which makes it hard for screen readers to identify them.
* **Fix approach**: Populate the alt tag with the asset file name, like `alt={asset.file_name}`.
* **Files touched**: 
  * [assets/AssetTableView.tsx:255](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetTableView.tsx#L255) (thumbnail img element)
* **Effort**: S
* **Priority**: P1

#### 43. Device Table Clickable Row Lack Enter Activation
* **Problem**: Clicking a screen row opens edit mode, but the row lacks `role="button"` and keyboard event triggers like `onKeyDown` for Enter.
* **Fix approach**: Add `role="button"` and keyboard handler to the row.
* **Files touched**: 
  * [screens/DeviceTableRow.tsx:101](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeviceTableRow.tsx#L101) (table row element)
* **Effort**: S
* **Priority**: P1

---

### 4. Consistency & Deduplication (P1) — 24 issues

#### 44. Modal Shell Overlay z-index Divergence
* **Problem**: Screens modals use `z-index: 200` while Assets modals use `z-index: 1000`. This divergence makes stacked dialogs inconsistent.
* **Fix approach**: Unify all modal shells under a single CSS file with standardized stacking orders.
* **Files touched**: 
  * [screens/Modal.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/Modal.module.css) (overlay styles)
  * [assets/Modal.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/Modal.module.css) (overlay styles)
* **Effort**: M
* **Priority**: P1

#### 45. Modal Overlay Design Divergence
* **Problem**: The overlay backdrop styles differ between pages (Screens uses solid dark gray, Assets uses blurred glassmorphism), creating an inconsistent user experience.
* **Fix approach**: Standardize backdrop color and blur values inside a shared modal stylesheet.
* **Files touched**: 
  * [screens/Modal.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/Modal.module.css)
  * [assets/Modal.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/Modal.module.css)
* **Effort**: S
* **Priority**: P1

#### 46. Redundant Modal styling files
* **Problem**: Modals repeatedly define redundant container styles in two separate directories, increasing bundle size.
* **Fix approach**: Implement a unified, shared `<Modal>` shell component inside `components/` and import it on both pages.
* **Files touched**: 
  * [screens/Modal.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/Modal.module.css) (screens modal css)
  * [assets/Modal.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/Modal.module.css) (assets modal css)
* **Effort**: M
* **Priority**: P1

#### 47. Redundant EmptyState implementations
* **Problem**: The empty state UI is redefined 6 times across pages using different class names, margin heights, and icon sizes.
* **Fix approach**: Create a single reusable `<EmptyState>` component supporting title, description, icon, and optional action buttons.
* **Files touched**: 
  * [screens/ScreensClient.tsx:716](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreensClient.tsx#L716)
  * [assets/AssetClient.tsx:1266](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetClient.tsx#L1266)
  * [screens/GroupsSection.tsx:324](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/GroupsSection.tsx#L324)
* **Effort**: M
* **Priority**: P1

#### 48. Divergent FilterSidebar implementations
* **Problem**: Screens and Assets use duplicate sidebar components with different animation styles.
* **Fix approach**: Refactor the sidebar structure into a unified container component that accepts filter controls as children.
* **Files touched**: 
  * [screens/FilterSidebar.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/FilterSidebar.tsx) (Screens filter panel)
  * [assets/FilterSidebar.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/FilterSidebar.tsx) (Assets filter panel)
* **Effort**: L
* **Priority**: P1

#### 49. Pagination Controls Duplication
* **Problem**: Screens and Assets implement duplicate footer layout elements with minor style differences.
* **Fix approach**: Build a unified pagination component to ensure consistent spacing, margins, and page selection layout.
* **Files touched**: 
  * [screens/ScreensClient.tsx:782-831](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreensClient.tsx#L782-L831)
  * [assets/AssetClient.tsx:1385-1435](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetClient.tsx#L1385-L1435)
* **Effort**: M
* **Priority**: P1

#### 50. Multiple YoutubeIcon Definitions
* **Problem**: `YoutubeIcon` is declared separately in `AssetTableView.tsx` and `AssetCard.tsx` instead of being shared.
* **Fix approach**: Move the YouTube SVG icon definition to a shared icons library or folder.
* **Files touched**: 
  * [assets/AssetTableView.tsx:13](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetTableView.tsx#L13)
  * [assets/AssetCard.tsx:11](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetCard.tsx#L11)
* **Effort**: S
* **Priority**: P1

#### 51. Duplicate Widget Icon Map Definitions
* **Problem**: Icon mapping arrays for rendering widget types (digital clocks, countdowns, html editors) are declared in both `DeviceIcon.tsx` and `AssetTableView.tsx`.
* **Fix approach**: Export a single helper object from `DeviceIcon.tsx` and reuse it.
* **Files touched**: 
  * [screens/DeviceIcon.tsx:375](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeviceIcon.tsx#L375)
  * [assets/AssetTableView.tsx:250-285](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetTableView.tsx#L250-L285)
* **Effort**: S
* **Priority**: P1

#### 52. Duplicate PRESET_COLORS
* **Problem**: The list of preset colors is defined separately in the folder dialog and group dialog files.
* **Fix approach**: Move color lists to a shared config file.
* **Files touched**: 
  * [assets/ActionModals.tsx:7](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/ActionModals.tsx#L7)
  * [screens/GroupEditModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/GroupEditModal.tsx)
* **Effort**: S
* **Priority**: P1

#### 53. Duplicate File Validation Constraints
* **Problem**: Max size limit (50MB) and file type validations are defined separately in `useAssetUpload.ts` and `validators.ts`.
* **Fix approach**: Import validation functions from `validators.ts` to ensure consistent file size and extension checks.
* **Files touched**: 
  * [assets/useAssetUpload.ts:10-21](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/useAssetUpload.ts#L10-L21)
  * [assets/validators.ts](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/validators.ts)
* **Effort**: S
* **Priority**: P1

#### 54. Redundant handleDownload helpers
* **Problem**: The logic to generate signed URLs and trigger browser downloads is duplicated between cards and table views.
* **Fix approach**: Move the download handler to a shared utility helper function.
* **Files touched**: 
  * [assets/AssetTableView.tsx:105-118](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetTableView.tsx#L105-L118)
  * [assets/AssetCard.tsx:76-89](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetCard.tsx#L76-L89)
* **Effort**: S
* **Priority**: P1

#### 55. Inconsistent Overlay Click Behavior
* **Problem**: Some modal dialogs close when the user clicks the overlay background, while others do not, creating an inconsistent user experience.
* **Fix approach**: Apply a standard overlay click dismiss behavior across all modals.
* **Files touched**: 
  * [assets/ActionModals.tsx:100](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/ActionModals.tsx#L100)
  * [screens/DeleteModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeleteModal.tsx)
* **Effort**: S
* **Priority**: P1

#### 56. Translation Gaps in Screens BulkActionsBar
* **Problem**: `BulkActionsBar.tsx` uses hardcoded English text.
* **Fix approach**: Wrap all text in `t()` functions.
* **Files touched**: 
  * [screens/BulkActionsBar.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/BulkActionsBar.tsx) (hardcoded strings)
* **Effort**: S
* **Priority**: P1

#### 57. Translation Gaps in Assets ActionModals
* **Problem**: Asset rename and delete dialogs do not support translations, displaying only English.
* **Fix approach**: Import the `useTranslation` hook and wrap all UI text in `t()` translation keys.
* **Files touched**: 
  * [assets/ActionModals.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/ActionModals.tsx) (hardcoded strings)
* **Effort**: S
* **Priority**: P1

#### 58. Hardcoded status labels in DeviceIcon
* **Problem**: Status badge labels are capitalized using hardcoded JS formatting, bypassing translations.
* **Fix approach**: Map status labels using translation keys.
* **Files touched**: 
  * [screens/DeviceIcon.tsx:684](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeviceIcon.tsx#L684)
* **Effort**: S
* **Priority**: P1

#### 59. Hardcoded relative timestamps in formatLastSeen
* **Problem**: Words like "just now", "ago", and "Never" are hardcoded, bypassing localization.
* **Fix approach**: Use parametrized translation keys like `t('Seen {time} ago')` inside the formatting function.
* **Files touched**: 
  * [screens/DeviceIcon.tsx:690-711](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeviceIcon.tsx#L690-L711)
* **Effort**: M
* **Priority**: P1

#### 60. Inconsistent Close Button aria-labels
* **Problem**: Close buttons use different screen reader labels ("Close", "Close modal", etc.) across modals.
* **Fix approach**: Standardize all modal close buttons to use a consistent `aria-label={t('Close')}`.
* **Files touched**: 
  * [assets/PushToScreenModal.tsx:100](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/PushToScreenModal.tsx#L100)
  * [assets/BulkMoveModal.tsx:174](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/BulkMoveModal.tsx#L174)
* **Effort**: S
* **Priority**: P1

#### 61. Inconsistent Filename Truncation
* **Problem**: Some views use the `FilenameTruncator` component while others truncate names using manual JS slice calculations, creating visual discrepancies.
* **Fix approach**: Standardize filename truncation across all tables and cards using the `<FilenameTruncator>` component.
* **Files touched**: 
  * [assets/AssetTableView.tsx:288](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetTableView.tsx#L288)
* **Effort**: S
* **Priority**: P1

#### 62. Inconsistent Table Border styling
* **Problem**: Tables on the screens and assets pages use different border colors (Screens uses theme tokens, Assets uses hardcoded hex values), leading to visual inconsistency.
* **Fix approach**: Standardize table border styles using the global theme variable `--outline-variant`.
* **Files touched**: 
  * [assets/AssetTableView.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetTableView.module.css)
  * [screens/DeviceTableRow.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeviceTableRow.module.css)
* **Effort**: S
* **Priority**: P1

#### 63. Success pulse indicator duplication
* **Problem**: Spin/pulse animations are defined in separate CSS modules instead of using global animation helpers.
* **Fix approach**: Move animation styles to global theme classes.
* **Files touched**: 
  * [assets/asset.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/asset.module.css)
  * [screens/screens.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/screens.module.css)
* **Effort**: S
* **Priority**: P1

#### 64. Divergent Table Hover styles
* **Problem**: Hover styles on table rows differ between screens and assets.
* **Fix approach**: Standardize table row hover effects using the shared variable `--surface-low` on both pages.
* **Files touched**: 
  * [assets/AssetTableView.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetTableView.module.css)
  * [screens/DeviceTableRow.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeviceTableRow.module.css)
* **Effort**: S
* **Priority**: P1

#### 65. Inconsistent Selected Item Badge styles
* **Problem**: Count badges for selected screens and assets use different CSS classes and positions.
* **Fix approach**: Unify selection badges to use the same CSS layout on both pages.
* **Files touched**: 
  * [screens/SelectedActions.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/SelectedActions.tsx)
  * [assets/AssetClient.tsx:1133-1138](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetClient.tsx#L1133-L1138)
* **Effort**: S
* **Priority**: P1

#### 66. Drag-and-Drop Drop Target Border style
* **Problem**: Drop target styling triggers are inconsistent (assets uses dashed borders, screens does not show drop outlines).
* **Fix approach**: Add consistent border styling when an item is dragged over a folder or group row.
* **Files touched**: 
  * [assets/AssetTableView.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetTableView.module.css)
* **Effort**: S
* **Priority**: P1

#### 67. Divergent Refresh Loading Icons
* **Problem**: The manual refresh button uses different rotation spin animations on the screens and assets pages.
* **Fix approach**: Unify rotation animation rules in the shared CSS configuration.
* **Files touched**: 
  * [assets/asset.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/asset.module.css)
  * [screens/screens.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/screens.module.css)
* **Effort**: S
* **Priority**: P1

---

### 5. Missing Feedback & UX Flows (P1) — 13 issues

#### 68. Uploads Lack Network ETA / Transfer Speed Indicators
* **Problem**: When uploading large video assets, users only see a percentage progress indicator, with no ETA or transfer speed info.
* **Fix approach**: Calculate upload speed (bytes per second) using XHR progress events and show the remaining time.
* **Files touched**: 
  * [assets/useAssetUpload.ts:56](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/useAssetUpload.ts#L56) (upload item schema)
* **Effort**: M
* **Priority**: P1

#### 69. Drag-and-Drop Active Overlay missing
* **Problem**: Dragging files over the Asset page does not show a visual drop zone overlay, so it's not clear where files can be dropped.
* **Fix approach**: Render a translucent overlay with drop instructions when files are dragged anywhere over the page.
* **Files touched**: 
  * [assets/AssetClient.tsx:883-888](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetClient.tsx#L883-L888) (drop listeners)
* **Effort**: M
* **Priority**: P1

#### 70. Active Screen Deletion Warning missing
* **Problem**: The delete screen modal lets users delete active screens without warning them if the screen is currently online and active.
* **Fix approach**: Check if the target device is online or actively running, and show a warning message if it is.
* **Files touched**: 
  * [screens/DeleteModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeleteModal.tsx)
* **Effort**: S
* **Priority**: P1

#### 71. Screen Group Creation Post-Action highlight missing
* **Problem**: Creating a new group from selected screens closes the dialog but does not focus, highlight, or select the newly created group, forcing users to search for it.
* **Fix approach**: Auto-select or scroll to the new group in the UI list after creation.
* **Files touched**: 
  * [screens/ScreensModals.tsx:870-880](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreensModals.tsx#L870-L880) (success triggers)
* **Effort**: S
* **Priority**: P1

#### 72. Empty Playlist Assignment Warning missing
* **Problem**: Operators can assign empty playlists (playlists with no items or assets) to screens without receiving a warning, leading to black screen errors.
* **Fix approach**: Check the playlist item count and show a warning message before allowing assignment.
* **Files touched**: 
  * [screens/AssignModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/AssignModal.tsx)
* **Effort**: S
* **Priority**: P1

#### 73. Folder Creation Dialog Lacks Focus
* **Problem**: Opening the new folder dialog does not focus the name input field in all browsers, forcing users to click it manually.
* **Fix approach**: Add an `autoFocus` property to the text input element inside the CreateFolder modal component.
* **Files touched**: 
  * [assets/CreateFolderModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/CreateFolderModal.tsx)
* **Effort**: S
* **Priority**: P1

#### 74. Bulk Delete Lacks Batch Progress Feedback
* **Problem**: Deleting multiple files at once shows a generic pending indicator, with no feedback on how many assets have been deleted.
* **Fix approach**: Update the bulk delete confirmation dialog to show deletion progress (e.g., "Deleting 2 of 5 assets...").
* **Files touched**: 
  * [assets/BulkDeleteModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/BulkDeleteModal.tsx)
* **Effort**: S
* **Priority**: P1

#### 75. Screen Renaming Input validation missing
* **Problem**: The screen renaming input field does not validate names inline, allowing users to submit empty spaces or names that are too long.
* **Fix approach**: Add inline validation to disable the submit button if the name is invalid.
* **Files touched**: 
  * [screens/RenameModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/RenameModal.tsx)
* **Effort**: S
* **Priority**: P1

#### 76. Push to Screen Confirmation toast is Sender-Only
* **Problem**: Pushing content to a screen shows a success toast to the sender, but does not send a real-time event to confirm receipt on the target screen.
* **Fix approach**: Add a broadcast acknowledgment event to confirm when the player has successfully received the update.
* **Files touched**: 
  * [assets/PushToScreenModal.tsx:70](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/PushToScreenModal.tsx#L70) (push asset callback)
* **Effort**: M
* **Priority**: P1

#### 77. Real-Time Update Layout Shifts
* **Problem**: When a screen's status updates, the grid layout shifts items briefly, which is visually disruptive.
* **Fix approach**: Apply CSS layout properties (`content-visibility` or fixed heights) to prevent layout shifts when card contents change.
* **Files touched**: 
  * [screens/screens.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/screens.module.css)
* **Effort**: M
* **Priority**: P1

#### 78. Inconsistent Widget Download UX
* **Problem**: The download action is shown for widget assets, but clicking it fails or does nothing because widgets are configuration metadata rather than download files.
* **Fix approach**: Hide the download option for widget assets, or display a warning explaining how widgets are used.
* **Files touched**: 
  * [assets/AssetTableView.tsx:400](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetTableView.tsx#L400) (Download item logic)
* **Effort**: S
* **Priority**: P1

#### 79. Folder Deletion Warning missing
* **Problem**: Deleting a folder does not warn the user about what will happen to nested assets, which can lead to accidental data loss.
* **Fix approach**: Add a warning detailing the number of nested files that will be moved to the root folder.
* **Files touched**: 
  * [assets/ActionModals.tsx:272](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/ActionModals.tsx#L272) (Delete message body)
* **Effort**: S
* **Priority**: P1

#### 80. Screen Content History missing
* **Problem**: Screen details only show the currently active content, with no history of previously assigned playlists.
* **Fix approach**: Read and display a list of recently assigned playlists in the screen details tab.
* **Files touched**: 
  * [screens/ScreenPreviewModal.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreenPreviewModal.tsx)
* **Effort**: M
* **Priority**: P1

---

### 6. Information Density & Hierarchy (P2) — 4 issues

#### 81. Excess Table Column Spacing on Large Screens
* **Problem**: The screens and assets tables use default spacing, which stretches content excessively on 1080p and larger screens.
* **Fix approach**: Set max-widths on non-expanding columns and add responsive paddings to make tables easier to scan.
* **Files touched**: 
  * [assets/AssetTableView.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetTableView.module.css)
  * [screens/DeviceTableRow.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeviceTableRow.module.css)
* **Effort**: S
* **Priority**: P2

#### 82. Long File Names Stretch Card Layouts Unevenly
* **Problem**: Long file names wrap in the card view, causing cards to have different heights and breaking the grid alignment.
* **Fix approach**: Use CSS to truncate file names to a single line with an ellipsis (`text-overflow: ellipsis`), and show the full name on hover.
* **Files touched**: 
  * [assets/AssetCard.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetCard.module.css)
* **Effort**: S
* **Priority**: P2

#### 83. Redundant Status Badge indicators in Table Rows
* **Problem**: Device table rows show both a status badge column ("Online") and a status dot column ("Active Now"), which is redundant.
* **Fix approach**: Unify these indicators into a single, clean column to free up table space.
* **Files touched**: 
  * [screens/DeviceTableRow.tsx:141-152](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeviceTableRow.tsx#L141-L152) (badge vs dot render blocks)
* **Effort**: S
* **Priority**: P2

#### 84. Folder Cards lack visual distinction
* **Problem**: Folder cards are the same size as media cards, making it hard to quickly distinguish folders from files in the grid view.
* **Fix approach**: Style folder cards to be shorter and visually distinct, helping users understand the directory structure at a glance.
* **Files touched**: 
  * [assets/AssetCard.tsx:202-207](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetCard.tsx#L202-L207) (folder thumbnail block)
* **Effort**: M
* **Priority**: P2

---

### 7. Hard-coded Values (P2) — 4 issues

#### 85. Hardcoded Screens List Refresh Interval
* **Problem**: The Screens list uses a hardcoded refresh interval, making it difficult to adjust the refresh rate based on network conditions.
* **Fix approach**: Move this value to the global configuration file (`lib/config`).
* **Files touched**: 
  * [screens/ScreensClient.tsx:31](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreensClient.tsx#L31) (interval constant)
* **Effort**: S
* **Priority**: P2

#### 86. Hardcoded Max Upload Size limit
* **Problem**: The 50MB file size limit is hardcoded in the upload hook, which makes it difficult to adjust if the server limits change.
* **Fix approach**: Move the file limit to the global environment configuration (`next.config`).
* **Files touched**: 
  * [assets/useAssetUpload.ts:10](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/useAssetUpload.ts#L10) (size limits check)
* **Effort**: S
* **Priority**: P2

#### 87. Hardcoded Size Filter Preset options
* **Problem**: The size filter options (1MB, 10MB, 50MB) are hardcoded, making it difficult to change them if standard file sizes increase.
* **Fix approach**: Define the filter presets in a central configuration file.
* **Files touched**: 
  * [assets/FilterSidebar.tsx:158-162](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/FilterSidebar.tsx#L158-L162) (presets list)
* **Effort**: S
* **Priority**: P2

#### 88. Hardcoded Preview URL Expiry duration
* **Problem**: The signed preview URL expiry is hardcoded to 3600 seconds, which might be too long or short for some security requirements.
* **Fix approach**: Use an environment variable or configuration value to set the signed URL duration.
* **Files touched**: 
  * [assets/AssetClient.tsx:679](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetClient.tsx#L679) (expiry parameter)
* **Effort**: S
* **Priority**: P2

---

### 8. Mobile Responsiveness (P2) — 11 issues

#### 89. Bottom Navigation Bar overlaps Table Controls on Mobile
* **Problem**: On small screens, the bottom navigation bar overlaps the page controls and pagination buttons, blocking clicks.
* **Fix approach**: Add bottom padding (`padding-bottom: 72px`) to the table footer container when the mobile view layout is active.
* **Files touched**: 
  * [assets/asset.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/asset.module.css)
  * [screens/screens.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/screens.module.css)
* **Effort**: S
* **Priority**: P2

#### 90. Device Table Horizontal Overflow issues on mobile
* **Problem**: The screens table overflows horizontally on screens narrower than 768px, causing layout issues.
* **Fix approach**: Wrap the table in a container with overflow scrolling (`overflow-x: auto`) and fix column widths.
* **Files touched**: 
  * [screens/DeviceTable.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeviceTable.tsx)
* **Effort**: S
* **Priority**: P2

#### 91. Asset Table Horizontal Overflow issues on mobile
* **Problem**: The Asset table overflows horizontally on mobile devices.
* **Fix approach**: Add an overflow container to allow smooth swiping on smaller screens.
* **Files touched**: 
  * [assets/AssetTableView.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetTableView.tsx) (wrapper element)
* **Effort**: S
* **Priority**: P2

#### 92. Filter Sidebar Mobile Layout issues
* **Problem**: The filter sidebar has a fixed width of 320px, which covers almost the entire screen on mobile phones, leaving no context.
* **Fix approach**: Set the sidebar width to 100% on screens smaller than 480px, and adjust margins.
* **Files touched**: 
  * [assets/FilterSidebar.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/FilterSidebar.module.css)
  * [screens/FilterSidebar.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/FilterSidebar.module.css)
* **Effort**: S
* **Priority**: P2

#### 93. Modals Not Converting to Full Screen Sheets on Mobile
* **Problem**: Modals retain their fixed desktop dimensions on mobile, pushing buttons off-screen and requiring vertical scrolling.
* **Fix approach**: Add media queries to style modals as full-screen sheets on mobile, stacking buttons vertically.
* **Files touched**: 
  * [screens/Modal.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/Modal.module.css)
  * [assets/Modal.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/Modal.module.css)
* **Effort**: M
* **Priority**: P2

#### 94. Touch Targets for Table Action buttons are too small
* **Problem**: Edit and delete buttons in the table view are only 24px wide, making them difficult to tap accurately on touch screens.
* **Fix approach**: Increase the touch target area of action buttons to at least 44px by adding padding.
* **Files touched**: 
  * [screens/DeviceTableRow.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeviceTableRow.module.css)
  * [assets/AssetTableView.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetTableView.module.css)
* **Effort**: S
* **Priority**: P2

#### 95. Pairing Action Button hard to reach on Mobile
* **Problem**: The "Add Screen" pairing button is located at the top of the page, which is hard to reach on mobile.
* **Fix approach**: Render a floating action button (FAB) at the bottom right of the screen for pairing on mobile.
* **Files touched**: 
  * [screens/ScreensClient.tsx:475](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreensClient.tsx#L475)
* **Effort**: M
* **Priority**: P2

#### 96. Grid Cards Stretch too wide in Single Column Layouts
* **Problem**: On screens narrower than 480px, the grid layout drops to a single column, stretching cards excessively and distorting thumbnails.
* **Fix approach**: Limit the maximum card width and center the cards within the mobile container.
* **Files touched**: 
  * [assets/AssetCard.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetCard.module.css)
  * [screens/DeviceCard.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/DeviceCard.module.css)
* **Effort**: S
* **Priority**: P2

#### 97. Screen Groups horizontal scroll is difficult to swipe
* **Problem**: Screen groups do not support native swiping, making horizontal navigation difficult on mobile.
* **Fix approach**: Enable smooth momentum scrolling (`-webkit-overflow-scrolling: touch`) on the horizontal groups container.
* **Files touched**: 
  * [screens/GroupsSection.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/GroupsSection.module.css)
* **Effort**: S
* **Priority**: P2

#### 98. Top Action Toolbar wraps into multi-line blocks on mobile
* **Problem**: The toolbar buttons wrap into multiple lines on mobile, creating an untidy layout that covers content.
* **Fix approach**: Wrap action buttons in an overflow menu or arrange them in a compact, scrollable row.
* **Files touched**: 
  * [screens/screens.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/screens.module.css)
  * [assets/asset.module.css](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/asset.module.css)
* **Effort**: M
* **Priority**: P2

#### 99. Floating Upload Panel covers too much Mobile screen
* **Problem**: The floating upload panel covers 80% of the screen on mobile, blocking the rest of the app.
* **Fix approach**: Minimize the upload panel to a simple progress bar at the top or bottom of the screen on mobile.
* **Files touched**: 
  * [assets/UploadPanel.tsx](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/UploadPanel.tsx)
* **Effort**: M
* **Priority**: P2

---

### 9. Logic & Data Integrity (P2) — 4 issues

#### 100. Circular Folder Reference loops in Breadcrumbs
* **Problem**: If there are corrupt parent folder IDs in the database, the breadcrumbs loop can run indefinitely, crashing the browser.
* **Fix approach**: Add a loop limit check to break the loop if the hierarchy depth exceeds a safe limit (e.g. 50 levels).
* **Files touched**: 
  * [assets/AssetClient.tsx:475-485](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetClient.tsx#L475-L485) (breadcrumbs resolving loop)
* **Effort**: S
* **Priority**: P2

#### 101. Websocket Connection Leaks on Page transition
* **Problem**: Supabase presence subscriptions do not always clean up properly when navigating away, which can lead to connection leaks.
* **Fix approach**: Ensure the `unsubscribe` cleanup method is called reliably inside the `useEffect` return block.
* **Files touched**: 
  * [screens/useDevicePresence.ts](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/useDevicePresence.ts) (realtime subscription cleanup)
* **Effort**: S
* **Priority**: P2

#### 102. Optimistic Update Rollback failure when offline
* **Problem**: Moving items optimistic updates apply changes instantly in the UI. If the client is offline, the operation fails silently without rolling back the UI changes, leaving the list in an incorrect state.
* **Fix approach**: Add a network status check and trigger an immediate rollback if the network request fails.
* **Files touched**: 
  * [assets/AssetClient.tsx:625-635](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/assets/AssetClient.tsx#L625-L635) (move callback response handler)
* **Effort**: S
* **Priority**: P2

#### 103. Playtime calculations lack Negative validation
* **Problem**: Negative playtime metrics (e.g. from corrupt player diagnostic payloads) can reduce the total playtime sum, leading to incorrect reporting.
* **Fix approach**: Validate playtime metrics to ensure they are greater than or equal to zero before adding them.
* **Files touched**: 
  * [screens/ScreensClient.tsx:419](file:///C:/Users/nikhi/Downloads/Projects/Digital-Signage-Openclaude/app/customer/%5Bteam_slug%5D/screens/ScreensClient.tsx#L419) (playtime sum calculation)
* **Effort**: S
* **Priority**: P2
