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
  startTime?: number
  size?: number
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

  const getRemainingTimeText = () => {
    const uploadingItem = uploadQueue.find(item => item.status === 'uploading')
    if (!uploadingItem || !uploadingItem.startTime) {
      return ''
    }

    const elapsedSeconds = (Date.now() - uploadingItem.startTime) / 1000
    const progress = uploadingItem.progress || 5
    const size = uploadingItem.size || 0

    // Determine speed in bytes/sec
    let speed = 0
    if (elapsedSeconds >= 1 && progress > 5) {
      const bytesUploaded = size * (progress / 100)
      speed = bytesUploaded / elapsedSeconds
    }

    // Fallback speed: 2 MB/s
    const fallbackSpeed = 2 * 1024 * 1024
    const effectiveSpeed = speed > 1024 ? speed : fallbackSpeed

    // Current item remaining time
    const currentRemaining = (size * (1 - progress / 100)) / effectiveSpeed

    // Queued items remaining time
    const waitingItems = uploadQueue.filter(item => item.status === 'waiting')
    const waitingSize = waitingItems.reduce((acc, item) => acc + (item.size || 0), 0)
    const waitingRemaining = waitingSize / effectiveSpeed

    const totalRemainingSeconds = Math.max(0, currentRemaining + waitingRemaining)

    if (totalRemainingSeconds === 0) return ''

    if (elapsedSeconds < 1.5 || progress <= 5) {
      return ' - Calculating remaining time...'
    }

    const minutes = Math.floor(totalRemainingSeconds / 60)
    const seconds = Math.round(totalRemainingSeconds % 60)

    if (minutes > 0) {
      return ` - About ${minutes}m ${seconds}s remaining`
    }
    return ` - About ${seconds}s remaining`
  }

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
              const pct = Math.round(uploadQueue.reduce((acc, x) => acc + x.progress, 0) / total)
              return `Uploading ${uploading} file${uploading > 1 ? 's' : ''}... (${pct}%)${getRemainingTimeText()}`
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
