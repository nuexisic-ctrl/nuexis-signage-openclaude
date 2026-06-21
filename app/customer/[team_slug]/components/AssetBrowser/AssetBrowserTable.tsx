'use client'

import React, { useState, useEffect } from 'react'
import { useAssetBrowser } from './AssetBrowserContext'
import { TableIcon, formatDate } from '../../screens/AssetBrowserPreview'
import { FilenameTruncator } from '@/app/components/FilenameTruncator'
import { Asset } from '../../assets/types'
import styles from './AssetBrowser.module.css'
import { ContentIconBadge, getAssetKind } from '../../screens/DeviceIcon'
import { useTranslation } from '@/lib/i18n'
import { handleRangeSelection } from '@/lib/utils/selection'

export function AssetBrowserTable() {
  const { t } = useTranslation()
  const {
    paginatedAssets,
    setActiveFolder,
    setCurrentPage,
    isMultiSelect,
    selectedIds,
    setSelectedIds,
    toggleSelect,
    onSelect,
    previewUrls,
    sortBy,
    setSortBy,
    clearSelection,
  } = useAssetBrowser()

  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

  // Click away to clear selection
  useEffect(() => {
    if (selectedIds.size === 0) return

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target) return

      // If clicking interactive elements or rows, do not clear
      if (
        target.closest('button') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('a') ||
        target.closest('[role="button"]') ||
        target.closest('[role="dialog"]') ||
        target.closest('tr')
      ) {
        return
      }

      clearSelection()
    }

    document.addEventListener('click', handleGlobalClick)
    return () => document.removeEventListener('click', handleGlobalClick)
  }, [selectedIds.size, clearSelection])

  const handleAssetClick = (e: React.MouseEvent, asset: Asset) => {
    if (asset.mime_type === 'application/x-folder') {
      if (selectedIds.size > 0) {
        // If selection is active, folders are not selectable, so we do nothing
        return
      }
      setActiveFolder(asset)
      setCurrentPage(1)
      return
    }

    // It is a file
    if (selectedIds.size === 0) {
      if (!isMultiSelect) {
        if (onSelect) {
          onSelect(asset.id)
        }
      }
      return
    }

    // Selection is active
    setSelectedIds(prev => {
      const { nextSelectedIds, nextLastSelectedId } = handleRangeSelection(
        e,
        asset.id,
        lastSelectedId,
        paginatedAssets.filter(a => a.mime_type !== 'application/x-folder'),
        prev
      )
      setLastSelectedId(nextLastSelectedId)
      return nextSelectedIds
    })
  }

  const handleCheckboxClick = (e: React.MouseEvent, asset: Asset) => {
    e.stopPropagation()
    toggleSelect(asset.id)
    setLastSelectedId(asset.id)
  }

  const handleHeaderSort = (column: 'name' | 'type' | 'created') => {
    if (column === 'name') {
      setSortBy(sortBy === 'name-asc' ? 'name-desc' : 'name-asc')
    } else if (column === 'type') {
      setSortBy(sortBy === 'type-asc' ? 'type-desc' : 'type-asc')
    } else if (column === 'created') {
      setSortBy(sortBy === 'created-asc' ? 'created-desc' : 'created-asc')
    }
  }

  const renderSortIcon = (column: 'name' | 'type' | 'created') => {
    if (column === 'name') {
      if (sortBy === 'name-asc') return ' ▲'
      if (sortBy === 'name-desc') return ' ▼'
    }
    if (column === 'type') {
      if (sortBy === 'type-asc') return ' ▲'
      if (sortBy === 'type-desc') return ' ▼'
    }
    if (column === 'created') {
      if (sortBy === 'created-asc') return ' ▲'
      if (sortBy === 'created-desc') return ' ▼'
    }
    return null
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            {isMultiSelect && <th style={{ width: '40px', paddingLeft: '16px' }} />}
            <th style={{ width: '40%', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleHeaderSort('name')}>
              {t('File Name').toUpperCase()} {renderSortIcon('name')}
            </th>
            <th style={{ width: '20%' }}>{t('Type').toUpperCase()}</th>
            <th style={{ width: '25%', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleHeaderSort('created')}>
              {t('Date Added').toUpperCase()} {renderSortIcon('created')}
            </th>
            <th style={{ width: '15%', textAlign: 'right', paddingRight: '16px' }}>{t('Actions').toUpperCase()}</th>
          </tr>
        </thead>
        <tbody>
          {paginatedAssets.map((asset) => {
            const isSelected = selectedIds.has(asset.id) && asset.mime_type !== 'application/x-folder'
            const isFolder = asset.mime_type === 'application/x-folder'

            return (
              <tr
                key={asset.id}
                className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
                onClick={(e) => handleAssetClick(e, asset)}
                style={{ cursor: 'pointer' }}
              >
                {isMultiSelect && (
                  <td 
                    onClick={(e) => handleCheckboxClick(e, asset)} 
                    style={{ paddingLeft: '16px', cursor: 'pointer' }}
                  >
                    {!isFolder ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ cursor: 'pointer', pointerEvents: 'none' }}
                      />
                    ) : (
                      <div style={{ width: '13px' }} />
                    )}
                  </td>
                )}
                <td>
                  <div className={styles.fileNameCell}>
                    <div className={styles.fileIconWrapper}>
                      <TableIcon asset={asset} previewUrls={previewUrls} />
                    </div>
                    <span className={styles.fileNameText}>
                      <FilenameTruncator filename={asset.file_name} />
                    </span>
                  </div>
                </td>
                <td>
                  <ContentIconBadge
                    kind={getAssetKind(asset.mime_type)}
                    color={isFolder ? (asset.color || '#78716c') : null}
                  />
                </td>
                <td>{formatDate(asset.created_at)}</td>
                <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                  {isFolder ? (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveFolder(asset)
                        setCurrentPage(1)
                      }}
                    >
                      {t('Open')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isMultiSelect) {
                          toggleSelect(asset.id)
                          setLastSelectedId(asset.id)
                        } else {
                          if (onSelect) onSelect(asset.id)
                        }
                      }}
                    >
                      {t('Select')}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
