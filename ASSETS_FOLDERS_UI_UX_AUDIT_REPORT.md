# Assets & Folders UI/UX Audit — Improvements & Fixes

Scope: `app/customer/[team_slug]/asset/*` (Assets library and folder views).  
Note: Per request, changes were implemented via code audit and reasoning (no app run / visual QA pass in a browser session).

## Key outcomes (high impact)

### UI improvements made
- **Unified top action buttons (Upload / New Folder / Create Widget)** into consistent, reusable CSS classes (`.topbarActionBtn`, `.topbarPrimaryBtn`) to match the design system and reduce inline-style drift.
- **Improved filter button affordance** (hover + active states) for clearer interaction feedback.
- **Added search clear control** in the search field (with consistent icon button styling) and increased input right padding to prevent overlap.
- **Improved folder drop-target visuals**:
  - Grid: folder cards highlight on drag-over.
  - Table: folder rows highlight on drag-over (`.dropTargetRow`).

### UX improvements made
- **Drag-and-drop move-to-folder workflow**:
  - Grid: drag one or multiple selected items onto a folder card to move.
  - Table: drag onto a folder row to move.
  - Automatically clears selection after a successful move and triggers a refresh for server consistency.
- **Selection convenience**:
  - Added “Clear selection” control alongside bulk actions.
  - “Select all on page” checkbox now has an accessible label.
- **More consistent pagination behavior**:
  - Pagination remains available even during search (since results are paginated client-side).
  - Added a safety clamp to prevent landing on invalid pages when filters reduce result counts.
- **Non-blocking feedback** for DnD move actions via a short-lived status banner (success/error).

### Frontend bugs fixed / edge cases covered
- **Signed preview URL generation was repeatedly re-fetching** for already-cached items. Now it:
  - Only requests missing preview URLs.
  - Prunes URLs for assets that are no longer present (prevents unbounded growth).
- **Dropdown menu positioning**:
  - Clamped the “right” position to avoid negative values (prevents off-screen dropdowns on narrow widths).
- **Search UX overlap**:
  - Prevented clear button overlap by increasing input padding.

## Accessibility improvements

### Modal accessibility (focus + ESC + scroll-lock correctness)
Added a reusable hook: `lib/utils/useA11yModal.ts`
- **Focus trap** within modal (TAB / Shift+TAB).
- **ESC closes only the top-most modal** (stack-aware via existing `modalStack`).
- **Restores focus** to the previously focused element on close.
- **Scroll locking** is stack-aware (doesn’t prematurely restore scrolling when nested modals are open).

Applied to:
- `AssetPreviewModal`
- `BulkMoveModal`
- `CreateFolderModal`

### Form/controls improvements
- Filter sidebar inputs now have proper **label → control associations** (`htmlFor` + stable ids).
- Added missing `type="button"` on multiple non-submit buttons to prevent accidental form submissions.
- Added multiple `aria-label`s:
  - Search input and clear button
  - Select-all checkbox and row selection checkboxes
  - Bulk action buttons

## Performance-related improvements
- **Reduced redundant signed URL requests** and pruned stale entries (see “Frontend bugs fixed”).
- **Avoided unnecessary re-renders** by using refs for preview URL cache checks and by showing short-lived banners with a single timer.

## Remaining limitations / recommended future enhancements

Because the app was not run, these items are recommended for a follow-up QA pass:
- **Visual QA across breakpoints** (especially table horizontal scroll, sticky header behavior if desired, filter sidebar overlay behavior, and banner stacking).
- **Keyboard-only interaction audit** on:
  - Table row click vs. selection behavior
  - Dropdown menu open/close + focus return
- **DnD affordances**:
  - Consider showing a “Drop to move” helper tooltip on folder hover during drag.
  - Consider supporting moving folders into folders (nested folder organization) if desired, with cycle-prevention rules.
- **Loading + error states**:
  - Consider adding explicit loading skeletons / spinners for server refresh and slow preview URL generation.
  - Consider standardizing error banners across all modals and actions.
- **i18n completeness**:
  - Several new strings were added via `t(...)`. If your i18n system requires explicit dictionaries, add translations for those new keys.

## Project-wide lint status (not introduced here, but blocks “green” CI)
`npm run lint` currently reports numerous pre-existing errors outside Assets/Folders pages (e.g., Screens pages, Player pages, `types/supabase.ts` parsing error). These should be resolved separately to make CI consistently green.

