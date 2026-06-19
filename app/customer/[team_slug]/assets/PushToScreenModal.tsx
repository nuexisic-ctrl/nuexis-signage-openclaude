'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { AlertTriangle, Check, Monitor } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { modalStack } from '@/lib/utils/modalStack'
import { pushAssetToScreen } from './actions'
import { Asset, ScreenDevice } from './types'
import styles from './PushToScreenModal.module.css'
import { useTranslation } from '@/lib/i18n'
import Modal from '../components/Modal'

interface PushToScreenModalProps {
  asset: Asset
  screens: ScreenDevice[]
  teamSlug: string
  onClose: () => void
  onSuccess: () => void
}

export function PushToScreenModal({
  asset,
  screens,
  teamSlug,
  onClose,
  onSuccess,
}: PushToScreenModalProps) {
  const { t } = useTranslation()
  const [selectedScreenId, setSelectedScreenId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const timeoutRef = useRef<any>(null)

  const channelRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (channelRef.current) {
        const supabase = createClient()
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [])

  const selectedScreen = useMemo(
    () => screens.find(screen => screen.id === selectedScreenId),
    [screens, selectedScreenId]
  )

  function getScreenStatusLabel(status: ScreenDevice['status']) {
    if (status === 'online') return t('Online')
    if (status === 'pairing') return t('Pairing')
    return t('Offline')
  }

  useEffect(() => {
    modalStack.push('push-to-screen-modal')
    document.body.style.overflow = 'hidden'
    return () => {
      modalStack.pop('push-to-screen-modal')
      document.body.style.overflow = ''
    }
  }, [])

  function handlePush() {
    if (!selectedScreenId || isPending) return

    setError(null)
    setSuccess(null)

    const supabase = createClient()
    
    // Cleanup any existing subscription first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase.channel(`device-pair-${selectedScreenId}`)
    channelRef.current = channel

    // Listen for push_acknowledged event from the player
    channel
      .on('broadcast', { event: 'push_acknowledged' }, (payload) => {
        console.log('[PushToScreenModal] push acknowledged by player:', payload)
        setSuccess(t('Content received & loaded by player!'))
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = window.setTimeout(onSuccess, 1500)
        
        supabase.removeChannel(channel)
        channelRef.current = null
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[PushToScreenModal] Subscribed to player broadcast channel')
        }
      })

    startTransition(async () => {
      const result = await pushAssetToScreen(teamSlug, selectedScreenId, asset.id)
      if (!result.success) {
        setError(result.error || t('Failed to push asset to screen.'))
        supabase.removeChannel(channel)
        channelRef.current = null
        return
      }

      setSuccess(t('Pushed to {name}. Awaiting player confirmation...', { name: selectedScreen?.name || t('selected screen') }))
      
      // Fallback timeout: if player is offline or not responsive within 5 seconds, close with basic success state
      timeoutRef.current = window.setTimeout(() => {
        setSuccess(t('Pushed successfully!'))
        timeoutRef.current = window.setTimeout(onSuccess, 1000)
        supabase.removeChannel(channel)
        channelRef.current = null
      }, 5000)
    })
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={t('Push to screen')}
      subtitle={asset.file_name}
    >
      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className={styles.successBanner} role="status">
          <Check size={16} />
          <span>{success}</span>
        </div>
      )}

      <div className={styles.tableContainer}>
        <table className={styles.screensTable}>
          <thead className={styles.tableHeader}>
            <tr>
              <th style={{ width: '52px' }}></th>
              <th>{t('Screen')}</th>
              <th>{t('Status')}</th>
              <th>{t('Current content')}</th>
            </tr>
          </thead>
          <tbody>
            {screens.length === 0 ? (
              <tr>
                <td className={styles.emptyCell} colSpan={4}>{t('No screens available.')}</td>
              </tr>
            ) : (
              screens.map(screen => {
                const isSelected = selectedScreenId === screen.id
                const contentLabel = screen.content_type
                  ? screen.content_type
                  : t('no content')

                return (
                  <tr
                    key={screen.id}
                    className={`${styles.tableRow} ${isSelected ? styles.selectedRow : ''}`}
                    onClick={() => setSelectedScreenId(screen.id)}
                  >
                    <td className={styles.tableCell}>
                      <span className={`${styles.radioMark} ${isSelected ? styles.radioMarkSelected : ''}`}>
                        {isSelected && <Check size={13} />}
                      </span>
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.nameCell}>
                        <Monitor size={18} />
                        <span>{screen.name || t('Unnamed Screen')}</span>
                      </div>
                    </td>
                    <td className={styles.tableCell}>
                      <span className={`${styles.statusPill} ${styles[screen.status]}`}>
                        {getScreenStatusLabel(screen.status)}
                      </span>
                    </td>
                    <td className={styles.tableCell}>
                      <span className={styles.contentLabel}>{contentLabel}</span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <footer className={styles.footer}>
        <button className={styles.secondaryBtn} onClick={onClose} type="button">
          {t('Cancel')}
        </button>
        <button
          className={styles.primaryBtn}
          onClick={handlePush}
          type="button"
          disabled={!selectedScreenId || isPending || Boolean(success)}
        >
          {isPending ? t('Pushing...') : t('Push asset')}
        </button>
      </footer>
    </Modal>
  )
}
