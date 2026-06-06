'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Monitor, Smartphone, Maximize, Clock, ChevronDown, ArrowLeft } from 'lucide-react'
import styles from './Modal.module.css'
import FlowClockRenderer from '@/app/components/FlowClockRenderer'
import { modalStack } from '@/lib/utils/modalStack'

interface FlowWidgetModalProps {
  onClose: () => void
  onBack?: () => void
  onSubmit: (name: string, config: {
    style: 'classic-digital' | 'modern-digital' | 'classic-analog' | 'modern-analog' | 'minimalist' | 'neon-digital' | 'boardroom-serif'
    showSeconds: boolean
    showDate: boolean
    use24Hour: boolean
    dateFormat: string
    theme?: 'light' | 'dark'
  }) => void
  isSubmitting: boolean
}

const NAME_MAX_LENGTH = 100

const STYLES_WHITELIST = [
  { id: 'classic-digital',  name: 'Classic Digital' },
  { id: 'modern-digital',   name: 'Urban Digital' },
  { id: 'classic-analog',   name: 'Heritage Analog' },
  { id: 'modern-analog',    name: 'Precision Analog' },
  { id: 'minimalist',       name: 'Dashboard' },
  { id: 'boardroom-serif',  name: 'Boardroom Serif' },
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
  const optionsRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<number | null>(null)

  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })

  const updateCoords = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      })
    }
  }, [])

  useEffect(() => {
    if (open) {
      updateCoords()
      window.addEventListener('resize', updateCoords)
      window.addEventListener('scroll', updateCoords, true)
    }
    return () => {
      window.removeEventListener('resize', updateCoords)
      window.removeEventListener('scroll', updateCoords, true)
    }
  }, [open, updateCoords])

  useEffect(() => {
    if (open) {
      modalStack.push('flow-widget-dropdown')
    } else {
      modalStack.pop('flow-widget-dropdown')
    }
    return () => {
      modalStack.pop('flow-widget-dropdown')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        (!optionsRef.current || !optionsRef.current.contains(e.target as Node))
      ) {
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
    top: `${coords.top + 4}px`,
    left: `${coords.left}px`,
    width: `${coords.width}px`,
    background: 'var(--surface-lowest)',
    border: '1px solid var(--outline-variant)',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
    zIndex: 99999,
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
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={optionsRef} data-dropdown="flow-select" style={menuStyle}>
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
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Modal component ────────────────────────────────────────────────────
export default function FlowWidgetModal({
  onClose,
  onBack,
  onSubmit,
  isSubmitting
}: FlowWidgetModalProps) {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [style, setStyle] = useState<typeof STYLES_WHITELIST[number]['id']>('classic-digital')
  const [showSeconds, setShowSeconds] = useState(true)
  const [showDate, setShowDate] = useState(true)
  const [use24Hour, setUse24Hour] = useState(false)
  const [dateFormat, setDateFormat] = useState<typeof DATE_FORMATS_WHITELIST[number]>('January 01, 2024')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const dragStartRef = useRef(false)
  const wasDropdownOpenRef = useRef(false)

  // Hover preview overrides — applied to live preview while hovering, cleared on revert
  const [previewOverride, setPreviewOverride] = useState<{ style?: string; dateFormat?: string; theme?: 'light' | 'dark' }>({})

  // Preview Mode: 'landscape' | 'portrait'
  const [previewMode, setPreviewMode] = useState<'landscape' | 'portrait'>('landscape')
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false)

  // Lock body scroll while modal is open and register with modalStack
  useEffect(() => {
    modalStack.push('flow-widget-modal')
    document.body.style.overflow = 'hidden'
    return () => {
      modalStack.pop('flow-widget-modal')
      document.body.style.overflow = ''
    }
  }, [])

  // Listen for Escape key to exit fullscreen preview or close modal based on stack priority
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFullscreenPreview) {
          setShowFullscreenPreview(false)
        } else if (modalStack.isTop('flow-widget-modal')) {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
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
          if (modalStack.hasActiveChildOf('flow-widget-modal')) {
            return
          }
          onClose()
        }}
      >
        <div
          className={styles.modalContainer}
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: '1000px',
            width: '95vw',
            height: 'auto',
            maxHeight: 'none',
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
              <Clock size={22} color="var(--primary)" />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)', fontWeight: 600 }}>Create Clock Widget</h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--on-surface-subtle)' }}>Deploy elegant, sandboxed, high-performance clocks on your displays.</p>
              </div>
            </div>
            <button onClick={onClose} className={styles.modalCloseBtn} type="button" aria-label="Close modal"><X size={20} /></button>
          </div>

          {/* Body content with split view */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            flex: 1,
            overflow: 'visible',
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
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.86rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Widget Name*</label>
                <input
                  required
                  type="text"
                  value={name}
                  maxLength={NAME_MAX_LENGTH}
                  onChange={e => {
                    const val = e.target.value
                    if (val.length > NAME_MAX_LENGTH) {
                      setName(val.slice(0, NAME_MAX_LENGTH))
                      setNameError(`Name cannot exceed ${NAME_MAX_LENGTH} characters.`)
                    } else {
                      setName(val)
                      setNameError(val.length === NAME_MAX_LENGTH
                        ? `Character limit reached (${NAME_MAX_LENGTH}/${NAME_MAX_LENGTH}).`
                        : ''
                      )
                    }
                  }}
                  placeholder="e.g. Lobby Central Clock"
                  aria-describedby={nameError ? 'name-error' : undefined}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1.5px solid ${nameError ? '#ef4444' : 'var(--outline-variant)'}`,
                    background: 'var(--surface-container-lowest)',
                    color: 'var(--on-surface)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.92rem',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', minHeight: '18px' }}>
                  {nameError ? (
                    <span
                      id="name-error"
                      role="alert"
                      style={{ fontSize: '0.76rem', color: '#ef4444', fontFamily: 'var(--font-body)', fontWeight: 500 }}
                    >
                      {nameError}
                    </span>
                  ) : <span />}
                  {name.length >= Math.floor(NAME_MAX_LENGTH * 0.8) && (
                    <span style={{
                      fontSize: '0.72rem',
                      color: name.length >= NAME_MAX_LENGTH ? '#ef4444' : 'var(--on-surface-subtle)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      flexShrink: 0,
                    }}>
                      {name.length}/{NAME_MAX_LENGTH}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.86rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Clock Style*</label>
                <HoverPreviewSelect
                  value={style}
                  options={STYLES_WHITELIST.map(s => ({ value: s.id, label: s.name }))}
                  onChange={val => { setStyle(val as any); setPreviewOverride(p => ({ ...p, style: undefined })) }}
                  onHoverChange={val => setPreviewOverride(p => ({ ...p, style: val ?? undefined }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.86rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Date Format*</label>
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
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.86rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Color Style*</label>
                <select
                  value={theme}
                  onChange={e => {
                    setTheme(e.target.value as 'light' | 'dark')
                    setPreviewOverride(p => ({ ...p, theme: undefined }))
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    paddingRight: '36px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--outline-variant)',
                    background: 'var(--surface-container-lowest)',
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
                    backgroundSize: '16px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
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
            gap: '12px',
            borderBottomLeftRadius: '16px',
            borderBottomRightRadius: '16px'
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
