import { useEffect } from 'react'
import { X, File } from 'lucide-react'
import styles from './asset.module.css'

interface Asset {
  id: string
  file_name: string
  file_path: string
  mime_type: string
  size_bytes: number
  created_at: string
}

interface Props {
  asset: Asset
  previewUrl: string | null
  onClose: () => void
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/')
}

function isVideo(mimeType: string) {
  return mimeType.startsWith('video/')
}

export function AssetPreviewModal({ asset, previewUrl, onClose }: Props) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const isImg = isImage(asset.mime_type)
  const isVid = isVideo(asset.mime_type)

  return (
    <div className={styles.modalOverlay} onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <div className={styles.modalMeta}>
            <span className={styles.modalTitle} title={asset.file_name}>{asset.file_name}</span>
            <span className={styles.modalMime}>{asset.mime_type}</span>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Close preview">
            <X size={24} />
          </button>
        </div>
        
        <div className={styles.modalContent}>
          {isImg && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={asset.file_name} className={styles.modalMedia} />
          ) : isVid && previewUrl ? (
            <video src={previewUrl} controls autoPlay className={styles.modalMedia} />
          ) : (
            <div className={styles.modalUnsupported}>
              <File size={48} className={styles.unsupportedIcon} />
              <p>Preview not available for this file type.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
