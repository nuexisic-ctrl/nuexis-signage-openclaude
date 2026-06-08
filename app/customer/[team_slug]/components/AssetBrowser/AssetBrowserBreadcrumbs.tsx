'use client'

import React from 'react'
import { Folder } from 'lucide-react'
import { useAssetBrowser } from './AssetBrowserContext'
import styles from './AssetBrowser.module.css'

export function AssetBrowserBreadcrumbs() {
  const { breadcrumbs, setActiveFolder, setCurrentPage, isLoadingFiles } = useAssetBrowser()

  return (
    <div className={styles.breadcrumbContainer}>
      {breadcrumbs.map((crumb, idx) => {
        const isLast = idx === breadcrumbs.length - 1
        return (
          <span key={idx} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {idx > 0 && <span className={styles.breadcrumbSeparator}>&gt;</span>}
            {isLast ? (
              <span className={styles.breadcrumbActive}>
                {crumb.folder && (
                  <Folder size={14} style={{ stroke: crumb.folder.color || '#78716c', fill: crumb.folder.color || '#78716c', fillOpacity: 0.15 }} />
                )}
                {crumb.name}
              </span>
            ) : (
              <button
                type="button"
                className={styles.breadcrumbLink}
                onClick={() => {
                  setActiveFolder(crumb.folder)
                  setCurrentPage(1)
                }}
              >
                {crumb.folder && (
                  <Folder size={14} style={{ stroke: crumb.folder.color || '#78716c', fill: crumb.folder.color || '#78716c', fillOpacity: 0.15 }} />
                )}
                {crumb.name}
              </button>
            )}
          </span>
        )
      })}
      {isLoadingFiles && (
        <span style={{ marginLeft: '12px', fontSize: '0.78rem', color: 'var(--on-surface-subtle)' }}>
          Loading...
        </span>
      )}
    </div>
  )
}
