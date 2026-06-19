'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from '@/lib/i18n'
import { X, Image, Film, Puzzle, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { modalStack } from '@/lib/utils/modalStack'
import styles from '../workspace.module.css'

interface AssetPickerModalProps {
  teamId: string
  onSelect: (assets: SelectedAsset[]) => void
  onClose: () => void
}

export interface SelectedAsset {
  id: string
  file_name: string
  file_path: string
  mime_type: string
  size_bytes: number
  width: number | null
  height: number | null
}

export default function AssetPickerModal({ teamId, onSelect, onClose }: AssetPickerModalProps) {
  const { t } = useTranslation()
  const [assets, setAssets] = useState<SelectedAsset[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 50

  useEffect(() => {
    modalStack.push('asset-picker-modal')
    return () => { modalStack.pop('asset-picker-modal') }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalStack.isTop('asset-picker-modal')) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Fetch assets with pagination
  useEffect(() => {
    let mounted = true
    setIsLoading(true)

    const supabase = createClient()
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('assets')
      .select('id, file_name, file_path, mime_type, size_bytes, width, height')
      .eq('team_id', teamId)
      .neq('mime_type', 'application/x-folder')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search) {
      query = query.ilike('file_name', `%${search}%`)
    }

    query.then(({ data, error }) => {
      if (!mounted) return
      if (!error && data) {
        if (page === 0) {
          setAssets(data as SelectedAsset[])
        } else {
          setAssets(prev => [...prev, ...(data as SelectedAsset[])])
        }
        setHasMore(data.length === PAGE_SIZE)
      }
      setIsLoading(false)
    })

    return () => { mounted = false }
  }, [teamId, page, search])

  // Reset page when search changes
  useEffect(() => {
    setPage(0)
    setAssets([])
  }, [search])

  const toggleAsset = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleConfirm = () => {
    const selected = assets.filter(a => selectedIds.has(a.id))
    onSelect(selected)
    onClose()
  }

  const getIcon = (mimeType: string) => {
    if (mimeType.startsWith('video/')) return <Film size={24} style={{ color: 'var(--on-surface-subtle)' }} />
    if (mimeType.startsWith('application/x-widget')) return <Puzzle size={24} style={{ color: 'var(--on-surface-subtle)' }} />
    return <Image size={24} style={{ color: 'var(--on-surface-subtle)' }} />
  }

  const formatSize = (bytes: number): string => {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalContent}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '640px' }}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{t('Select Assets')}</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <input
            type="text"
            className={styles.modalSearch}
            placeholder={t('Search assets...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            maxLength={200}
          />

          {isLoading && assets.length === 0 ? (
            <div className={styles.modalEmpty}>{t('Loading…')}</div>
          ) : assets.length === 0 ? (
            <div className={styles.modalEmpty}>
              <Image size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <div>{t('No assets found')}</div>
            </div>
          ) : (
            <>
              <div className={styles.assetGrid}>
                {assets.map(asset => {
                  const isSelected = selectedIds.has(asset.id)
                  return (
                    <div
                      key={asset.id}
                      className={`${styles.assetCard} ${isSelected ? styles.assetCardSelected : ''}`}
                      onClick={() => toggleAsset(asset.id)}
                    >
                      <div className={styles.assetCardThumb}>
                        {isSelected && (
                          <div style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2,
                          }}>
                            <Check size={13} color="#fff" />
                          </div>
                        )}
                        {getIcon(asset.mime_type)}
                      </div>
                      <div className={styles.assetCardInfo}>
                        <div className={styles.assetCardName} title={asset.file_name}>
                          {asset.file_name}
                        </div>
                        <div className={styles.assetCardMeta}>
                          {formatSize(asset.size_bytes)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {hasMore && (
                <button
                  className={styles.addItemBtn}
                  style={{ marginTop: '12px' }}
                  onClick={() => setPage(prev => prev + 1)}
                  disabled={isLoading}
                >
                  {isLoading ? t('Loading…') : t('Load More')}
                </button>
              )}
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          {selectedIds.size > 0 && (
            <span className={styles.selectedCount}>
              {selectedIds.size === 1
                ? t('{count} asset selected', { count: selectedIds.size })
                : t('{count} assets selected', { count: selectedIds.size })
              }
            </span>
          )}
          <button className={styles.modalCancelBtn} onClick={onClose}>
            {t('Cancel')}
          </button>
          <button
            className={styles.modalPrimaryBtn}
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
          >
            {t('Add Selected')}
          </button>
        </div>
      </div>
    </div>
  )
}
