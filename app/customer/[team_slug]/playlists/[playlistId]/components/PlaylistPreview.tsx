'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from '@/lib/i18n'
import { Play, Pause, SkipForward, X, Image, Film } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from '../workspace.module.css'
import type { PlaylistItemWithAsset } from '../actions'

interface PlaylistPreviewProps {
  items: PlaylistItemWithAsset[]
  onClose: () => void
}

export default function PlaylistPreview({ items, onClose }: PlaylistPreviewProps) {
  const { t } = useTranslation()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const progressRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  const playableItems = items.filter(item =>
    item.assets && (
      item.assets.mime_type.startsWith('image/') ||
      item.assets.mime_type.startsWith('video/')
    )
  )

  const currentItem = playableItems[currentIndex] || null

  // Sign URL for current item
  useEffect(() => {
    if (!currentItem?.assets?.file_path) {
      setMediaUrl(null)
      return
    }

    const mime = currentItem.assets.mime_type
    if (mime.startsWith('application/x-widget')) {
      setMediaUrl(null)
      return
    }

    let mounted = true
    const supabase = createClient()

    supabase.storage
      .from('workspace-media')
      .createSignedUrl(currentItem.assets.file_path, 300)
      .then(({ data }) => {
        if (mounted && data?.signedUrl) {
          setMediaUrl(data.signedUrl)
        }
      })

    return () => { mounted = false }
  }, [currentItem])

  const advanceToNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % playableItems.length)
    setProgress(0)
    startTimeRef.current = Date.now()
  }, [playableItems.length])

  // Playback timer
  useEffect(() => {
    if (!isPlaying || !currentItem || playableItems.length === 0) return

    const duration = currentItem.duration_seconds * 1000
    startTimeRef.current = Date.now()

    timerRef.current = setTimeout(advanceToNext, duration)

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      setProgress(Math.min(elapsed / duration, 1))
    }, 50)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (progressRef.current) clearInterval(progressRef.current)
    }
  }, [currentIndex, isPlaying, currentItem, advanceToNext, playableItems.length])

  const togglePlayPause = () => setIsPlaying(prev => !prev)

  if (playableItems.length === 0) {
    return (
      <div className={styles.previewOverlay}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#fff', fontFamily: 'var(--font-body)' }}>
          {t('No previewable items')}
        </div>
        <div className={styles.previewControls}>
          <button className={styles.previewBtn} onClick={onClose} title={t('Close Preview')}>
            <X size={18} />
          </button>
        </div>
      </div>
    )
  }

  const isVideo = currentItem?.assets?.mime_type?.startsWith('video/')

  return (
    <div className={styles.previewOverlay}>
      {mediaUrl && !isVideo && (
        <img
          src={mediaUrl}
          className={styles.previewMedia}
          alt={currentItem?.assets?.file_name || 'Preview'}
        />
      )}
      {mediaUrl && isVideo && (
        <video
          src={mediaUrl}
          className={styles.previewMedia}
          autoPlay={isPlaying}
          muted
          playsInline
          loop
        />
      )}
      {!mediaUrl && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#666' }}>
          {isVideo ? <Film size={48} /> : <Image size={48} />}
        </div>
      )}

      <div className={styles.previewControls}>
        <button className={styles.previewBtn} onClick={togglePlayPause}>
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button className={styles.previewBtn} onClick={advanceToNext}>
          <SkipForward size={18} />
        </button>
        <div className={styles.previewProgress}>
          <div
            className={styles.previewProgressFill}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className={styles.previewInfo}>
          {currentIndex + 1}/{playableItems.length}
        </span>
        <button className={styles.previewBtn} onClick={onClose} title={t('Close Preview')}>
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
