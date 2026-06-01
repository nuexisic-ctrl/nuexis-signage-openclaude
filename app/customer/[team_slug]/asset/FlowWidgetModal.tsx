'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Monitor, Smartphone, Maximize, Clock, ChevronDown } from 'lucide-react'
import styles from './Modal.module.css'
import FlowClockRenderer from '@/app/components/FlowClockRenderer'

interface FlowWidgetModalProps {
  onClose: () => void
  onSubmit: (name: string, config: {
    style: 'classic-digital' | 'modern-digital' | 'classic-analog' | 'modern-analog' | 'minimalist'
    showSeconds: boolean
    showDate: boolean
    use24Hour: boolean
    dateFormat: string
    theme?: 'light' | 'dark'
  }) => void
  isSubmitting: boolean
}

const STYLES_WHITELIST = [
  { id: 'classic-digital', name: 'Classic Digital' },
  { id: 'modern-digital', name: 'Modern Digital' },
  { id: 'classic-analog', name: 'Classic Analog' },
  { id: 'modern-analog', name: 'Modern Analog' },
  { id: 'minimalist', name: 'Minimalist' }
] as const

const DATE_FORMATS_WHITELIST = [
  'January 01, 2024',
  'Monday, January 01, 2024',
  'Mon, Jan 01, 2024',
  '31/01/2024',
  'Monday, 31/01/2024',
  '01/31/2024 (US)',
  '2024-01-31'
] as const

// ── Reusable custom dropdown with hover preview ─────────────────────────
function HoverPreviewSelect<T extends string>({
  value,
  options,
  onChange,
  onHoverChange,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  onHoverChange: (value: T | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onHoverChange(null)
        setOpen(false)
      }
    }
    setTimeout(() => document.addEventListener('mousedown', handler))
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onHoverChange])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onHoverChange(null)
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onHoverChange])

  const debouncedHover = useCallback((val: T | null) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = window.setTimeout(() => onHoverChange(val), 120)
  }, [onHoverChange])

  const selectedLabel = options.find(o => o.value === value)?.label ?? value
  const triggerStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1.5px solid var(--outline-variant)',
    background: 'var(--surface-container-lowest)',
    color: 'var(--on-surface)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.92rem',
    outline: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxSizing: 'border-box',
    overflow: 'hidden',
  }
  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: 'var(--surface-lowest)',
    border: '1px solid var(--outline-variant)',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
    zIndex: 50,
    overflow: 'hidden',
  }
  const itemStyle = (isSelected: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    background: isSelected ? 'var(--surface-container)' : 'transparent',
    color: 'var(--on-surface)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.92rem',
    cursor: 'pointer',
    textAlign: 'left' as const,
    display: 'block',
  })

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={triggerStyle}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
        <ChevronDown size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
      </button>
      {open && (
        <div style={menuStyle}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); onHoverChange(null); setOpen(false) }}
              onMouseEnter={() => debouncedHover(opt.value)}
              onMouseLeave={() => debouncedHover(null)}
              style={itemStyle(opt.value === value)}
              onMouseOver={e => { if (opt.value !== value) e.currentTarget.style.background = 'var(--surface-low)' }}
              onMouseOut={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Modal component ────────────────────────────────────────────────────
export default function FlowWidgetModal({
  onClose,
  onSubmit,
  isSubmitting
}: FlowWidgetModalProps) {
  const [name, setName] = useState('')
  const [style, setStyle] = useState<typeof STYLES_WHITELIST[number]['id']>('classic-digital')
  const [showSeconds, setShowSeconds] = useState(true)
  const [showDate, setShowDate] = useState(true)
  const [use24Hour, setUse24Hour] = useState(false)
  const [dateFormat, setDateFormat] = useState<typeof DATE_FORMATS_WHITELIST[number]>('January 01, 2024')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  // Hover preview overrides — applied to live preview while hovering, cleared on revert
  const [previewOverride, setPreviewOverride] = useState<{ style?: string; dateFormat?: string; theme?: 'light' | 'dark' }>({})

  // Preview Mode: 'landscape' | 'portrait'
  const [previewMode, setPreviewMode] = useState<'landscape' | 'portrait'>('landscape')
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false)

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Listen for Escape key to exit fullscreen preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFullscreenPreview) {
          setShowFullscreenPreview(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showFullscreenPreview, onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || !name.trim()) return

    const validatedStyle = STYLES_WHITELIST.some(s => s.id === style) ? style : 'classic-digital'
    const validatedDateFormat = DATE_FORMATS_WHITELIST.includes(dateFormat) ? dateFormat : 'January 01, 2024'

    onSubmit(name.trim(), {
      style: validatedStyle,
      showSeconds: !!showSeconds,
      showDate: !!showDate,
      use24Hour: !!use24Hour,
      dateFormat: validatedDateFormat,
      theme: theme
    })
  }

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div
          className={styles.modalContainer}
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: '1000px',
            width: '95vw',
            height: 'auto',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 24px',
            borderBottom: '1px solid var(--outline-variant)',
            background: 'rgba(7, 17, 31, 0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={22} color="var(--primary)" />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)', fontWeight: 600 }}>Create Clock Widget</h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--on-surface-subtle)' }}>Deploy elegant, sandboxed, high-performance clocks on your displays.</p>
              </div>
            </div>
            <button onClick={onClose} className={styles.modalCloseBtn} aria-label="Close modal"><X size={20} /></button>
          </div>

          {/* Body content with split view */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            flex: 1,
            overflowY: 'auto',
            background: 'var(--surface-lowest)'
          }}>
            {/* Left: Configuration Inputs */}
            <form onSubmit={handleSubmit} style={{
              flex: '1 1 400px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              borderRight: '1px solid var(--outline-variant)'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.86rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Widget Name</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Lobby Central Clock"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--outline-variant)',
                    background: 'var(--surface-container-lowest)',
                    color: 'var(--on-surface)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.92rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.86rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Clock Style</label>
                <HoverPreviewSelect
                  value={style}
                  options={STYLES_WHITELIST.map(s => ({ value: s.id, label: s.name }))}
                  onChange={val => { setStyle(val as any); setPreviewOverride(p => ({ ...p, style: undefined })) }}
                  onHoverChange={val => setPreviewOverride(p => ({ ...p, style: val ?? undefined }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.86rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Date Format</label>
                <HoverPreviewSelect
                  value={dateFormat}
                  options={DATE_FORMATS_WHITELIST.map(f => ({ value: f, label: f }))}
                  onChange={val => { setDateFormat(val as any); setPreviewOverride(p => ({ ...p, dateFormat: undefined })) }}
                  onHoverChange={val => setPreviewOverride(p => ({ ...p, dateFormat: val ?? undefined }))}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '6px 0' }}>
                <input
                  type="checkbox"
                  id="showSecondsCheckbox"
                  checked={showSeconds}
                  onChange={e => setShowSeconds(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                <label htmlFor="showSecondsCheckbox" style={{ fontSize: '0.9rem', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
                  Show Seconds
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '6px 0' }}>
                <input
                  type="checkbox"
                  id="showDateCheckbox"
                  checked={showDate}
                  onChange={e => setShowDate(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                <label htmlFor="showDateCheckbox" style={{ fontSize: '0.9rem', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
                  Show Date
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '6px 0' }}>
                <input
                  type="checkbox"
                  id="use24HourCheckbox"
                  checked={use24Hour}
                  onChange={e => setUse24Hour(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                <label htmlFor="use24HourCheckbox" style={{ fontSize: '0.9rem', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
                  24-hour Format
                </label>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.86rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Theme</label>
                <HoverPreviewSelect
                  value={theme}
                  options={[
                    { value: 'light', label: 'Light Mode' },
                    { value: 'dark', label: 'Dark Mode' }
                  ]}
                  onChange={val => { setTheme(val as any); setPreviewOverride(p => ({ ...p, theme: undefined })) }}
                  onHoverChange={val => setPreviewOverride(p => ({ ...p, theme: (val as any) ?? undefined }))}
                />
              </div>
            </form>

            {/* Right: Live Interactive Simulator Area */}
            <div style={{
              flex: '1 1 450px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'rgba(0, 0, 0, 0.02)',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Preview mode selectors */}
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(0, 0, 0, 0.05)', padding: '4px', borderRadius: '8px', zIndex: 10 }}>
                <button
                  type="button"
                  onClick={() => setPreviewMode('landscape')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: 'none',
                    background: previewMode === 'landscape' ? '#ffffff' : 'transparent',
                    color: previewMode === 'landscape' ? 'var(--primary)' : 'var(--on-surface-subtle)',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-label)'
                  }}
                >
                  <Monitor size={14} />
                  Landscape (16:9)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('portrait')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: 'none',
                    background: previewMode === 'portrait' ? '#ffffff' : 'transparent',
                    color: previewMode === 'portrait' ? 'var(--primary)' : 'var(--on-surface-subtle)',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-label)'
                  }}
                >
                  <Smartphone size={14} />
                  Portrait (9:16)
                </button>
                <button
                  type="button"
                  onClick={() => setShowFullscreenPreview(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: 'none',
                    background: 'transparent', color: 'var(--on-surface-subtle)',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-label)'
                  }}
                >
                  <Maximize size={14} />
                  Full Screen
                </button>
              </div>

              {/* Viewport */}
              <div style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                minHeight: '420px',
                position: 'relative'
              }}>
                <div style={{
                  width: previewMode === 'landscape' ? '480px' : '225px',
                  height: previewMode === 'landscape' ? '270px' : '400px',
                  background: '#000000',
                  borderRadius: '8px',
                  border: '1px solid var(--outline-variant)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FlowClockRenderer
                    style={(previewOverride.style ?? style) as any}
                    showSeconds={showSeconds}
                    showDate={showDate}
                    use24Hour={use24Hour}
                    dateFormat={previewOverride.dateFormat ?? dateFormat}
                    theme={previewOverride.theme ?? theme}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer controls */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--outline-variant)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            background: 'rgba(7, 17, 31, 0.4)',
            gap: '12px'
          }}>
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
                cursor: 'pointer',
                fontFamily: 'var(--font-label)',
                fontSize: '0.88rem'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim()}
              style={{
                padding: '10px 24px',
                background: !name.trim() ? 'var(--surface-low)' : 'var(--primary)',
                color: !name.trim() ? 'var(--on-surface-subtle)' : 'var(--on-primary)',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: (isSubmitting || !name.trim()) ? 'not-allowed' : 'pointer',
                opacity: (isSubmitting || !name.trim()) ? 0.7 : 1,
                boxShadow: !name.trim() ? 'none' : '0 4px 12px rgba(9, 76, 178, 0.2)',
                fontFamily: 'var(--font-label)',
                fontSize: '0.88rem'
              }}
            >
              {isSubmitting ? 'Saving...' : 'Save Widget'}
            </button>
          </div>
        </div>
      </div>

      {/* FULLSCREEN REAL-TIME LIVE PREVIEW POPUP WITH STRICT RATIO COMPARISON */}
      {showFullscreenPreview && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#05070a',
          zIndex: 100000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 200ms ease-out'
        }}>
          <div style={{
            width: previewMode === 'landscape' ? 'min(90vw, calc((90vh * 16) / 9))' : 'min(90vw, calc((90vh * 9) / 16))',
            height: previewMode === 'landscape' ? 'min(90vh, calc((90vw * 9) / 16))' : 'min(90vh, calc((90vw * 16) / 9))',
            background: '#000000',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FlowClockRenderer
              style={(previewOverride.style ?? style) as any}
              showSeconds={showSeconds}
              showDate={showDate}
              use24Hour={use24Hour}
              dateFormat={previewOverride.dateFormat ?? dateFormat}
              theme={previewOverride.theme ?? theme}
            />
          </div>

          {/* Floating close action banner */}
          <div style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: '30px',
            padding: '6px 16px',
            color: '#ffffff',
            fontSize: '0.86rem',
            fontFamily: 'var(--font-label)',
            fontWeight: 500,
            pointerEvents: 'none'
          }}>
            <span>Fullscreen ({previewMode === 'landscape' ? 'Widescreen 16:9' : 'Kiosk 9:16'})</span>
            <button
              onClick={() => setShowFullscreenPreview(false)}
              style={{
                background: '#ffffff',
                border: 'none',
                color: '#000000',
                borderRadius: '50%',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                pointerEvents: 'auto',
                transition: 'transform 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1.0)'}
              aria-label="Exit fullscreen preview"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
