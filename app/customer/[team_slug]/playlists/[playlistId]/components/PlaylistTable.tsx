'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from '@/lib/i18n'
import { ListVideo, Image, Film, Puzzle, GripVertical, Trash2, Plus } from 'lucide-react'
import styles from '../workspace.module.css'
import type { PlaylistItemWithAsset } from '../actions'

interface PlaylistTableProps {
  items: PlaylistItemWithAsset[]
  onReorder: (fromIndex: number, toIndex: number) => void
  onRemoveItem: (index: number) => void
  onUpdateDuration: (index: number, seconds: number) => void
  onOpenAssetPicker: () => void
}

function formatSize(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function getTypeInfo(item: PlaylistItemWithAsset) {
  const mime = item.assets?.mime_type || ''
  if (item.type === 'widget' || mime.startsWith('application/x-widget')) {
    return { label: 'Widget', style: styles.typeBadgeWidget, Icon: Puzzle }
  }
  if (item.type === 'video' || mime.startsWith('video/')) {
    return { label: 'Video', style: styles.typeBadgeVideo, Icon: Film }
  }
  return { label: 'Image', style: styles.typeBadgeImage, Icon: Image }
}

export default function PlaylistTable({ items, onReorder, onRemoveItem, onUpdateDuration, onOpenAssetPicker }: PlaylistTableProps) {
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
            <th style={{ width: '24px' }}>#</th>
            <th style={{ width: '44px' }}></th>
            <th>{t('Name')}</th>
            <th>{t('Type')}</th>
            <th>{t('Duration')}</th>
            <th>{t('Size')}</th>
            <th>{t('Resolution')}</th>
            <th style={{ width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const typeInfo = getTypeInfo(item)
            const isBeingDragged = dragIndex === index
            const isDragOver = dragOverIndex === index && dragIndex !== index
            const fileName = item.assets?.file_name || item.widget_type || t('Unknown')

            return (
              <tr
                key={item.id || `item-${index}`}
                className={`${styles.tableRow} ${isBeingDragged ? styles.tableRowDragging : ''}`}
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
                <td style={{ color: 'var(--on-surface-subtle)', fontWeight: 700, fontSize: '0.82rem' }}>
                  {index + 1}
                </td>
                <td>
                  <div className={styles.thumbnail}>
                    <div className={styles.thumbnailPlaceholder}>
                      <typeInfo.Icon size={16} />
                    </div>
                  </div>
                </td>
                <td>
                  <span className={styles.itemName}>{fileName}</span>
                </td>
                <td>
                  <span className={`${styles.typeBadge} ${typeInfo.style}`}>
                    {typeInfo.label}
                  </span>
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
                  <span className={styles.sizeCell}>
                    {item.assets?.size_bytes ? formatSize(item.assets.size_bytes) : '—'}
                  </span>
                </td>
                <td>
                  <span className={styles.resolutionCell}>
                    {item.assets?.width && item.assets?.height
                      ? `${item.assets.width}×${item.assets.height}`
                      : '—'}
                  </span>
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
