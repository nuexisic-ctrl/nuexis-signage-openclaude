'use client'

import React from 'react'
import { MoreVertical, Folder, Image as ImageIcon, Play, Music, FileText, Code, File } from 'lucide-react'
import { useAssetBrowser } from './AssetBrowserContext'
import { TableIcon, formatDate, formatSize } from '../../screens/AssetBrowserPreview'
import { FilenameTruncator } from '@/app/components/FilenameTruncator'
import { Asset } from '../../asset/types'
import styles from './AssetBrowser.module.css'

export function AssetBrowserTable() {
  const {
    paginatedAssets,
    setActiveFolder,
    setCurrentPage,
    isMultiSelect,
    selectedIds,
    toggleSelect,
    onSelect,
    previewUrls,
    sortBy,
    setSortBy
  } = useAssetBrowser()

  const handleAssetClick = (asset: Asset) => {
    if (asset.mime_type === 'application/x-folder') {
      setActiveFolder(asset)
      setCurrentPage(1)
    } else {
      if (isMultiSelect) {
        toggleSelect(asset.id)
      } else {
        if (onSelect) {
          onSelect(asset.id)
        }
      }
    }
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
            <th style={{ width: '35%', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleHeaderSort('name')}>
              File Name {renderSortIcon('name')}
            </th>
            <th style={{ width: '20%', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleHeaderSort('type')}>
              Content Type {renderSortIcon('type')}
            </th>
            <th style={{ width: '15%' }}>Size</th>
            <th style={{ width: '20%', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleHeaderSort('created')}>
              Date Added {renderSortIcon('created')}
            </th>
            <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedAssets.map((asset) => {
            const isSelected = selectedIds.has(asset.id) && asset.mime_type !== 'application/x-folder'

            return (
              <tr
                key={asset.id}
                className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
                onClick={() => handleAssetClick(asset)}
                style={{ cursor: 'pointer' }}
              >
                {isMultiSelect && (
                  <td onClick={(e) => e.stopPropagation()} style={{ paddingLeft: '16px' }}>
                    {asset.mime_type !== 'application/x-folder' ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleAssetClick(asset)}
                        style={{ cursor: 'pointer' }}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem' }}>
                    {(() => {
                      if (asset.mime_type === 'application/x-folder') {
                        return <Folder size={14} style={{ stroke: asset.color || '#78716c' }} />
                      }
                      if (asset.mime_type.startsWith('image/')) {
                        return <ImageIcon size={14} style={{ stroke: '#22c55e' }} />
                      }
                      if (asset.mime_type.startsWith('video/')) {
                        return <Play size={14} style={{ stroke: '#3b82f6' }} />
                      }
                      if (asset.mime_type.startsWith('audio/')) {
                        return <Music size={14} style={{ stroke: '#f59e0b' }} />
                      }
                      if (asset.mime_type === 'application/pdf') {
                        return <FileText size={14} style={{ stroke: '#ef4444' }} />
                      }
                      if (asset.mime_type.startsWith('application/x-widget')) {
                        return <Code size={14} style={{ stroke: '#a855f7' }} />
                      }
                      return <File size={14} style={{ stroke: '#64748b' }} />
                    })()}
                    <span>
                      {(() => {
                        if (asset.mime_type === 'application/x-folder') return 'Folder'
                        if (asset.mime_type.startsWith('image/')) return 'Image'
                        if (asset.mime_type.startsWith('video/')) return 'Video'
                        if (asset.mime_type.startsWith('audio/')) return 'Audio'
                        if (asset.mime_type === 'application/pdf') return 'PDF'
                        if (asset.mime_type.startsWith('application/x-widget')) return 'Widget'
                        return 'Document'
                      })()}
                    </span>
                  </div>
                </td>
                <td>{asset.mime_type === 'application/x-folder' ? '--' : formatSize(asset.size_bytes)}</td>
                <td>{formatDate(asset.created_at)}</td>
                <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
                  <button
                    className={styles.actionIconBtn}
                    onClick={() => handleAssetClick(asset)}
                    title={asset.mime_type === 'application/x-folder' ? "Open Folder" : "Select Asset"}
                    type="button"
                  >
                    <MoreVertical size={16} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
