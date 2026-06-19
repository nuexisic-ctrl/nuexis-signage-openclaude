'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from '@/lib/i18n'
import Link from 'next/link'
import {
  ListVideo, ChevronRight, Undo2, Redo2, Eye,
  Monitor, Copy, Trash2, MoreHorizontal
} from 'lucide-react'
import styles from '../workspace.module.css'

interface WorkspaceHeaderProps {
  name: string
  teamSlug: string
  saveStatus: 'saved' | 'saving' | 'unsaved'
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onPreviewToggle: () => void
  onPushToScreen: () => void
  onDuplicate: () => void
  onDelete: () => void
  onRename: (newName: string) => void
  isPreviewOpen: boolean
}

export default function WorkspaceHeader({
  name,
  teamSlug,
  saveStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPreviewToggle,
  onPushToScreen,
  onDuplicate,
  onDelete,
  onRename,
  isPreviewOpen,
}: WorkspaceHeaderProps) {
  const { t } = useTranslation()
  const [editName, setEditName] = useState(name)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setEditName(name)
  }, [name])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  const handleNameBlur = () => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== name) {
      onRename(trimmed)
    } else {
      setEditName(name)
    }
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      ;(e.target as HTMLInputElement).blur()
    }
    if (e.key === 'Escape') {
      setEditName(name)
      ;(e.target as HTMLInputElement).blur()
    }
  }

  const saveStatusConfig = {
    saved: { label: t('All changes saved'), dot: styles.saveStatusDotSaved },
    saving: { label: t('Saving...'), dot: styles.saveStatusDotSaving },
    unsaved: { label: t('Unsaved changes'), dot: styles.saveStatusDotUnsaved },
  }

  const statusInfo = saveStatusConfig[saveStatus]

  return (
    <div className={styles.workspaceHeader}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link href={`/customer/${teamSlug}/playlists`} className={styles.breadcrumbLink}>
          {t('Playlists')}
        </Link>
        <ChevronRight size={12} className={styles.breadcrumbSep} />
        <span className={styles.breadcrumbCurrent}>{name}</span>
      </nav>

      {/* Title row */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <div className={styles.titleIcon}>
            <ListVideo size={20} />
          </div>
          <input
            type="text"
            className={styles.titleInput}
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            aria-label={t('Playlist Name')}
            maxLength={200}
          />
        </div>

        <div className={styles.actions}>
          {/* Undo */}
          <button
            className={`${styles.actionBtn} ${styles.actionBtnIcon}`}
            onClick={onUndo}
            disabled={!canUndo}
            title={t('Undo') + ' (Ctrl+Z)'}
            aria-label={t('Undo')}
          >
            <Undo2 size={16} />
          </button>

          {/* Redo */}
          <button
            className={`${styles.actionBtn} ${styles.actionBtnIcon}`}
            onClick={onRedo}
            disabled={!canRedo}
            title={t('Redo') + ' (Ctrl+Shift+Z)'}
            aria-label={t('Redo')}
          >
            <Redo2 size={16} />
          </button>

          {/* Preview */}
          <button
            className={`${styles.actionBtn} ${isPreviewOpen ? styles.actionBtnPrimary : ''}`}
            onClick={onPreviewToggle}
          >
            <Eye size={15} />
            <span className="actionBtnLabel">{t('Preview')}</span>
          </button>

          {/* Push to Screen */}
          <button className={styles.actionBtn} onClick={onPushToScreen}>
            <Monitor size={15} />
            <span className="actionBtnLabel">{t('Push to Screen')}</span>
          </button>

          {/* More menu */}
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              className={`${styles.actionBtn} ${styles.actionBtnIcon}`}
              onClick={() => setShowMenu(!showMenu)}
              aria-label={t('More actions')}
            >
              <MoreHorizontal size={16} />
            </button>

            {showMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                background: 'var(--surface-lowest)',
                border: '1px solid var(--outline-variant)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-modal)',
                minWidth: '180px',
                zIndex: 50,
                overflow: 'hidden',
              }}>
                <button
                  onClick={() => { setShowMenu(false); onDuplicate() }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '11px 16px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--on-surface)',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-low)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Copy size={15} /> {t('Duplicate Playlist')}
                </button>
                <div style={{ height: '1px', background: 'var(--outline-variant)' }} />
                <button
                  onClick={() => { setShowMenu(false); onDelete() }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '11px 16px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--error)',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--error-container)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Trash2 size={15} /> {t('Delete Playlist')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save status */}
      <div className={styles.saveStatus}>
        <span className={`${styles.saveStatusDot} ${statusInfo.dot}`} />
        {statusInfo.label}
      </div>
    </div>
  )
}
