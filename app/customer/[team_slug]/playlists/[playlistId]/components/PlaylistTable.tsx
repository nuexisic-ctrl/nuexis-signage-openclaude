'use client'

import { useState, useCallback } from 'react'
import { useTranslation } from '@/lib/i18n'
import { ListVideo, GripVertical, Trash2, Plus } from 'lucide-react'
import styles from '../workspace.module.css'
import type { PlaylistItemWithAsset } from '../actions'
import { ContentIconBadge, getAssetKind } from '../../../screens/DeviceIcon'

interface PlaylistTableProps {
  items: PlaylistItemWithAsset[]
  onReorder: (fromIndex: number, toIndex: number) => void
  onRemoveItem: (index: number) => void
  onUpdateDuration: (index: number, seconds: number) => void
  onOpenAssetPicker: () => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
}

function getPlaylistItemKind(item: PlaylistItemWithAsset): string {
  if (item.assets?.mime_type) {
    return getAssetKind(item.assets.mime_type)
  }
  if (item.type === 'video') return 'video'
  if (item.type === 'image') return 'image'
  if (item.type === 'widget') {
    if (item.widget_type === 'flow-clock') return 'clock'
    if (item.widget_type === 'flow-countdown') return 'countdown'
    return 'html-widget'
  }
  return 'document'
}

export default function PlaylistTable({
  items,
  onReorder,
  onRemoveItem,
  onUpdateDuration,
  onOpenAssetPicker,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: PlaylistTableProps) {
  const { t } = useTranslation()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }, [onReorder])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  if (items.length === 0) {
    return (
      <div className={styles.tableContainer}>
        <div className={styles.emptyTable}>
          <div className={styles.emptyTableIcon}>
            <ListVideo size={24} />
          </div>
          <h3 className={styles.emptyTableTitle}>{t('No items yet')}</h3>
          <p className={styles.emptyTableText}>
            {t('Add media to build your playlist.')}
          </p>
          <button className={styles.addItemBtn} onClick={onOpenAssetPicker} style={{ maxWidth: '240px' }}>
            <Plus size={16} /> {t('Add Media')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.tableHead}>
            <th style={{ width: '36px' }}></th>
            <th style={{ width: '36px' }}>
              <input
                type="checkbox"
                checked={items.length > 0 && selectedIds.size === items.length}
                ref={el => {
                  if (el) {
                    el.indeterminate = selectedIds.size > 0 && selectedIds.size < items.length
                  }
                }}
                onChange={onToggleSelectAll}
                aria-label={t('Select all')}
              />
            </th>
            <th style={{ width: '30px' }}>#</th>
            <th>{t('Name')}</th>
            <th style={{ width: '120px' }}>{t('Content Type')}</th>
            <th style={{ width: '100px' }}>{t('Duration')}</th>
            <th style={{ width: '80px' }}>{t('Actions')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const isBeingDragged = dragIndex === index
            const isDragOver = dragOverIndex === index && dragIndex !== index
            const fileName = item.assets?.file_name || item.widget_type || t('Unknown')

            return (
              <tr
                key={item.id || `item-${index}`}
                className={`${styles.tableRow} ${isBeingDragged ? styles.tableRowDragging : ''} ${selectedIds.has(item.id) ? styles.tableRowSelected : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                style={{
                  opacity: isBeingDragged ? 0.5 : 1,
                  borderTop: isDragOver ? '2px solid var(--primary)' : undefined,
                }}
              >
                <td>
                  <div className={styles.dragHandle} title={t('Drag to reorder')}>
                    <GripVertical size={16} />
                  </div>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => onToggleSelect(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={t('Select item')}
                  />
                </td>
                <td style={{ color: 'var(--on-surface-subtle)', fontWeight: 700, fontSize: '0.82rem' }}>
                  {index + 1}
                </td>
                <td>
                  <span className={styles.itemName}>{fileName}</span>
                </td>
                <td>
                  <ContentIconBadge kind={getPlaylistItemKind(item) as any} />
                </td>
                <td>
                  <div className={styles.durationCell}>
                    <input
                      type="number"
                      className={styles.durationInput}
                      value={item.duration_seconds}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10)
                        if (!isNaN(val) && val >= 1 && val <= 86400) {
                          onUpdateDuration(index, val)
                        }
                      }}
                      min={1}
                      max={86400}
                      aria-label={t('Duration in seconds')}
                    />
                    <span className={styles.durationUnit}>s</span>
                  </div>
                </td>
                <td>
                  <button
                    className={styles.removeItemBtn}
                    onClick={() => onRemoveItem(index)}
                    title={t('Remove item')}
                    aria-label={t('Remove item')}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className={styles.addItemRow}>
        <button className={styles.addItemBtn} onClick={onOpenAssetPicker}>
          <Plus size={16} /> {t('Add Media')}
        </button>
      </div>
    </div>
  )
}
