'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from '@/lib/i18n'
import { X, Monitor, Search } from 'lucide-react'
import { getAssignableDevices, pushPlaylistToScreens } from '../actions'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/app/components/Toast'
import { modalStack } from '@/lib/utils/modalStack'
import styles from '../workspace.module.css'

interface PushToScreenModalProps {
  playlistId: string
  playlistName: string
  teamSlug: string
  currentAssignedIds: string[]
  onClose: () => void
  onPushed: () => void
}

interface DeviceRow {
  id: string
  name: string | null
  status: string
  content_type: string | null
  playlist_id: string | null
  asset_id: string | null
}

export default function PushToScreenModal({
  playlistId,
  playlistName,
  teamSlug,
  currentAssignedIds,
  onClose,
  onPushed,
}: PushToScreenModalProps) {
  const { t } = useTranslation()
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(currentAssignedIds))
  const [isLoading, setIsLoading] = useState(true)
  const [isPushing, setIsPushing] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    modalStack.push('push-to-screen-modal')
    return () => { modalStack.pop('push-to-screen-modal') }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalStack.isTop('push-to-screen-modal')) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    let mounted = true
    getAssignableDevices()
      .then(data => {
        if (mounted) {
          setDevices(data as DeviceRow[])
          setIsLoading(false)
        }
      })
      .catch(err => {
        console.error(err)
        if (mounted) setIsLoading(false)
      })
    return () => { mounted = false }
  }, [])

  const filteredDevices = useMemo(() => {
    if (!search) return devices
    const q = search.toLowerCase()
    return devices.filter(d => d.name?.toLowerCase().includes(q))
  }, [devices, search])

  const toggleDevice = (id: string) => {
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

  const handlePush = async () => {
    if (selectedIds.size === 0) return
    setIsPushing(true)
    try {
      const result = await pushPlaylistToScreens(
        playlistId,
        Array.from(selectedIds),
        teamSlug
      )

      // Broadcast content_update to the player(s) so they update in real-time
      const supabase = createClient()
      const deviceIds = Array.from(selectedIds)
      for (const devId of deviceIds) {
        const channel = supabase.channel(`device-pair-${devId}`)
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'content_update',
              payload: { timestamp: Date.now() }
            }).catch(console.error)
            setTimeout(() => supabase.removeChannel(channel), 1000)
          }
        })
      }

      toast.success(
        t('Playlist pushed to {count} screen(s) successfully', { count: result.count })
      )
      onPushed()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || t('Failed to push playlist to screens.'))
    } finally {
      setIsPushing(false)
    }
  }

  const getCurrentContent = (device: DeviceRow): string => {
    if (device.playlist_id === playlistId) return `✓ ${playlistName}`
    if (device.content_type === 'Playlist') return t('Playlist')
    if (device.content_type === 'Asset') return t('Asset')
    return t('Unassigned')
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{t('Push to Screen')}</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <input
            type="text"
            className={styles.modalSearch}
            placeholder={t('Search screens...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            maxLength={100}
          />

          {isLoading ? (
            <div className={styles.modalEmpty}>{t('Loading…')}</div>
          ) : filteredDevices.length === 0 ? (
            <div className={styles.modalEmpty}>
              <Monitor size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <div>{t('No screens available')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {filteredDevices.map(device => (
                <label
                  key={device.id}
                  className={styles.deviceCheckRow}
                >
                  <input
                    type="checkbox"
                    className={styles.deviceCheckbox}
                    checked={selectedIds.has(device.id)}
                    onChange={() => toggleDevice(device.id)}
                  />
                  <span className={styles.deviceCheckName}>
                    {device.name || t('Unnamed Screen')}
                  </span>
                  <span
                    className={styles.deviceCheckStatus}
                    style={{
                      color: device.status === 'online' ? '#22c55e' : 'var(--error)',
                    }}
                  >
                    {device.status === 'online' ? t('Online') : t('Offline')}
                  </span>
                  <span className={styles.deviceCheckContent}>
                    {getCurrentContent(device)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          {selectedIds.size > 0 && (
            <span className={styles.selectedCount}>
              {selectedIds.size} {t('selected')}
            </span>
          )}
          <button className={styles.modalCancelBtn} onClick={onClose}>
            {t('Cancel')}
          </button>
          <button
            className={styles.modalPrimaryBtn}
            onClick={handlePush}
            disabled={selectedIds.size === 0 || isPushing}
          >
            {isPushing ? t('Pushing...') : t('Push')}
          </button>
        </div>
      </div>
    </div>
  )
}
