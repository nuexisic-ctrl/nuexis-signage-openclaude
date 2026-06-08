'use client'

import React from 'react'
import { X, Check } from 'lucide-react'
import { useAssetBrowser } from './AssetBrowserContext'
import styles from './AssetBrowser.module.css'

export function AssetBrowserSelection() {
  const {
    isMultiSelect,
    selectedIds,
    clearSelection,
    onSelectMultiple,
    onClose
  } = useAssetBrowser()

  if (!isMultiSelect || selectedIds.size === 0) return null

  const handleConfirm = () => {
    if (onSelectMultiple) {
      onSelectMultiple(Array.from(selectedIds))
    }
    onClose()
  }

  return (
    <div className={styles.selectionFooterBar}>
      <div className={styles.selectionFooterContent}>
        <div className={styles.selectionFooterLeft}>
          <span className={styles.selectionCountLabel}>
            Selected <strong>{selectedIds.size}</strong> {selectedIds.size === 1 ? 'image' : 'images'}
          </span>
          <button
            type="button"
            className={styles.selectionClearBtn}
            onClick={clearSelection}
            title="Clear current selection"
          >
            <X size={12} style={{ marginRight: '4px' }} />
            Clear
          </button>
        </div>
        
        <div className={styles.selectionFooterRight}>
          <button
            type="button"
            className={styles.selectionCancelBtn}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.selectionConfirmBtn}
            onClick={handleConfirm}
          >
            <Check size={14} style={{ marginRight: '6px' }} />
            Add Selected
          </button>
        </div>
      </div>
    </div>
  )
}
