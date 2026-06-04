# Drag & Drop Asset Move — TODO

- [ ] Implement HTML5 drag-and-drop payload from assets (grid + table):
  - [ ] AssetCard: make draggable and set drag payload (multi-select: selected set)
  - [ ] AssetTableView: make draggable rows and set drag payload
  - [ ] AssetClient: manage drag state + open BulkMoveModal on drag start/drop
- [ ] Update `BulkMoveModal` to act as drop tray:
  - [ ] Root (No Folder) + folder items as drop targets
  - [ ] Disabled destination logic (including Root) when destination already matches all selected assets
  - [ ] Visual hover/active/disabled feedback
  - [ ] Loading + success/error UI handling
- [ ] Prevent redundant moves:
  - [ ] Frontend: filter out assetIds already in destination before calling backend
  - [ ] Backend: short-circuit in `moveAssetsToFolder` to avoid DB writes when nothing needs moving
- [ ] Run typecheck/lint/tests:
  - [ ] `npm test` / `npm run lint` / `npm run build` as appropriate
