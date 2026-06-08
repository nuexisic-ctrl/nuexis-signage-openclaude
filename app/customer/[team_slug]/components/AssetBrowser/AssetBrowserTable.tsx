'use client'

import React from 'react'
import { MoreVertical } from 'lucide-react'
import { useAssetBrowser } from './AssetBrowserContext'
import { getAssetTypeBadge, TableIcon, formatDate, formatSize } from '../../screens/AssetBrowserPreview'
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
    previewUrls
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

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            {isMultiSelect && <th style={{ width: '40px', paddingLeft: '16px' }} />}
            <th style={{ width: '35%' }}>File Name</th>
            <th style={{ width: '15%' }}>Type</th>
            <th style={{ width: '15%' }}>Size</th>
            <th style={{ width: '25%' }}>Date Added</th>
            <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedAssets.map((asset) => {
            const badgeType = getAssetTypeBadge(asset.mime_type, asset.file_name)
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
                  <span className={styles.typeBadge}>
                    {badgeType}
                  </span>
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
