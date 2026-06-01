'use client'

import React from 'react'
import { Loader2, CheckCircle2, ChevronUp, ChevronDown, X, AlertTriangle } from 'lucide-react'
import styles from './asset.module.css'

export interface UploadItem {
  id: string
  fileName: string
  progress: number
  status: 'waiting' | 'uploading' | 'completed' | 'failed'
  error?: string
}

interface UploadPanelProps {
  showQueuePanel: boolean
  uploadQueue: UploadItem[]
  isQueueCollapsed: boolean
  setIsQueueCollapsed: (val: boolean) => void
  setShowQueuePanel: (val: boolean) => void
  setUploadQueue: React.Dispatch<React.SetStateAction<UploadItem[]>>
}

const getStatusClass = (status: UploadItem['status']) => {
  switch (status) {
    case 'waiting': return styles.waiting
    case 'uploading': return styles.uploading
    case 'completed': return styles.completed
    case 'failed': return styles.failed
    default: return ''
  }
}

export function UploadPanel({
  showQueuePanel,
  uploadQueue,
  isQueueCollapsed,
  setIsQueueCollapsed,
  setShowQueuePanel,
  setUploadQueue,
}: UploadPanelProps) {
  if (!showQueuePanel) return null

  const isUploading = uploadQueue.some(item => item.status === 'uploading' || item.status === 'waiting')

  return (
    <div className={styles.uploadPanel}>
      <div className={styles.uploadPanelHeader}>
        <div className={styles.uploadPanelTitle}>
          {isUploading ? (
            <Loader2 className={styles.spin} size={16} />
          ) : (
            <CheckCircle2 size={16} color="#22c55e" />
          )}
          {(() => {
            const total = uploadQueue.length
            const completed = uploadQueue.filter(item => item.status === 'completed').length
            const failed = uploadQueue.filter(item => item.status === 'failed').length
            const uploading = uploadQueue.filter(item => item.status === 'uploading').length
            if (uploading > 0) {
              return `Uploading ${uploading} file${uploading > 1 ? 's' : ''}... (${Math.round(uploadQueue.reduce((acc, x) => acc + x.progress, 0) / total)}%)`
            }
            return `Uploads: ${completed} done${failed > 0 ? `, ${failed} failed` : ''}`
          })()}
        </div>
        <div className={styles.uploadPanelButtons}>
          <button 
            onClick={() => setIsQueueCollapsed(!isQueueCollapsed)} 
            className={styles.uploadHeaderBtn}
            title={isQueueCollapsed ? "Expand Uploads" : "Collapse Uploads"}
          >
            {isQueueCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button 
            onClick={() => {
              if (!isUploading) {
                setShowQueuePanel(false)
                setUploadQueue([])
              }
            }} 
            className={styles.uploadHeaderBtn}
            disabled={isUploading}
            style={{
              opacity: isUploading ? 0.3 : 1,
              cursor: isUploading ? 'not-allowed' : 'pointer'
            }}
            title="Dismiss Panel"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      
      <div className={`${styles.uploadPanelContent} ${isQueueCollapsed ? styles.collapsed : ''}`}>
        <div className={styles.uploadPanelList}>
          {uploadQueue.map(item => (
            <div key={item.id} className={styles.uploadItem}>
              <div className={styles.uploadItemInfo}>
                <span className={styles.uploadItemName} title={item.fileName}>
                  {item.fileName}
                </span>
                <span className={`${styles.uploadItemMeta} ${getStatusClass(item.status)}`}>
                  {item.status === 'completed' && <CheckCircle2 size={12} />}
                  {item.status === 'failed' && <AlertTriangle size={12} />}
                  {item.status === 'uploading' && `${item.progress}%`}
                  {item.status === 'waiting' && 'Waiting'}
                </span>
              </div>
              <div className={styles.uploadItemProgressContainer}>
                <div 
                  className={`${styles.uploadItemProgressBar} ${getStatusClass(item.status)}`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              {item.error && (
                <div className={styles.uploadItemError} title={item.error}>
                  {item.error}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
