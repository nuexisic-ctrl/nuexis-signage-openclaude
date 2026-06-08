'use client'

import React from 'react'
import { MoreVertical, Check } from 'lucide-react'
import { useAssetBrowser } from './AssetBrowserContext'
import { getAssetTypeBadge, CardPreview, formatDate, formatSize } from '../../screens/AssetBrowserPreview'
import { FilenameTruncator } from '@/app/components/FilenameTruncator'
import { Asset } from '../../asset/types'
import styles from './AssetBrowser.module.css'

export function AssetBrowserGrid() {
  const {
    paginatedAssets,
    activeFolder,
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
    <div className={styles.grid}>
      {paginatedAssets.map((asset) => {
        const badgeType = getAssetTypeBadge(asset.mime_type, asset.file_name)
        const isSelected = selectedIds.has(asset.id) && asset.mime_type !== 'application/x-folder'

        return (
          <div
            key={asset.id}
            className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
            onClick={() => handleAssetClick(asset)}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            {isMultiSelect && asset.mime_type !== 'application/x-folder' && (
              <div className={`${styles.selectionBubble} ${isSelected ? styles.selected : ''}`}>
                {isSelected && <Check size={10} style={{ color: '#fff' }} />}
              </div>
            )}
            <CardPreview asset={asset} previewUrls={previewUrls} />
            <div className={styles.cardBody}>
              <span className={`${styles.typeBadge} ${styles.cardTypeBadge}`}>
                {badgeType}
              </span>
              <h4 className={styles.cardTitle}>
                <FilenameTruncator filename={asset.file_name} />
              </h4>
              <div className={styles.cardDetails}>
                <span>{asset.mime_type === 'application/x-folder' ? 'Folder' : `${formatSize(asset.size_bytes)} • ${formatDate(asset.created_at)}`}</span>
              </div>
              <div className={styles.cardMenuBtn} onClick={(e) => e.stopPropagation()}>
                <button
                  className={styles.actionIconBtn}
                  onClick={() => handleAssetClick(asset)}
                  title={asset.mime_type === 'application/x-folder' ? "Open Folder" : "Select Asset"}
                  type="button"
                >
                  <MoreVertical size={14} />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
