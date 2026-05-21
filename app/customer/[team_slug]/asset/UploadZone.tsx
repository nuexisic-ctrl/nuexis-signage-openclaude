'use client'

import { useState, useCallback, useRef } from 'react'
import styles from './UploadZone.module.css'

interface UploadZoneProps {
  onFiles: (files: File[]) => void
  isUploading: boolean
  progress: number
  onError: (error: string | null) => void
}

export const MAX_FILE_SIZE = 50 * 1024 * 1024
export const ALLOWED_EXTENSIONS = /\.(png|jpg|jpeg|mp4|webm|pdf)$/i

export function validateFile(file: File): { valid: true } | { valid: false; error: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `"${file.name}" exceeds the 50MB limit.` }
  }
  if (!file.name.match(ALLOWED_EXTENSIONS)) {
    return { valid: false, error: `"${file.name}" has an invalid file type. Only PNG, JPG, JPEG, MP4, WEBM, and PDF are allowed.` }
  }
  return { valid: true }
}

export function UploadZone({
  onFiles,
  isUploading,
  progress,
  onError,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFilesFilter = useCallback((selectedFiles: File[]) => {
    onError(null)
    const validFiles: File[] = []
    for (const file of selectedFiles) {
      const check = validateFile(file)
      if (!check.valid) {
        onError(check.error)
        return
      }
      validFiles.push(file)
    }
    if (validFiles.length) {
      onFiles(validFiles)
    }
  }, [onFiles, onError])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (isUploading) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length) handleFilesFilter(files)
  }, [handleFilesFilter, isUploading])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (isUploading) return
    setIsDragging(true)
  }, [isUploading])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleClick = () => {
    if (isUploading) return
    inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) handleFilesFilter(files)
    // Reset input so same file can be re-uploaded
    e.target.value = ''
  }

  return (
    <div
      className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ''} ${isUploading ? styles.dropzoneUploading : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={!isUploading ? handleClick : undefined}
      role="button"
      tabIndex={0}
      aria-label="Upload media files"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,video/mp4,video/webm,application/pdf"
        multiple
        className={styles.hiddenInput}
        onChange={handleChange}
        id="media-file-input"
        disabled={isUploading}
      />

      <div className={styles.dropzoneInner}>
        {isUploading ? (
          <>
            <div className={styles.uploadingIcon}>
              <div className={styles.uploadSpinner} />
            </div>
            <p className={styles.dropzoneTitle}>Uploading…</p>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <p className={styles.dropzoneHint}>{progress}% complete</p>
          </>
        ) : (
          <>
            <div className={styles.dropzoneIcon} aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className={styles.dropzoneTitle}>
              {isDragging ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className={styles.dropzoneSubtitle}>or click to browse</p>
            <p className={styles.dropzoneHint}>
              Supports JPEG, PNG, MP4, WEBM, PDF · Max 50 MB per file
            </p>
          </>
        )}
      </div>
    </div>
  )
}
