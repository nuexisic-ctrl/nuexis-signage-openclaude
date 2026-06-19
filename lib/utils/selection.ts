import { MouseEvent } from 'react'

export function handleRangeSelection(
  event: MouseEvent | React.MouseEvent,
  clickedId: string,
  lastSelectedId: string | null,
  itemsList: { id: string }[],
  currentSelectedIds: Set<string>
): { nextSelectedIds: Set<string>; nextLastSelectedId: string | null } {
  const isCtrlOrCmd = event.ctrlKey || event.metaKey;
  const isShift = event.shiftKey;
  const nextSelectedIds = new Set(currentSelectedIds);
  let nextLastSelectedId = lastSelectedId;

  if (isCtrlOrCmd) {
    if (nextSelectedIds.has(clickedId)) {
      nextSelectedIds.delete(clickedId);
    } else {
      nextSelectedIds.add(clickedId);
      nextLastSelectedId = clickedId;
    }
  } else if (isShift && lastSelectedId) {
    const lastIdx = itemsList.findIndex(item => item.id === lastSelectedId);
    const currentIdx = itemsList.findIndex(item => item.id === clickedId);
    if (lastIdx !== -1 && currentIdx !== -1) {
      const start = Math.min(lastIdx, currentIdx);
      const end = Math.max(lastIdx, currentIdx);
      nextSelectedIds.clear();
      for (let i = start; i <= end; i++) {
        nextSelectedIds.add(itemsList[i].id);
      }
    }
  } else {
    // Single click: unselected gets selected, selected stays selected
    if (!nextSelectedIds.has(clickedId) || nextSelectedIds.size > 1) {
      nextSelectedIds.clear();
      nextSelectedIds.add(clickedId);
    }
    nextLastSelectedId = clickedId;
  }

  return { nextSelectedIds, nextLastSelectedId };
}
