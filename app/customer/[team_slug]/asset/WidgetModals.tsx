'use client'

import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Link, MonitorPlay, X, ArrowLeft, Code, Clock, QrCode, Check, ChevronDown, Search, History, Hourglass, Timer, ListVideo } from 'lucide-react'
import styles from './Modal.module.css'
import { validateHtml, validateCss } from './validators'
import { t } from '@/lib/i18n'
import CustomCodeEditor from './CustomCodeEditor'
import { AssetBrowserModal } from '../screens/AssetBrowserModal'
import QRCode from 'qrcode'
import { Asset } from './types'

// ── STANDARD POPUP CONFIGURATION MODALS ───────────────────────────────────

interface WidgetSelectionModalProps {
  onClose: () => void
  onSelectYouTube: () => void
  onSelectYouTubePlaylist: () => void
  onSelectRemoteUrl: () => void
  onSelectHtml: () => void
  onSelectFlow: () => void
  onSelectQRCode: () => void
  onSelectCountdown: () => void
  onSelectCountUp: () => void
}

const WIDGET_SEARCH_HISTORY_KEY = 'widget_search_history'
const MAX_HISTORY_ITEMS = 8

function sanitizeSearchQuery(q: string): string {
  return q.trim().slice(0, 100).replace(/[<>"'`]/g, '')
}

function loadSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(WIDGET_SEARCH_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s): s is string => typeof s === 'string').slice(0, MAX_HISTORY_ITEMS)
  } catch {
    return []
  }
}

function saveSearchHistory(query: string, prev: string[]): string[] {
  const sanitized = sanitizeSearchQuery(query)
  if (!sanitized) return prev
  const deduped = [sanitized, ...prev.filter(h => h.toLowerCase() !== sanitized.toLowerCase())].slice(0, MAX_HISTORY_ITEMS)
  try {
    localStorage.setItem(WIDGET_SEARCH_HISTORY_KEY, JSON.stringify(deduped))
  } catch {
    // storage quota exceeded or unavailable — silently ignore
  }
  return deduped
}

export function WidgetSelectionModal({
  onClose,
  onSelectYouTube,
  onSelectYouTubePlaylist,
  onSelectRemoteUrl,
  onSelectHtml,
  onSelectFlow,
  onSelectQRCode,
  onSelectCountdown,
  onSelectCountUp
}: WidgetSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const dragStartRef = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    setSearchHistory(loadSearchHistory())
    return () => { document.body.style.overflow = '' }
  }, [])

  // Close history dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        historyRef.current && !historyRef.current.contains(e.target as Node) &&
        searchRef.current && !searchRef.current.contains(e.target as Node)
      ) {
        setShowHistory(false)
      }
    }
    if (showHistory) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showHistory])

  const ALL_WIDGETS = [
    {
      id: 'countup',
      title: t('Count Up'),
      description: t('Display a live count up timer showing time elapsed since a start time.'),
      icon: Timer,
      color: '#22c55e',
      action: onSelectCountUp
    },
    {
      id: 'countdown',
      title: t('Countdown'),
      description: t('Display a custom countdown timer to an event with various themes and styles.'),
      icon: Hourglass,
      color: '#eab308',
      action: onSelectCountdown
    },
    {
      id: 'clock',
      title: t('Clock'),
      description: t('Show a live analog or digital clock with customizable time zone and style.'),
      icon: Clock,
      color: '#8b5cf6',
      action: onSelectFlow
    },
    {
      id: 'youtube',
      title: t('YouTube Player'),
      description: t('Embed and autoplay public YouTube videos or live streams on your screens.'),
      icon: MonitorPlay,
      color: '#ff0000',
      action: onSelectYouTube
    },
    {
      id: 'youtube_playlist',
      title: t('YouTube Playlist'),
      description: t('Embed and play YouTube playlists with options for captions and shuffle.'),
      icon: ListVideo,
      color: '#ff4444',
      action: onSelectYouTubePlaylist
    },
    {
      id: 'remote_url',
      title: t('Remote URL'),
      description: t('Display any live website or web app on your screens via a remote URL.'),
      icon: Link,
      color: '#4dabf7',
      action: onSelectRemoteUrl
    },
    {
      id: 'html',
      title: t('Text / HTML'),
      description: t('Design rich text, HTML layouts, and animated content with custom CSS.'),
      icon: Code,
      color: 'var(--primary)',
      action: onSelectHtml
    },
    {
      id: 'qrcode',
      title: t('QR Code'),
      description: t('Generate styled QR codes that link to URLs, contact info, or social profiles.'),
      icon: QrCode,
      color: '#a855f7',
      action: onSelectQRCode
    }
  ]

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const filteredWidgets = trimmedQuery
    ? ALL_WIDGETS.filter(w =>
        w.title.toLowerCase().includes(trimmedQuery) ||
        w.description.toLowerCase().includes(trimmedQuery)
      )
    : ALL_WIDGETS

  const handleSearchChange = (val: string) => {
    const sanitized = sanitizeSearchQuery(val)
    setSearchQuery(sanitized)
    setShowHistory(false)
  }

  const handleSearchCommit = () => {
    const sanitized = sanitizeSearchQuery(searchQuery)
    if (!sanitized) return
    setSearchHistory(prev => saveSearchHistory(sanitized, prev))
    setShowHistory(false)
  }

  const handleHistorySelect = (h: string) => {
    setSearchQuery(h)
    setShowHistory(false)
    searchRef.current?.focus()
  }

  const handleClearHistory = (e: React.MouseEvent) => {
    e.stopPropagation()
    try { localStorage.removeItem(WIDGET_SEARCH_HISTORY_KEY) } catch { /* ignore */ }
    setSearchHistory([])
    setShowHistory(false)
  }

  const handleWidgetActivate = (widget: typeof ALL_WIDGETS[0]) => {
    onClose()
    widget.action()
  }

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={(e) => {
        dragStartRef.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && dragStartRef.current) {
          onClose()
        }
      }}
    >
      <div
        className={styles.modalContainer}
        style={{ padding: '28px', maxWidth: '1200px', width: '100%' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>{t('Select Widget')}</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--on-surface-subtle)' }}>
              {t('Choose a widget type to add custom dynamic content to your screens.')}
            </p>
          </div>
          <button onClick={onClose} className={styles.modalCloseBtn} aria-label="Close"><X size={20} /></button>
        </div>

        {/* Search Bar */}
        <div className={styles.widgetSearchWrapper}>
          <div className={styles.widgetSearchBar}>
            <Search size={16} className={styles.widgetSearchIcon} />
            <input
              ref={searchRef}
              type="text"
              className={styles.widgetSearchInput}
              placeholder={t('Search widgets by name or description...')}
              value={searchQuery}
              autoComplete="off"
              aria-label="Search widgets"
              maxLength={100}
              onChange={e => handleSearchChange(e.target.value)}
              onFocus={() => { if (searchHistory.length > 0) setShowHistory(true) }}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSearchCommit()
                if (e.key === 'Escape') { setSearchQuery(''); setShowHistory(false) }
              }}
            />
            {searchQuery && (
              <button
                className={styles.widgetSearchClear}
                onClick={() => { setSearchQuery(''); searchRef.current?.focus() }}
                aria-label="Clear search"
                tabIndex={0}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* History dropdown */}
          {showHistory && searchHistory.length > 0 && (
            <div ref={historyRef} className={styles.widgetSearchHistoryDropdown} role="listbox" aria-label="Recent searches">
              <div className={styles.widgetSearchHistoryHeader}>
                <span className={styles.widgetSearchHistoryLabel}>
                  <History size={12} style={{ marginRight: '5px', flexShrink: 0 }} />
                  {t('Recent Searches')}
                </span>
                <button
                  className={styles.widgetSearchHistoryClear}
                  onClick={handleClearHistory}
                  tabIndex={0}
                >
                  {t('Clear all')}
                </button>
              </div>
              {searchHistory.map((h, i) => (
                <button
                  key={i}
                  className={styles.widgetSearchHistoryItem}
                  role="option"
                  onClick={() => handleHistorySelect(h)}
                  tabIndex={0}
                >
                  <History size={13} style={{ color: 'var(--on-surface-subtle)', flexShrink: 0 }} />
                  <span>{h}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable Container for Widgets */}
        <div style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 190px)', padding: '12px 6px', margin: '0 -6px 0 0' }}>
          {filteredWidgets.length === 0 ? (
            <div className={styles.widgetSearchEmpty}>
              <Search size={28} style={{ opacity: 0.3, marginBottom: '10px' }} />
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--on-surface-subtle)' }}>
                {t('No widgets match')} &ldquo;{searchQuery}&rdquo;
              </p>
              <button
                style={{ marginTop: '8px', fontSize: '0.82rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
                onClick={() => setSearchQuery('')}
              >
                {t('Clear search')}
              </button>
            </div>
          ) : (
            <div className={styles.widgetGrid}>
              {filteredWidgets.map((widget) => {
                const Icon = widget.icon
                return (
                  <div
                    key={widget.id}
                    className={styles.widgetCard}
                    onClick={() => handleWidgetActivate(widget)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleWidgetActivate(widget) }
                    }}
                  >
                    <div
                      className={styles.widgetIconContainer}
                      style={{ backgroundColor: `color-mix(in srgb, ${widget.color} 10%, transparent)` }}
                    >
                      <Icon color={widget.color} size={26} />
                    </div>
                    <h3 className={styles.widgetTitle}>{widget.title}</h3>
                    <p className={styles.widgetDescription}>{widget.description}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>


      </div>
    </div>
  )
}

interface YouTubeWidgetModalProps {
  onClose: () => void
  onBack?: () => void
  onSubmit: (name: string, config: { url: string; ccEnabled: boolean }) => void
  isSubmitting: boolean
  initialData?: { name: string; url: string; ccEnabled?: boolean }
}

export function YouTubeWidgetModal({
  onClose,
  onBack,
  onSubmit,
  isSubmitting,
  initialData,
}: YouTubeWidgetModalProps) {
  const isEditMode = !!initialData
  const [name, setName] = useState(initialData?.name ?? '')
  const [url, setUrl] = useState(initialData?.url ?? '')
  const [ccEnabled, setCcEnabled] = useState(initialData?.ccEnabled ?? false)
  const dragStartRef = useRef(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div 
      className={styles.modalOverlay} 
      onMouseDown={(e) => {
        dragStartRef.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && dragStartRef.current) {
          onClose()
        }
      }}
    >
      <div className={styles.modalContainer} style={{ padding: '24px', maxWidth: '400px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onBack && (
              <button 
                type="button" 
                onClick={onBack} 
                className={styles.modalCloseBtn}
                aria-label="Back to widget selection"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>
              {isEditMode ? t('Edit YouTube Widget') : t('Configure YouTube Widget')}
            </h2>
            {isEditMode && (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: '999px', background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)', fontFamily: 'var(--font-label)', marginLeft: '4px' }}>EDITING</span>
            )}
          </div>
          <button onClick={onClose} className={styles.modalCloseBtn} type="button"><X size={20} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSubmit(name, { url, ccEnabled }); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>{t('Widget Name*')}</label>
            <input 
              required
              maxLength={100}
              value={name}
              onChange={e => setName(e.target.value.slice(0, 100))}
              placeholder={t('e.g. Lobby YouTube Video')}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>{t('YouTube URL*')}</label>
            <input 
              required
              type="url"
              maxLength={255}
              value={url}
              onChange={e => setUrl(e.target.value.slice(0, 255))}
              placeholder={t('https://www.youtube.com/watch?v=...')}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--on-surface)' }}>
              <input
                type="checkbox"
                checked={ccEnabled}
                onChange={e => setCcEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>{t('Enable Captions by Default')}</span>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting || !name || !url}
            style={{ 
              marginTop: '8px', padding: '12px', background: 'var(--primary)', color: 'var(--on-primary)', 
              border: 'none', borderRadius: '8px', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? t('Saving...') : isEditMode ? t('Save Changes') : t('Save Widget')}
          </button>
        </form>
      </div>
    </div>
  )
}

interface RemoteUrlWidgetModalProps {
  onClose: () => void
  onBack?: () => void
  onSubmit: (name: string, url: string) => void
  isSubmitting: boolean
  initialData?: { name: string; url: string }
}

export function RemoteUrlWidgetModal({
  onClose,
  onBack,
  onSubmit,
  isSubmitting,
  initialData,
}: RemoteUrlWidgetModalProps) {
  const isEditMode = !!initialData
  const [name, setName] = useState(initialData?.name ?? '')
  const [url, setUrl] = useState(initialData?.url ?? '')
  const [error, setError] = useState<string | null>(null)
  const dragStartRef = useRef(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function validateAndSubmit() {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        setError('URL must use HTTP or HTTPS protocol')
        return
      }
      setError(null)
      onSubmit(name, url)
    } catch {
      setError('Invalid URL')
    }
  }

  return (
    <div 
      className={styles.modalOverlay} 
      onMouseDown={(e) => {
        dragStartRef.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && dragStartRef.current) {
          onClose()
        }
      }}
    >
      <div className={styles.modalContainer} style={{ padding: '24px', maxWidth: '400px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onBack && (
              <button 
                type="button" 
                onClick={onBack} 
                className={styles.modalCloseBtn}
                aria-label="Back to widget selection"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>
              {isEditMode ? t('Edit Remote URL Widget') : t('Configure Remote URL')}
            </h2>
            {isEditMode && (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: '999px', background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)', fontFamily: 'var(--font-label)', marginLeft: '4px' }}>EDITING</span>
            )}
          </div>
          <button onClick={onClose} className={styles.modalCloseBtn} type="button"><X size={20} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); validateAndSubmit(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div className={styles.errorBanner} role="alert" style={{ margin: '0' }}>
              <AlertTriangle className={styles.errorIcon} size={17} />
              {error}
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>{t('Widget Name*')}</label>
            <input 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('e.g. Remote Weather Display')}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>{t('Media URL (HTTP/HTTPS)*')}</label>
            <input 
              required
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setError(null); }}
              placeholder={t('https://example.com/dashboard')}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting || !name || !url}
            style={{ 
              marginTop: '8px', padding: '12px', background: 'var(--primary)', color: 'var(--on-primary)', 
              border: 'none', borderRadius: '8px', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? t('Saving...') : isEditMode ? t('Save Changes') : t('Save Widget')}
          </button>
        </form>
      </div>
    </div>
  )
}

interface HtmlWidgetPreviewModalProps {
  name: string
  html: string
  css: string
  onClose: () => void
}

export function HtmlWidgetPreviewModal({
  name,
  html,
  css,
  onClose
}: HtmlWidgetPreviewModalProps) {
  const dragStartRef = useRef(false)
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

  const iframeSrcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { margin: 0; padding: 0; box-sizing: border-box; overflow: hidden; background: transparent; }
          ${css}
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `

  return (
    <div 
      className={styles.modalOverlay} 
      onMouseDown={(e) => {
        dragStartRef.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && dragStartRef.current) {
          onClose()
        }
      }}
      role="dialog" 
      aria-modal="true"
    >
      <div className={styles.modalContainer} style={{ maxWidth: '900px', width: '90vw' }}>
        <div className={styles.modalHeader}>
          <div className={styles.modalMeta}>
            <span className={styles.modalTitle} title={name}>{name || t('Widget Preview')}</span>
            <span className={styles.modalMime}>{t('Text/HTML Widget')}</span>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Close preview">
            <X size={24} />
          </button>
        </div>
        
        <div className={styles.modalContent} style={{ display: 'block', background: '#000', overflow: 'hidden', padding: 0 }}>
          <iframe
            title="widget-html-preview"
            srcDoc={iframeSrcDoc}
            style={{ width: '100%', height: '450px', border: 'none', display: 'block', background: 'transparent' }}
            sandbox=""
          />
        </div>
      </div>
    </div>
  )
}

interface HtmlWidgetModalProps {
  onClose: () => void
  onBack?: () => void
  onSubmit: (name: string, html: string, css: string) => void
  isSubmitting: boolean
  teamSlug: string
  initialData?: { name: string; html: string; css: string }
}

export function HtmlWidgetModal({
  onClose,
  onBack,
  onSubmit,
  isSubmitting,
  initialData,
}: HtmlWidgetModalProps) {
  const isEditMode = !!initialData
  const [name, setName] = useState(initialData?.name ?? '')
  const [html, setHtml] = useState(initialData?.html ?? '<!-- Custom HTML widget contents -->\n<div class="lobby-card">\n  <h1>Hello, World</h1>\n</div>')
  const [css, setCss] = useState(initialData?.css ?? '/* Custom styles and animations */\nbody {\n  background: #0f172a;\n  color: #f8fafc;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  min-height: 100vh;\n  margin: 0;\n  font-family: sans-serif;\n}')
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [htmlErrors, setHtmlErrors] = useState<string[]>([])
  const [cssErrors, setCssErrors] = useState<string[]>([])
  const dragStartRef = useRef(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    setHtmlErrors(validateHtml(html))
  }, [html])

  useEffect(() => {
    setCssErrors(validateCss(css))
  }, [css])

  const hasErrors = [...htmlErrors, ...cssErrors].some(err => err.toLowerCase().includes('error'))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (hasErrors) return
    onSubmit(name, html, css)
  }

  return (
    <>
      <div 
        className={styles.modalOverlay} 
        onMouseDown={(e) => {
          dragStartRef.current = e.target === e.currentTarget
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && dragStartRef.current) {
            onClose()
          }
        }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div 
          className={styles.modalContainer} 
          style={{ 
            width: '95vw', 
            maxWidth: '650px', 
            height: 'auto',
            maxHeight: 'none',
            display: 'flex',
            flexDirection: 'column',
            padding: 0
          }} 
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px 24px', 
            borderBottom: '1px solid var(--outline-variant)',
            background: 'rgba(7, 17, 31, 0.4)',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {onBack && (
                <button 
                  type="button" 
                  onClick={onBack} 
                  className={styles.modalCloseBtn}
                  aria-label="Back to widget selection"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>
                  {isEditMode ? t('Edit Text / HTML Widget') : t('Create Text / HTML Widget')}
                </h2>
                {isEditMode && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: '999px', background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)', fontFamily: 'var(--font-label)', display: 'inline-block', marginTop: '4px' }}>EDITING</span>
                )}
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--on-surface-subtle)' }}>{t('Design customized rich-text, layouts, and cards using custom HTML + CSS styling.')}</p>
              </div>
            </div>
            <button onClick={onClose} className={styles.modalCloseBtn} type="button"><X size={20} /></button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('Widget Name*')}</label>
                <input 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('e.g. Lobby Announcement Widget')}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
                />
              </div>

              {/* HTML Editor */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('HTML Code (Body Contents)')}</label>
                </div>
                <CustomCodeEditor
                  value={html}
                  onChange={setHtml}
                  language="html"
                />
              </div>

              {/* CSS Editor */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('CSS Code (Styles & Animations)')}</label>
                </div>
                <CustomCodeEditor
                  value={css}
                  onChange={setCss}
                  language="css"
                />
              </div>

              {/* Real-time Diagnostics */}
              {(htmlErrors.length > 0 || cssErrors.length > 0) && (
                <div style={{ 
                  padding: '12px 16px', 
                  background: 'rgba(239, 68, 68, 0.04)', 
                  border: '1.5px solid rgba(239, 68, 68, 0.12)', 
                  borderRadius: '10px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 600, fontSize: '0.82rem' }}>
                    <AlertTriangle size={16} />
                    <span>{t('Real-time Code Diagnostics & Safety Warnings')}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto', paddingLeft: '24px' }}>
                    {[...htmlErrors, ...cssErrors].map((err, idx) => (
                      <div key={idx} style={{ fontSize: '0.76rem', color: '#fca5a5', lineHeight: '1.4' }}>• {err}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ 
              padding: '16px 24px', 
              borderTop: '1px solid var(--outline-variant)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(7, 17, 31, 0.4)',
              borderBottomLeftRadius: '16px',
              borderBottomRightRadius: '16px'
            }}>
              <button 
                type="button" 
                onClick={() => setShowPreviewModal(true)}
                style={{ 
                  padding: '10px 18px', 
                  background: 'var(--surface-low)', 
                  color: 'var(--primary)', 
                  border: '1px solid var(--outline-variant)', 
                  borderRadius: '8px', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  fontFamily: 'var(--font-label)',
                  fontSize: '0.9rem'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--surface-high)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--surface-low)'}
              >
                {t('Preview')}
              </button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  type="button" 
                  onClick={onClose} 
                  style={{ 
                    padding: '10px 18px', 
                    background: 'transparent', 
                    color: 'var(--on-surface-muted)', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontWeight: 600, 
                    cursor: 'pointer' 
                  }}
                >
                  {t('Cancel')}
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !name || hasErrors}
                  style={{ 
                    padding: '10px 24px', 
                    background: hasErrors ? 'var(--surface-low)' : 'var(--primary)', 
                    color: hasErrors ? 'var(--on-surface-subtle)' : 'var(--on-primary)', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontWeight: 600, 
                    cursor: (isSubmitting || !name || hasErrors) ? 'not-allowed' : 'pointer',
                    opacity: (isSubmitting || !name) ? 0.7 : 1,
                    boxShadow: hasErrors ? 'none' : '0 4px 12px rgba(9, 76, 178, 0.2)'
                  }}
                >
                  {isSubmitting ? t('Saving...') : isEditMode ? t('Save Changes') : t('Save Widget')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {showPreviewModal && (
        <HtmlWidgetPreviewModal 
          name={name}
          html={html}
          css={css}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </>
  )
}

// ── QR CODE WIDGET CREATION AND PREVIEW MODALS ─────────────────────────────

const COUNTRIES = [
    { name: "Afghanistan", code: "AF", phone: 93 },
    { name: "Aland Islands", code: "AX", phone: 358 },
    { name: "Albania", code: "AL", phone: 355 },
    { name: "Algeria", code: "DZ", phone: 213 },
    { name: "American Samoa", code: "AS", phone: 1684 },
    { name: "Andorra", code: "AD", phone: 376 },
    { name: "Angola", code: "AO", phone: 244 },
    { name: "Anguilla", code: "AI", phone: 1264 },
    { name: "Antarctica", code: "AQ", phone: 672 },
    { name: "Antigua and Barbuda", code: "AG", phone: 1268 },
    { name: "Argentina", code: "AR", phone: 54 },
    { name: "Armenia", code: "AM", phone: 374 },
    { name: "Aruba", code: "AW", phone: 297 },
    { name: "Australia", code: "AU", phone: 61 },
    { name: "Austria", code: "AT", phone: 43 },
    { name: "Azerbaijan", code: "AZ", phone: 994 },
    { name: "Bahamas", code: "BS", phone: 1242 },
    { name: "Bahrain", code: "BH", phone: 973 },
    { name: "Bangladesh", code: "BD", phone: 880 },
    { name: "Barbados", code: "BB", phone: 1246 },
    { name: "Belarus", code: "BY", phone: 375 },
    { name: "Belgium", code: "BE", phone: 32 },
    { name: "Belize", code: "BZ", phone: 501 },
    { name: "Benin", code: "BJ", phone: 229 },
    { name: "Bermuda", code: "BM", phone: 1441 },
    { name: "Bhutan", code: "BT", phone: 975 },
    { name: "Bolivia", code: "BO", phone: 591 },
    { name: "Bonaire, Sint Eustatius and Saba", code: "BQ", phone: 599 },
    { name: "Bosnia and Herzegovina", code: "BA", phone: 387 },
    { name: "Botswana", code: "BW", phone: 267 },
    { name: "Bouvet Island", code: "BV", phone: 55 },
    { name: "Brazil", code: "BR", phone: 55 },
    { name: "British Indian Ocean Territory", code: "IO", phone: 246 },
    { name: "Brunei Darussalam", code: "BN", phone: 673 },
    { name: "Bulgaria", code: "BG", phone: 359 },
    { name: "Burkina Faso", code: "BF", phone: 226 },
    { name: "Burundi", code: "BI", phone: 257 },
    { name: "Cambodia", code: "KH", phone: 855 },
    { name: "Cameroon", code: "CM", phone: 237 },
    { name: "Canada", code: "CA", phone: 1 },
    { name: "Cape Verde", code: "CV", phone: 238 },
    { name: "Cayman Islands", code: "KY", phone: 1345 },
    { name: "Central African Republic", code: "CF", phone: 236 },
    { name: "Chad", code: "TD", phone: 235 },
    { name: "Chile", code: "CL", phone: 56 },
    { name: "China", code: "CN", phone: 86 },
    { name: "Christmas Island", code: "CX", phone: 61 },
    { name: "Cocos (Keeling) Islands", code: "CC", phone: 672 },
    { name: "Colombia", code: "CO", phone: 57 },
    { name: "Comoros", code: "KM", phone: 269 },
    { name: "Congo", code: "CG", phone: 242 },
    { name: "Congo, Democratic Republic of the Congo", code: "CD", phone: 242 },
    { name: "Cook Islands", code: "CK", phone: 682 },
    { name: "Costa Rica", code: "CR", phone: 506 },
    { name: "Cote D'Ivoire", code: "CI", phone: 225 },
    { name: "Croatia", code: "HR", phone: 385 },
    { name: "Cuba", code: "CU", phone: 53 },
    { name: "Curacao", code: "CW", phone: 599 },
    { name: "Cyprus", code: "CY", phone: 357 },
    { name: "Czech Republic", code: "CZ", phone: 420 },
    { name: "Denmark", code: "DK", phone: 45 },
    { name: "Djibouti", code: "DJ", phone: 253 },
    { name: "Dominica", code: "DM", phone: 1767 },
    { name: "Dominican Republic", code: "DO", phone: 1809 },
    { name: "Ecuador", code: "EC", phone: 593 },
    { name: "Egypt", code: "EG", phone: 20 },
    { name: "El Salvador", code: "SV", phone: 503 },
    { name: "Equatorial Guinea", code: "GQ", phone: 240 },
    { name: "Eritrea", code: "ER", phone: 291 },
    { name: "Estonia", code: "EE", phone: 372 },
    { name: "Ethiopia", code: "ET", phone: 251 },
    { name: "Falkland Islands (Malvinas)", code: "FK", phone: 500 },
    { name: "Faroe Islands", code: "FO", phone: 298 },
    { name: "Fiji", code: "FJ", phone: 679 },
    { name: "Finland", code: "FI", phone: 358 },
    { name: "France", code: "FR", phone: 33 },
    { name: "French Guiana", code: "GF", phone: 594 },
    { name: "French Polynesia", code: "PF", phone: 689 },
    { name: "French Southern Territories", code: "TF", phone: 262 },
    { name: "Gabon", code: "GA", phone: 241 },
    { name: "Gambia", code: "GM", phone: 220 },
    { name: "Georgia", code: "GE", phone: 995 },
    { name: "Germany", code: "DE", phone: 49 },
    { name: "Ghana", code: "GH", phone: 233 },
    { name: "Gibraltar", code: "GI", phone: 350 },
    { name: "Greece", code: "GR", phone: 30 },
    { name: "Greenland", code: "GL", phone: 299 },
    { name: "Grenada", code: "GD", phone: 1473 },
    { name: "Guadeloupe", code: "GP", phone: 590 },
    { name: "Guam", code: "GU", phone: 1671 },
    { name: "Guatemala", code: "GT", phone: 502 },
    { name: "Guernsey", code: "GG", phone: 44 },
    { name: "Guinea", code: "GN", phone: 224 },
    { name: "Guinea-Bissau", code: "GW", phone: 245 },
    { name: "Guyana", code: "GY", phone: 592 },
    { name: "Haiti", code: "HT", phone: 509 },
    { name: "Heard Island and McDonald Islands", code: "HM", phone: 0 },
    { name: "Holy See (Vatican City State)", code: "VA", phone: 39 },
    { name: "Honduras", code: "HN", phone: 504 },
    { name: "Hong Kong", code: "HK", phone: 852 },
    { name: "Hungary", code: "HU", phone: 36 },
    { name: "Iceland", code: "IS", phone: 354 },
    { name: "India", code: "IN", phone: 91 },
    { name: "Indonesia", code: "ID", phone: 62 },
    { name: "Iran, Islamic Republic of", code: "IR", phone: 98 },
    { name: "Iraq", code: "IQ", phone: 964 },
    { name: "Ireland", code: "IE", phone: 353 },
    { name: "Isle of Man", code: "IM", phone: 44 },
    { name: "Israel", code: "IL", phone: 972 },
    { name: "Italy", code: "IT", phone: 39 },
    { name: "Jamaica", code: "JM", phone: 1876 },
    { name: "Japan", code: "JP", phone: 81 },
    { name: "Jersey", code: "JE", phone: 44 },
    { name: "Jordan", code: "JO", phone: 962 },
    { name: "Kazakhstan", code: "KZ", phone: 7 },
    { name: "Kenya", code: "KE", phone: 254 },
    { name: "Kiribati", code: "KI", phone: 686 },
    { name: "Korea, Democratic People's Republic of", code: "KP", phone: 850 },
    { name: "Korea, Republic of", code: "KR", phone: 82 },
    { name: "Kosovo", code: "XK", phone: 383 },
    { name: "Kuwait", code: "KW", phone: 965 },
    { name: "Kyrgyzstan", code: "KG", phone: 996 },
    { name: "Lao People's Democratic Republic", code: "LA", phone: 856 },
    { name: "Latvia", code: "LV", phone: 371 },
    { name: "Lebanon", code: "LB", phone: 961 },
    { name: "Lesotho", code: "LS", phone: 266 },
    { name: "Liberia", code: "LR", phone: 231 },
    { name: "Libyan Arab Jamahiriya", code: "LY", phone: 218 },
    { name: "Liechtenstein", code: "LI", phone: 423 },
    { name: "Lithuania", code: "LT", phone: 370 },
    { name: "Luxembourg", code: "LU", phone: 352 },
    { name: "Macao", code: "MO", phone: 853 },
    { name: "Macedonia, the Former Yugoslav Republic of", code: "MK", phone: 389 },
    { name: "Madagascar", code: "MG", phone: 261 },
    { name: "Malawi", code: "MW", phone: 265 },
    { name: "Malaysia", code: "MY", phone: 60 },
    { name: "Maldives", code: "MV", phone: 960 },
    { name: "Mali", code: "ML", phone: 223 },
    { name: "Malta", code: "MT", phone: 356 },
    { name: "Marshall Islands", code: "MH", phone: 692 },
    { name: "Martinique", code: "MQ", phone: 596 },
    { name: "Mauritania", code: "MR", phone: 222 },
    { name: "Mauritius", code: "MU", phone: 230 },
    { name: "Mayotte", code: "YT", phone: 262 },
    { name: "Mexico", code: "MX", phone: 52 },
    { name: "Micronesia, Federated States of", code: "FM", phone: 691 },
    { name: "Moldova, Republic of", code: "MD", phone: 373 },
    { name: "Monaco", code: "MC", phone: 377 },
    { name: "Mongolia", code: "MN", phone: 976 },
    { name: "Montenegro", code: "ME", phone: 382 },
    { name: "Montserrat", code: "MS", phone: 1664 },
    { name: "Morocco", code: "MA", phone: 212 },
    { name: "Mozambique", code: "MZ", phone: 258 },
    { name: "Myanmar", code: "MM", phone: 95 },
    { name: "Namibia", code: "NA", phone: 264 },
    { name: "Nauru", code: "NR", phone: 674 },
    { name: "Nepal", code: "NP", phone: 977 },
    { name: "Netherlands", code: "NL", phone: 31 },
    { name: "Netherlands Antilles", code: "AN", phone: 599 },
    { name: "New Caledonia", code: "NC", phone: 687 },
    { name: "New Zealand", code: "NZ", phone: 64 },
    { name: "Nicaragua", code: "NI", phone: 505 },
    { name: "Niger", code: "NE", phone: 227 },
    { name: "Nigeria", code: "NG", phone: 234 },
    { name: "Niue", code: "NU", phone: 683 },
    { name: "Norfolk Island", code: "NF", phone: 672 },
    { name: "Northern Mariana Islands", code: "MP", phone: 1670 },
    { name: "Norway", code: "NO", phone: 47 },
    { name: "Oman", code: "OM", phone: 968 },
    { name: "Pakistan", code: "PK", phone: 92 },
    { name: "Palau", code: "PW", phone: 680 },
    { name: "Palestinian Territory, Occupied", code: "PS", phone: 970 },
    { name: "Panama", code: "PA", phone: 507 },
    { name: "Papua New Guinea", code: "PG", phone: 675 },
    { name: "Paraguay", code: "PY", phone: 595 },
    { name: "Peru", code: "PE", phone: 51 },
    { name: "Philippines", code: "PH", phone: 63 },
    { name: "Pitcairn", code: "PN", phone: 64 },
    { name: "Poland", code: "PL", phone: 48 },
    { name: "Portugal", code: "PT", phone: 351 },
    { name: "Puerto Rico", code: "PR", phone: 1787 },
    { name: "Qatar", code: "QA", phone: 974 },
    { name: "Reunion", code: "RE", phone: 262 },
    { name: "Romania", code: "RO", phone: 40 },
    { name: "Russian Federation", code: "RU", phone: 7 },
    { name: "Rwanda", code: "RW", phone: 250 },
    { name: "Saint Barthelemy", code: "BL", phone: 590 },
    { name: "Saint Helena", code: "SH", phone: 290 },
    { name: "Saint Kitts and Nevis", code: "KN", phone: 1869 },
    { name: "Saint Lucia", code: "LC", phone: 1758 },
    { name: "Saint Martin", code: "MF", phone: 590 },
    { name: "Saint Pierre and Miquelon", code: "PM", phone: 508 },
    { name: "Saint Vincent and the Grenadines", code: "VC", phone: 1784 },
    { name: "Samoa", code: "WS", phone: 684 },
    { name: "San Marino", code: "SM", phone: 378 },
    { name: "Sao Tome and Principe", code: "ST", phone: 239 },
    { name: "Saudi Arabia", code: "SA", phone: 966 },
    { name: "Senegal", code: "SN", phone: 221 },
    { name: "Serbia", code: "RS", phone: 381 },
    { name: "Serbia and Montenegro", code: "CS", phone: 381 },
    { name: "Seychelles", code: "SC", phone: 248 },
    { name: "Sierra Leone", code: "SL", phone: 232 },
    { name: "Singapore", code: "SG", phone: 65 },
    { name: "St Martin", code: "SX", phone: 721 },
    { name: "Slovakia", code: "SK", phone: 421 },
    { name: "Slovenia", code: "SI", phone: 386 },
    { name: "Solomon Islands", code: "SB", phone: 677 },
    { name: "Somalia", code: "SO", phone: 252 },
    { name: "South Africa", code: "ZA", phone: 27 },
    { name: "South Georgia and the South Sandwich Islands", code: "GS", phone: 500 },
    { name: "South Sudan", code: "SS", phone: 211 },
    { name: "Spain", code: "ES", phone: 34 },
    { name: "Sri Lanka", code: "LK", phone: 94 },
    { name: "Sudan", code: "SD", phone: 249 },
    { name: "Suriname", code: "SR", phone: 597 },
    { name: "Svalbard and Jan Mayen", code: "SJ", phone: 47 },
    { name: "Swaziland", code: "SZ", phone: 268 },
    { name: "Sweden", code: "SE", phone: 46 },
    { name: "Switzerland", code: "CH", phone: 41 },
    { name: "Syrian Arab Republic", code: "SY", phone: 963 },
    { name: "Taiwan, Province of China", code: "TW", phone: 886 },
    { name: "Tajikistan", code: "TJ", phone: 992 },
    { name: "Tanzania, United Republic of", code: "TZ", phone: 255 },
    { name: "Thailand", code: "TH", phone: 66 },
    { name: "Timor-Leste", code: "TL", phone: 670 },
    { name: "Togo", code: "TG", phone: 228 },
    { name: "Tokelau", code: "TK", phone: 690 },
    { name: "Tonga", code: "TO", phone: 676 },
    { name: "Trinidad and Tobago", code: "TT", phone: 1868 },
    { name: "Tunisia", code: "TN", phone: 216 },
    { name: "Turkey", code: "TR", phone: 90 },
    { name: "Turkmenistan", code: "TM", phone: 7370 },
    { name: "Turks and Caicos Islands", code: "TC", phone: 1649 },
    { name: "Tuvalu", code: "TV", phone: 688 },
    { name: "Uganda", code: "UG", phone: 256 },
    { name: "Ukraine", code: "UA", phone: 380 },
    { name: "United Arab Emirates", code: "AE", phone: 971 },
    { name: "United Kingdom", code: "GB", phone: 44 },
    { name: "United States", code: "US", phone: 1 },
    { name: "United States Minor Outlying Islands", code: "UM", phone: 1 },
    { name: "Uruguay", code: "UY", phone: 598 },
    { name: "Uzbekistan", code: "UZ", phone: 998 },
    { name: "Vanuatu", code: "VU", phone: 678 },
    { name: "Venezuela", code: "VE", phone: 58 },
    { name: "Viet Nam", code: "VN", phone: 84 },
    { name: "Virgin Islands, British", code: "VG", phone: 1284 },
    { name: "Virgin Islands, U.s.", code: "VI", phone: 1340 },
    { name: "Wallis and Futuna", code: "WF", phone: 681 },
    { name: "Western Sahara", code: "EH", phone: 212 },
    { name: "Yemen", code: "YE", phone: 967 },
    { name: "Zambia", code: "ZM", phone: 260 },
    { name: "Zimbabwe", code: "ZW", phone: 263 }
];

interface Country {
  name: string
  code: string
  phone: number
}

function getEmojiFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return ''
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

function cleanPhoneNumber(phone: string, countryPhoneCode: number): string {
  let cleaned = phone.replace(/\D/g, '')
  const codeStr = countryPhoneCode.toString()
  if (cleaned.startsWith(codeStr)) {
    cleaned = cleaned.slice(codeStr.length)
  }
  return `+${codeStr}${cleaned}`
}

interface CountryCodeSelectorProps {
  selectedCountry: Country
  onSelect: (country: Country) => void
}

function CountryCodeSelector({ selectedCountry, onSelect }: CountryCodeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.toString().includes(searchQuery) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div style={{ position: 'relative', width: '96px', height: '42px', flexShrink: 0 }} ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen)
          setSearchQuery('')
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '0 8px 0 12px',
          background: 'var(--surface-low)',
          border: '1px solid var(--outline-variant)',
          borderRadius: '8px 0 0 8px',
          borderRight: 'none',
          color: 'var(--on-surface)',
          cursor: 'pointer',
          outline: 'none',
          fontSize: '0.9rem',
          fontWeight: 600
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{getEmojiFlag(selectedCountry.code)}</span>
          <span>+{selectedCountry.phone}</span>
        </span>
        <ChevronDown size={14} style={{ opacity: 0.6, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '280px',
            background: 'var(--surface-lowest)',
            border: '1px solid var(--outline-variant)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <input
            type="text"
            placeholder={t('Search Country Name')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--surface-low)',
              border: 'none',
              borderBottom: '1px solid var(--outline-variant)',
              color: 'var(--on-surface)',
              fontSize: '0.86rem',
              outline: 'none'
            }}
          />
          <ol
            data-dropdown="country"
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              maxHeight: '200px',
              overflowY: 'auto'
            }}
          >
            {filteredCountries.map(country => (
              <li
                key={`${country.code}-${country.phone}`}
                onClick={() => {
                  onSelect(country)
                  setIsOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '0.86rem',
                  color: 'var(--on-surface)',
                  background: country.code === selectedCountry.code ? 'var(--surface-high)' : 'transparent',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => {
                  if (country.code !== selectedCountry.code) {
                    e.currentTarget.style.background = 'var(--surface-low)'
                  }
                }}
                onMouseLeave={e => {
                  if (country.code !== selectedCountry.code) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{getEmojiFlag(country.code)}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{country.name}</span>
                </div>
                <strong style={{ fontWeight: 600, color: 'var(--on-surface-subtle)' }}>+{country.phone}</strong>
              </li>
            ))}
            {filteredCountries.length === 0 && (
              <li style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--on-surface-muted)' }}>
                {t('No countries found')}
              </li>
            )}
          </ol>
        </div>
      )}
    </div>
  )
}

function dataURLtoBlob(dataurl: string) {
  const arr = dataurl.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  return `https://${trimmed}`
}

interface QRCodeWidgetModalProps {
  onClose: () => void
  onBack?: () => void
  onSubmit: (name: string, config: {
    type: string
    value: string
    textColor: string
    bgColor: string
    errorCorrection: string
    margin: number
    width: number
  }, file: File) => void
  isSubmitting: boolean
  assets: Asset[]
}

export function QRCodeWidgetModal({
  onClose,
  onBack,
  onSubmit,
  isSubmitting,
  assets
}: QRCodeWidgetModalProps) {
  const [name, setName] = useState('')
  const [qrType, setQrType] = useState('Website URL')
  const [selectedCountry, setSelectedCountry] = useState({ name: "United States", code: "US", phone: 1 })
  const dragStartRef = useRef(false)
  const wasDropdownOpenRef = useRef(false)
  
  // Dynamic fields
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [showAssetBrowser, setShowAssetBrowser] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [smsMessage, setSmsMessage] = useState('')
  const [emailAddress, setEmailAddress] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [facebookUrl, setFacebookUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [twitterUrl, setTwitterUrl] = useState('')

  // Style section
  const [showStyle, setShowStyle] = useState(false)
  const [textColor, setTextColor] = useState('#000000')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [showTextColorPicker, setShowTextColorPicker] = useState(false)
  const [showBgColorPicker, setShowBgColorPicker] = useState(false)
  const textColorPickerRef = useRef<HTMLDivElement>(null)
  const bgColorPickerRef = useRef<HTMLDivElement>(null)

  // Advanced section
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [errorCorrection, setErrorCorrection] = useState('M') // L, M, Q, H
  const [margin, setMargin] = useState(4)
  const [qrWidth, setQrWidth] = useState<number | ''>(512)

  // Preview state
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewDataUrl, setPreviewDataUrl] = useState('')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Outside click handlers for color pickers
  useEffect(() => {
    if (!showTextColorPicker) return
    const handleOutsideClick = (e: MouseEvent) => {
      if (textColorPickerRef.current && !textColorPickerRef.current.contains(e.target as Node)) {
        setShowTextColorPicker(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showTextColorPicker])

  useEffect(() => {
    if (!showBgColorPicker) return
    const handleOutsideClick = (e: MouseEvent) => {
      if (bgColorPickerRef.current && !bgColorPickerRef.current.contains(e.target as Node)) {
        setShowBgColorPicker(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showBgColorPicker])

  // Get current QR code text value
  const getQRCodeValue = () => {
    switch (qrType) {
      case 'Website URL':
        return normalizeUrl(websiteUrl)
      case 'Asset':
        if (!selectedAsset) return ''
        return `${window.location.origin}/api/public/assets/${selectedAsset.id}`
      case 'Phone Number':
        return `tel:${cleanPhoneNumber(phoneNumber, selectedCountry.phone)}`
      case 'SMS':
        return `sms:${cleanPhoneNumber(phoneNumber, selectedCountry.phone)}?body=${encodeURIComponent(smsMessage.trim())}`
      case 'Email':
        return `mailto:${emailAddress.trim()}?subject=${encodeURIComponent(emailSubject.trim())}`
      case 'Facebook':
        return normalizeUrl(facebookUrl)
      case 'Instagram':
        return normalizeUrl(instagramUrl)
      case 'Twitter (X)':
        return normalizeUrl(twitterUrl)
      default:
        return ''
    }
  }

  // Validate form
  const isFormValid = () => {
    if (!name.trim()) return false
    if (!qrType) return false
    
    switch (qrType) {
      case 'Website URL':
        return !!websiteUrl.trim()
      case 'Asset':
        return !!selectedAsset
      case 'Phone Number':
        return !!phoneNumber.trim()
      case 'SMS':
        return !!phoneNumber.trim()
      case 'Email':
        return !!emailAddress.trim()
      case 'Facebook':
        return !!facebookUrl.trim()
      case 'Instagram':
        return !!instagramUrl.trim()
      case 'Twitter (X)':
        return !!twitterUrl.trim()
      default:
        return false
    }
  }

  // Generate QR code data URL (PNG)
  const generateQRCodeDataUrl = async (): Promise<string> => {
    const value = getQRCodeValue()
    if (!value) return ''
    const widthVal = (qrWidth === '' || qrWidth === 0) ? 512 : qrWidth
    try {
      return await QRCode.toDataURL(value, {
        color: {
          dark: textColor,
          light: bgColor
        },
        errorCorrectionLevel: errorCorrection as any,
        margin: margin,
        width: widthVal
      })
    } catch (err) {
      console.error('Failed to generate QR Code:', err)
      return ''
    }
  }

  const handlePreview = async () => {
    const dataUrl = await generateQRCodeDataUrl()
    if (dataUrl) {
      setPreviewDataUrl(dataUrl)
      setShowPreviewModal(true)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid()) return
    const dataUrl = await generateQRCodeDataUrl()
    if (!dataUrl) return

    try {
      const blob = dataURLtoBlob(dataUrl)
      const file = new File([blob], `${name.replace(/\s+/g, '_')}_qrcode.png`, { type: 'image/png' })
      
      onSubmit(name, {
        type: qrType,
        value: getQRCodeValue(),
        textColor,
        bgColor,
        errorCorrection,
        margin,
        width: qrWidth === '' ? 0 : qrWidth
      }, file)
    } catch (err) {
      console.error('Failed to save QR Code asset:', err)
    }
  }

  return (
    <>
      <div 
        className={styles.modalOverlay} 
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            dragStartRef.current = true
            wasDropdownOpenRef.current = !!document.querySelector(
              '[class*="colorPickerPopover"], [data-dropdown]'
            )
          } else {
            dragStartRef.current = false
          }
        }}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return
          if (!dragStartRef.current) return
          if (wasDropdownOpenRef.current) {
            wasDropdownOpenRef.current = false
            return
          }
          onClose()
        }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div 
          className={styles.modalContainer} 
          style={{ 
            width: '95vw', 
            maxWidth: '550px', 
            height: 'auto',
            maxHeight: 'none',
            display: 'flex',
            flexDirection: 'column',
            padding: 0
          }} 
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px 24px', 
            borderBottom: '1px solid var(--outline-variant)',
            background: 'rgba(7, 17, 31, 0.4)',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {onBack && (
                <button 
                  type="button" 
                  onClick={onBack} 
                  className={styles.modalCloseBtn}
                  aria-label="Back to widget selection"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>{t('Create QR Code Widget')}</h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--on-surface-subtle)' }}>{t('Generate and save a customized scannable QR Code as an image asset.')}</p>
              </div>
            </div>
            <button onClick={onClose} className={styles.modalCloseBtn} type="button"><X size={20} /></button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('Name*')}</label>
                <input 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('e.g. WiFi Access QR')}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('QR Code Type*')}</label>
                <select
                  required
                  value={qrType}
                  onChange={e => setQrType(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '10px 14px', 
                    paddingRight: '36px',
                    borderRadius: '8px', 
                    border: '1px solid var(--outline-variant)', 
                    background: 'var(--surface-lowest)', 
                    color: 'var(--on-surface)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.92rem',
                    outline: 'none',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2374777f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '16px'
                  }}
                >
                  <option value="Website URL">{t('Website URL')}</option>
                  <option value="Asset">{t('Asset')}</option>
                  <option value="Phone Number">{t('Phone Number')}</option>
                  <option value="SMS">{t('SMS')}</option>
                  <option value="Email">{t('Email')}</option>
                  <option value="Facebook">{t('Facebook')}</option>
                  <option value="Instagram">{t('Instagram')}</option>
                  <option value="Twitter (X)">{t('Twitter (X)')}</option>
                </select>
              </div>

              {/* Dynamic inputs */}
              {qrType === 'Website URL' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('Website URL*')}</label>
                  <input 
                    required
                    type="text"
                    value={websiteUrl}
                    onChange={e => setWebsiteUrl(e.target.value)}
                    onBlur={() => setWebsiteUrl(normalizeUrl(websiteUrl))}
                    placeholder="https://example.com"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
                  />
                </div>
              )}

              {qrType === 'Asset' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('Asset Selector*')}</label>
                  <div 
                    className={styles.customSelectTrigger} 
                    onClick={() => setShowAssetBrowser(true)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAssetBrowser(true); } }}
                  >
                    <span className={selectedAsset ? styles.selectedText : styles.placeholderText}>
                      {selectedAsset ? selectedAsset.file_name : t('No asset selected')}
                    </span>
                    <button 
                      type="button" 
                      className={styles.browseButton}
                      onClick={(e) => { e.stopPropagation(); setShowAssetBrowser(true); }}
                    >
                      {t('Browse')}
                    </button>
                  </div>
                </div>
              )}

              {qrType === 'Phone Number' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('Phone Number*')}</label>
                  <div style={{ display: 'flex', alignItems: 'center', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', overflow: 'visible' }}>
                    <CountryCodeSelector
                      selectedCountry={selectedCountry}
                      onSelect={setSelectedCountry}
                    />
                    <input 
                      required
                      type="tel"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="Phone Number"
                      style={{ 
                        flex: 1, 
                        height: '42px', 
                        padding: '10px 14px', 
                        border: 'none', 
                        background: 'transparent', 
                        color: 'var(--on-surface)',
                        outline: 'none',
                        fontSize: '0.92rem'
                      }}
                    />
                  </div>
                </div>
              )}

              {qrType === 'SMS' && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('Phone Number*')}</label>
                    <div style={{ display: 'flex', alignItems: 'center', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', overflow: 'visible' }}>
                      <CountryCodeSelector
                        selectedCountry={selectedCountry}
                        onSelect={setSelectedCountry}
                      />
                      <input 
                        required
                        type="tel"
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        placeholder="Phone Number"
                        style={{ 
                          flex: 1, 
                          height: '42px', 
                          padding: '10px 14px', 
                          border: 'none', 
                          background: 'transparent', 
                          color: 'var(--on-surface)',
                          outline: 'none',
                          fontSize: '0.92rem'
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('Message (Optional)')}</label>
                    <textarea 
                      value={smsMessage}
                      onChange={e => setSmsMessage(e.target.value)}
                      placeholder={t('Type message details...')}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)', minHeight: '60px', resize: 'vertical' }}
                    />
                  </div>
                </>
              )}

              {qrType === 'Email' && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('Email Address*')}</label>
                    <input 
                      required
                      type="email"
                      value={emailAddress}
                      onChange={e => setEmailAddress(e.target.value)}
                      placeholder="hello@example.com"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('Subject (Optional)')}</label>
                    <input 
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      placeholder={t('e.g. Scanned Feedback')}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
                    />
                  </div>
                </>
              )}

              {qrType === 'Facebook' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('Profile or Page URL*')}</label>
                  <input 
                    required
                    type="text"
                    value={facebookUrl}
                    onChange={e => setFacebookUrl(e.target.value)}
                    onBlur={() => setFacebookUrl(normalizeUrl(facebookUrl))}
                    placeholder="https://facebook.com/page"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
                  />
                </div>
              )}

              {qrType === 'Instagram' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('Profile URL*')}</label>
                  <input 
                    required
                    type="text"
                    value={instagramUrl}
                    onChange={e => setInstagramUrl(e.target.value)}
                    onBlur={() => setInstagramUrl(normalizeUrl(instagramUrl))}
                    placeholder="https://instagram.com/profile"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
                  />
                </div>
              )}

              {qrType === 'Twitter (X)' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('Profile URL*')}</label>
                  <input 
                    required
                    type="text"
                    value={twitterUrl}
                    onChange={e => setTwitterUrl(e.target.value)}
                    onBlur={() => setTwitterUrl(normalizeUrl(twitterUrl))}
                    placeholder="https://x.com/profile"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
                  />
                </div>
              )}

              {/* Style Section Container */}
              <div className={`${styles.collapsibleContainer} ${showStyle ? styles.collapsibleContainerActive : ''}`}>
                <div 
                  className={styles.collapsibleHeader}
                  onClick={() => setShowStyle(!showStyle)}
                >
                  <span>{t('Theme Settings')}</span>
                  <span>{showStyle ? '▲' : '▼'}</span>
                </div>
                {showStyle && (
                  <div className={styles.collapsibleContent}>
                    <div className={styles.colorPickerFieldRow}>
                      <span style={{ fontSize: '0.86rem', color: 'var(--on-surface-subtle)' }}>{t('Text Color')}</span>
                      <div className={styles.colorPickerInputWrapper}>
                        <input
                          type="text"
                          className={styles.customColorHexInput}
                          style={{ width: '100px', height: '32px' }}
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                        />
                        <button
                          type="button"
                          className={styles.colorIndicatorDot}
                          style={{ backgroundColor: textColor }}
                          onClick={() => setShowTextColorPicker(!showTextColorPicker)}
                        />
                      </div>
                      {showTextColorPicker && (
                        <ColorPickerPopover
                          color={textColor}
                          onChange={setTextColor}
                          onClose={() => setShowTextColorPicker(false)}
                          pickerRef={textColorPickerRef}
                        />
                      )}
                    </div>

                    <div className={styles.colorPickerFieldRow}>
                      <span style={{ fontSize: '0.86rem', color: 'var(--on-surface-subtle)' }}>{t('Background Color')}</span>
                      <div className={styles.colorPickerInputWrapper}>
                        <input
                          type="text"
                          className={styles.customColorHexInput}
                          style={{ width: '100px', height: '32px' }}
                          value={bgColor}
                          onChange={(e) => setBgColor(e.target.value)}
                        />
                        <button
                          type="button"
                          className={styles.colorIndicatorDot}
                          style={{ backgroundColor: bgColor }}
                          onClick={() => setShowBgColorPicker(!showBgColorPicker)}
                        />
                      </div>
                      {showBgColorPicker && (
                        <ColorPickerPopover
                          color={bgColor}
                          onChange={setBgColor}
                          onClose={() => setShowBgColorPicker(false)}
                          pickerRef={bgColorPickerRef}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Advanced Section Container */}
              <div className={`${styles.collapsibleContainer} ${showAdvanced ? styles.collapsibleContainerActive : ''}`}>
                <div 
                  className={styles.collapsibleHeader}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <span>{t('Advanced Settings')}</span>
                  <span>{showAdvanced ? '▲' : '▼'}</span>
                </div>
                {showAdvanced && (
                  <div className={styles.collapsibleContent}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-subtle)' }}>{t('Error Correction Level')}</label>
                      <select
                        value={errorCorrection}
                        onChange={e => setErrorCorrection(e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '8px 12px', 
                          paddingRight: '36px',
                          borderRadius: '6px', 
                          border: '1px solid var(--outline-variant)', 
                          background: 'var(--surface-low)', 
                          color: 'var(--on-surface)',
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.92rem',
                          outline: 'none',
                          cursor: 'pointer',
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2374777f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 12px center',
                          backgroundSize: '16px'
                        }}
                      >
                        <option value="L">{t('Low (7%)')}</option>
                        <option value="M">{t('Medium (15%)')}</option>
                        <option value="Q">{t('Quartile (25%)')}</option>
                        <option value="H">{t('High (30%)')}</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-subtle)' }}>{t('Margin (Modules)')}</label>
                      <input 
                        type="number"
                        min={0}
                        max={10}
                        value={margin}
                        onChange={e => setMargin(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--outline-variant)', background: 'var(--surface-low)', color: 'var(--on-surface)' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--on-surface-subtle)' }}>{t('Resolution Width (px)')}</label>
                      <input 
                        type="number"
                        min={0}
                        max={2048}
                        value={qrWidth}
                        onChange={e => {
                          const val = e.target.value
                          if (val === '') {
                            setQrWidth('')
                          } else {
                            const num = Number(val)
                            if (!isNaN(num)) {
                              setQrWidth(Math.max(0, Math.min(num, 2048)))
                            }
                          }
                        }}
                        onBlur={() => {
                          if (qrWidth === '') {
                            setQrWidth(0)
                          }
                        }}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--outline-variant)', background: 'var(--surface-low)', color: 'var(--on-surface)' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer controls */}
            <div style={{ 
              padding: '16px 24px', 
              borderTop: '1px solid var(--outline-variant)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(7, 17, 31, 0.4)',
              borderBottomLeftRadius: '16px',
              borderBottomRightRadius: '16px'
            }}>
              <button 
                type="button" 
                onClick={handlePreview}
                disabled={!isFormValid()}
                style={{ 
                  padding: '10px 18px', 
                  background: 'var(--surface-low)', 
                  color: 'var(--primary)', 
                  border: '1px solid var(--outline-variant)', 
                  borderRadius: '8px', 
                  fontWeight: 600, 
                  cursor: !isFormValid() ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-label)',
                  fontSize: '0.9rem',
                  opacity: !isFormValid() ? 0.5 : 1
                }}
              >
                {t('Preview')}
              </button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  type="button" 
                  onClick={onClose} 
                  style={{ 
                    padding: '10px 18px', 
                    background: 'transparent', 
                    color: 'var(--on-surface-muted)', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontWeight: 600, 
                    cursor: 'pointer' 
                  }}
                >
                  {t('Cancel')}
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !isFormValid()}
                  style={{ 
                    padding: '10px 24px', 
                    background: !isFormValid() ? 'var(--surface-low)' : 'var(--primary)', 
                    color: !isFormValid() ? 'var(--on-surface-subtle)' : 'var(--on-primary)', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontWeight: 600, 
                    cursor: (isSubmitting || !isFormValid()) ? 'not-allowed' : 'pointer',
                    opacity: (isSubmitting || !name) ? 0.7 : 1,
                    boxShadow: !isFormValid() ? 'none' : '0 4px 12px rgba(9, 76, 178, 0.2)'
                  }}
                >
                  {isSubmitting ? t('Saving...') : t('Save Widget')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {showAssetBrowser && (
        <AssetBrowserModal
          assets={assets}
          onClose={() => setShowAssetBrowser(false)}
          onSelect={(id) => {
            const ast = assets.find(a => a.id === id)
            if (ast) setSelectedAsset(ast)
            setShowAssetBrowser(false)
          }}
        />
      )}

      {showPreviewModal && (
        <QRCodePreviewModal
          name={name}
          dataUrl={previewDataUrl}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </>
  )
}

interface QRCodePreviewModalProps {
  name: string
  dataUrl: string
  onClose: () => void
}

export function QRCodePreviewModal({
  name,
  dataUrl,
  onClose
}: QRCodePreviewModalProps) {
  const dragStartRef = useRef(false)
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

  return (
    <div 
      className={styles.modalOverlay} 
      onMouseDown={(e) => {
        dragStartRef.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && dragStartRef.current) {
          onClose()
        }
      }}
      role="dialog" 
      aria-modal="true" 
      style={{ zIndex: 10000 }}
    >
      <div className={styles.modalContainer} style={{ maxWidth: '450px', width: '90vw' }}>
        <div className={styles.modalHeader}>
          <div className={styles.modalMeta}>
            <span className={styles.modalTitle} title={name}>{name || t('QR Code Preview')}</span>
            <span className={styles.modalMime}>{t('QR Code Widget')}</span>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Close preview">
            <X size={24} />
          </button>
        </div>
        
        <div className={styles.modalContent} style={{ display: 'flex', background: '#000', overflow: 'hidden', padding: '32px', justifyContent: 'center', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt="QR Code Preview"
            style={{ maxWidth: '100%', maxHeight: '350px', objectFit: 'contain', display: 'block', background: 'transparent' }}
          />
        </div>
      </div>
    </div>
  )
}

function ColorPickerPopover({
  color,
  onChange,
  onClose,
  pickerRef
}: {
  color: string
  onChange: (color: string) => void
  onClose: () => void
  pickerRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div className={styles.colorPickerPopover} ref={pickerRef} style={{ right: 0, top: 'calc(100% + 4px)' }}>
      <div className={styles.popoverHeader}>
        <span className={styles.popoverTitle}>{t('Select Color')}</span>
        <button 
          type="button" 
          className={styles.popoverCloseBtn} 
          onClick={onClose}
        >
          <X size={12} />
        </button>
      </div>
      
      <div className={styles.predefinedColorsGrid}>
        {PRESET_COLORS.map((c) => {
          const isSelected = color.toLowerCase() === c.toLowerCase()
          return (
            <button
              type="button"
              key={c}
              className={`${styles.colorOptionBubble} ${isSelected ? styles.colorOptionBubbleSelected : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => onChange(c)}
            >
              {isSelected && <Check size={10} style={{ color: c === '#ffffff' ? '#000' : '#fff' }} />}
            </button>
          )
        })}
      </div>
      
      <div className={styles.customColorSection}>
        <label className={styles.customColorLabel}>{t('Custom Color')}</label>
        <div className={styles.customColorRow}>
          <input
            type="color"
            className={styles.customColorInput}
            value={color}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            type="text"
            className={styles.customColorHexInput}
            value={color}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

const PRESET_COLORS = [
  '#000000', // black
  '#ffffff', // white
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#78716c', // stone
  '#737373', // neutral
  '#525252', // neutral-dark
  '#64748b', // slate
  '#475569', // slate-dark
  '#334155', // slate-deep
]

// ── YOUTUBE PLAYLIST WIDGET CONFIGURATION & HELPERS ───────────────────────

export interface YouTubePlaylistConfig {
  url: string
  ccEnabled: boolean
  shuffleEnabled: boolean
}

export function parseYouTubePlaylistConfig(filePath: string): YouTubePlaylistConfig {
  try {
    const parsed = JSON.parse(filePath)
    if (parsed && typeof parsed === 'object') {
      return {
        url: parsed.url || '',
        ccEnabled: !!parsed.ccEnabled,
        shuffleEnabled: !!parsed.shuffleEnabled
      }
    }
  } catch {}
  return {
    url: filePath || '',
    ccEnabled: false,
    shuffleEnabled: false
  }
}

export interface YouTubeWidgetConfig {
  url: string
  ccEnabled: boolean
}

export function parseYouTubeConfig(filePath: string): YouTubeWidgetConfig {
  try {
    const parsed = JSON.parse(filePath)
    if (parsed && typeof parsed === 'object') {
      return {
        url: parsed.url || '',
        ccEnabled: !!parsed.ccEnabled
      }
    }
  } catch {}
  return {
    url: filePath || '',
    ccEnabled: false
  }
}

export function extractYouTubePlaylistId(url: string): string {
  if (!url) return ''
  const listParam = url.match(/[?&]list=([^#\&\?]+)/)
  if (listParam) return listParam[1]
  const trimmed = url.trim()
  if (/^[A-Za-z0-9_-]{18,40}$/.test(trimmed)) {
    return trimmed
  }
  return ''
}

interface YouTubePlaylistWidgetModalProps {
  onClose: () => void
  onBack?: () => void
  onSubmit: (name: string, config: { url: string; ccEnabled: boolean; shuffleEnabled: boolean }) => void
  isSubmitting: boolean
  initialData?: { name: string; url: string; ccEnabled: boolean; shuffleEnabled: boolean }
}

export function YouTubePlaylistWidgetModal({
  onClose,
  onBack,
  onSubmit,
  isSubmitting,
  initialData,
}: YouTubePlaylistWidgetModalProps) {
  const isEditMode = !!initialData
  const [name, setName] = useState(initialData?.name ?? '')
  const [url, setUrl] = useState(initialData?.url ?? '')
  const [ccEnabled, setCcEnabled] = useState(initialData?.ccEnabled ?? false)
  const [shuffleEnabled, setShuffleEnabled] = useState(initialData?.shuffleEnabled ?? false)
  const [error, setError] = useState<string | null>(null)
  const dragStartRef = useRef(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedUrl = url.trim()

    if (!trimmedName || !trimmedUrl) {
      setError(t('Widget Name and YouTube Playlist Link are required.'))
      return
    }

    const playlistId = extractYouTubePlaylistId(trimmedUrl)
    if (!playlistId) {
      setError(t('Invalid YouTube playlist URL or ID. Please make sure it contains a playlist ID (e.g., list=...)'))
      return
    }

    setError(null)
    onSubmit(trimmedName, {
      url: trimmedUrl,
      ccEnabled,
      shuffleEnabled
    })
  }

  return (
    <div 
      className={styles.modalOverlay} 
      onMouseDown={(e) => {
        dragStartRef.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && dragStartRef.current) {
          onClose()
        }
      }}
    >
      <div className={styles.modalContainer} style={{ padding: '24px', maxWidth: '400px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onBack && (
              <button 
                type="button" 
                onClick={onBack} 
                className={styles.modalCloseBtn}
                aria-label="Back to widget selection"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>
              {isEditMode ? t('Edit YouTube Playlist') : t('Configure YouTube Playlist')}
            </h2>
            {isEditMode && (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: '999px', background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)', fontFamily: 'var(--font-label)', marginLeft: '4px' }}>EDITING</span>
            )}
          </div>
          <button onClick={onClose} className={styles.modalCloseBtn} type="button"><X size={20} /></button>
        </div>
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div className={styles.errorBanner} role="alert" style={{ margin: '0', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>{t('App Name*')}</label>
            <input 
              required
              maxLength={100}
              value={name}
              onChange={e => { setName(e.target.value.slice(0, 100)); setError(null); }}
              placeholder={t('e.g. Lobby Playlist')}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>{t('YouTube Playlist Link*')}</label>
            <input 
              required
              type="url"
              maxLength={255}
              value={url}
              onChange={e => { setUrl(e.target.value.slice(0, 255)); setError(null); }}
              placeholder={t('https://www.youtube.com/playlist?list=...')}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--on-surface)' }}>
              <input
                type="checkbox"
                checked={ccEnabled}
                onChange={e => setCcEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>{t('Captions*')}</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--on-surface)' }}>
              <input
                type="checkbox"
                checked={shuffleEnabled}
                onChange={e => setShuffleEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>{t('Shuffle*')}</span>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting || !name || !url}
            style={{ 
              marginTop: '12px', padding: '12px', background: 'var(--primary)', color: 'var(--on-primary)', 
              border: 'none', borderRadius: '8px', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? t('Saving...') : isEditMode ? t('Save Changes') : t('Save Widget')}
          </button>
        </form>
      </div>
    </div>
  )
}
