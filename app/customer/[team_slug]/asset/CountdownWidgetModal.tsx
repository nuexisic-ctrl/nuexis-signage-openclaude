'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Monitor, Smartphone, Maximize, Hourglass, ChevronDown, Calendar, Clock as ClockIcon } from 'lucide-react'
import styles from './Modal.module.css'
import FlowCountdownRenderer from '@/app/components/FlowCountdownRenderer'
import { modalStack } from '@/lib/utils/modalStack'

interface CountdownWidgetModalProps {
  onClose: () => void
  onSubmit: (name: string, config: {
    text: string
    endTime: string
    endMessage: string
    timerStyle: 'flip' | 'digital' | 'modern' | 'minimal' | 'card'
    daysOnly: boolean
    theme: 'light' | 'dark' | 'sunset' | 'neon' | 'ocean' | 'custom'
    themeSettings: {
      primaryColor?: string
      secondaryColor?: string
      backgroundColor?: string
      textColor?: string
      backgroundImage?: string
    }
  }) => void
  isSubmitting: boolean
}

const NAME_MAX_LENGTH = 100
const TEXT_MAX_LENGTH = 150
const MESSAGE_MAX_LENGTH = 200

const STYLE_OPTIONS = [
  { value: 'card', label: 'Card Layout' },
  { value: 'flip', label: 'Flip Clock' },
  { value: 'digital', label: 'Digital Grid' },
  { value: 'modern', label: 'Modern Accent' },
  { value: 'minimal', label: 'Minimalist' },
] as const

const THEME_OPTIONS = [
  { value: 'dark', label: 'Deep Dark' },
  { value: 'light', label: 'Clean Light' },
  { value: 'sunset', label: 'Sunset Gradient' },
  { value: 'neon', label: 'Neon Glow' },
  { value: 'ocean', label: 'Ocean Breeze' },
  { value: 'custom', label: 'Custom Styles' },
] as const

// ── Reusable custom dropdown with hover preview ─────────────────────────
function HoverPreviewSelect<T extends string>({
  value,
  options,
  onChange,
  onHoverChange,
}: {
  value: T
  options: readonly { value: T; label: string; subtitle?: string }[]
  onChange: (value: T) => void
  onHoverChange: (value: T | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      modalStack.push('countdown-widget-dropdown')
    } else {
      modalStack.pop('countdown-widget-dropdown')
    }
    return () => {
      modalStack.pop('countdown-widget-dropdown')
    }
  }, [open])

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
    hoverTimeoutRef.current = window.setTimeout(() => onHoverChange(val), 1000)
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
        <div data-dropdown="countdown-select" style={menuStyle}>
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
              {opt.subtitle ? (
                <span style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <span>{opt.label}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-subtle)', fontWeight: 400 }}>{opt.subtitle}</span>
                </span>
              ) : opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CountdownWidgetModal({
  onClose,
  onSubmit,
  isSubmitting
}: CountdownWidgetModalProps) {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  
  // Widget specific configuration states
  const [text, setText] = useState('Event Starts In')
  const [endMessage, setEndMessage] = useState('Event Has Begun!')
  const [timerStyle, setTimerStyle] = useState<typeof STYLE_OPTIONS[number]['value']>('card')
  const [daysOnly, setDaysOnly] = useState(false)
  const [theme, setTheme] = useState<typeof THEME_OPTIONS[number]['value']>('dark')
  
  // Theme Settings
  const [primaryColor, setPrimaryColor] = useState('#38bdf8')
  const [secondaryColor, setSecondaryColor] = useState('#818cf8')
  const [backgroundColor, setBackgroundColor] = useState('#090d16')
  const [textColor, setTextColor] = useState('#f8fafc')
  const [backgroundImage, setBackgroundImage] = useState('')

  // Hover preview overrides — applied to live preview while hovering, cleared on revert
  const [previewOverride, setPreviewOverride] = useState<{
    timerStyle?: 'flip' | 'digital' | 'modern' | 'minimal' | 'card'
    theme?: 'light' | 'dark' | 'sunset' | 'neon' | 'ocean' | 'custom'
  }>({})
  
  // Date & Time Picker states
  const [showPicker, setShowPicker] = useState(false)
  const [pickYear, setPickYear] = useState(new Date().getFullYear())
  const [pickMonth, setPickMonth] = useState(new Date().getMonth() + 1)
  const [pickDay, setPickDay] = useState(new Date().getDate() + 1)
  const [pickHour, setPickHour] = useState(12)
  const [pickMinute, setPickMinute] = useState(0)
  const [pickSecond, setPickSecond] = useState(0)
  const [endTimeStr, setEndTimeStr] = useState('')

  const dragStartRef = useRef(false)
  const wasDropdownOpenRef = useRef(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Live simulator orientation & fullscreen
  const [previewMode, setPreviewMode] = useState<'landscape' | 'portrait'>('landscape')
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false)

  // Initialize End Time tomorrow at 12:00 PM
  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(12, 0, 0, 0)
    
    setPickYear(tomorrow.getFullYear())
    setPickMonth(tomorrow.getMonth() + 1)
    setPickDay(tomorrow.getDate())
    setPickHour(12)
    setPickMinute(0)
    setPickSecond(0)
    
    setEndTimeStr(tomorrow.toISOString())
  }, [])

  // Sync date selection to final ISO string
  const updateEndTime = (y: number, m: number, d: number, hr: number, min: number, sec: number) => {
    try {
      const cleanM = Math.max(1, Math.min(12, m))
      const maxDays = new Date(y, cleanM, 0).getDate()
      const cleanD = Math.max(1, Math.min(maxDays, d))
      const cleanHr = Math.max(0, Math.min(23, hr))
      const cleanMin = Math.max(0, Math.min(59, min))
      const cleanSec = Math.max(0, Math.min(59, sec))

      const target = new Date(y, cleanM - 1, cleanD, cleanHr, cleanMin, cleanSec)
      setEndTimeStr(target.toISOString())
    } catch (err) {
      console.error('Error updating end date:', err)
    }
  }

  // Handle outside click to close picker
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    if (showPicker) document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showPicker])

  // Register Datepicker with modalStack
  useEffect(() => {
    if (showPicker) {
      modalStack.push('countdown-widget-picker')
    } else {
      modalStack.pop('countdown-widget-picker')
    }
    return () => {
      modalStack.pop('countdown-widget-picker')
    }
  }, [showPicker])

  // Lock body scroll and register with modalStack
  useEffect(() => {
    modalStack.push('countdown-widget-modal')
    document.body.style.overflow = 'hidden'
    return () => {
      modalStack.pop('countdown-widget-modal')
      document.body.style.overflow = ''
    }
  }, [])

  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFullscreenPreview) {
          setShowFullscreenPreview(false)
        } else if (modalStack.isTop('countdown-widget-modal')) {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showFullscreenPreview, onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || !name.trim() || !endTimeStr) return

    onSubmit(name.trim(), {
      text: text.trim().slice(0, TEXT_MAX_LENGTH),
      endTime: endTimeStr,
      endMessage: endMessage.trim().slice(0, MESSAGE_MAX_LENGTH),
      timerStyle,
      daysOnly,
      theme,
      themeSettings: {
        primaryColor: theme === 'custom' ? primaryColor : undefined,
        secondaryColor: theme === 'custom' ? secondaryColor : undefined,
        backgroundColor: theme === 'custom' ? backgroundColor : undefined,
        textColor: theme === 'custom' ? textColor : undefined,
        backgroundImage: theme === 'custom' && backgroundImage.trim() ? backgroundImage.trim() : undefined,
      }
    })
  }

  const getReadableEndTime = () => {
    if (!endTimeStr) return 'Select date and time...'
    const d = new Date(endTimeStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }

  const handleThemeChange = (selectedTheme: typeof theme) => {
    setTheme(selectedTheme)
    if (selectedTheme === 'light') {
      setPrimaryColor('#4f46e5')
      setSecondaryColor('#0ea5e9')
      setBackgroundColor('#f8fafc')
      setTextColor('#0f172a')
    } else if (selectedTheme === 'dark') {
      setPrimaryColor('#38bdf8')
      setSecondaryColor('#818cf8')
      setBackgroundColor('#090d16')
      setTextColor('#f8fafc')
    } else if (selectedTheme === 'sunset') {
      setPrimaryColor('#fca5a5')
      setSecondaryColor('#f472b6')
      setBackgroundColor('linear-gradient(135deg, #e11d48, #4f46e5)')
      setTextColor('#ffffff')
    } else if (selectedTheme === 'neon') {
      setPrimaryColor('#00f0ff')
      setSecondaryColor('#ff00cc')
      setBackgroundColor('#000000')
      setTextColor('#ffffff')
    } else if (selectedTheme === 'ocean') {
      setPrimaryColor('#22d3ee')
      setSecondaryColor('#0d9488')
      setBackgroundColor('linear-gradient(135deg, #0f172a, #115e59)')
      setTextColor('#ffffff')
    }
  }

  // Active Style and Theme incorporating hover preview overrides
  const activeStyle = previewOverride.timerStyle ?? timerStyle
  const activeTheme = previewOverride.theme ?? theme

  const getThemeColors = (themeName: string) => {
    if (themeName === 'light') {
      return { primaryColor: '#4f46e5', secondaryColor: '#0ea5e9', backgroundColor: '#f8fafc', textColor: '#0f172a' }
    } else if (themeName === 'dark') {
      return { primaryColor: '#38bdf8', secondaryColor: '#818cf8', backgroundColor: '#090d16', textColor: '#f8fafc' }
    } else if (themeName === 'sunset') {
      return { primaryColor: '#fca5a5', secondaryColor: '#f472b6', backgroundColor: 'linear-gradient(135deg, #e11d48, #4f46e5)', textColor: '#ffffff' }
    } else if (themeName === 'neon') {
      return { primaryColor: '#00f0ff', secondaryColor: '#ff00cc', backgroundColor: '#000000', textColor: '#ffffff' }
    } else if (themeName === 'ocean') {
      return { primaryColor: '#22d3ee', secondaryColor: '#0d9488', backgroundColor: 'linear-gradient(135deg, #0f172a, #115e59)', textColor: '#ffffff' }
    }
    return { primaryColor, secondaryColor, backgroundColor, textColor, backgroundImage }
  }

  const activeColors = getThemeColors(activeTheme)

  const simulatedConfig = {
    text,
    endTime: endTimeStr,
    endMessage,
    timerStyle: activeStyle,
    daysOnly,
    theme: activeTheme,
    themeSettings: {
      primaryColor: activeColors.primaryColor,
      secondaryColor: activeColors.secondaryColor,
      backgroundColor: activeColors.backgroundColor,
      textColor: activeColors.textColor,
      backgroundImage: activeColors.backgroundImage?.trim() || undefined,
    }
  }

  // Pre-calculated Dimensions for Scaled Live Simulator Preview Viewport
  const W_land = 560
  const H_land = 315
  const W_port = 270
  const H_port = 480

  const previewW = previewMode === 'landscape' ? W_land : W_port
  const previewH = previewMode === 'landscape' ? H_land : H_port
  const targetW = previewMode === 'landscape' ? 1920 : 1080
  const targetH = previewMode === 'landscape' ? 1080 : 1920
  const scale = previewW / targetW

  const pickerSelectStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 24px 6px 8px',
    borderRadius: '6px',
    background: 'var(--surface-container-lowest)',
    border: '1px solid var(--outline-variant)',
    color: 'var(--on-surface)',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2374777f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    backgroundSize: '12px',
  }

  return (
    <>
      <div 
        className={styles.modalOverlay} 
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            dragStartRef.current = true
            wasDropdownOpenRef.current = !!document.querySelector('[data-dropdown]')
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
          if (modalStack.hasActiveChildOf('countdown-widget-modal')) {
            return
          }
          onClose()
        }}
      >
        <div
          className={styles.modalContainer}
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: '1200px',
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
              <Hourglass size={22} color="var(--primary)" />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)', fontWeight: 600 }}>Create Countdown Widget</h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--on-surface-subtle)' }}>Display beautiful real-time timers for sales, announcements, or events.</p>
              </div>
            </div>
            <button onClick={onClose} className={styles.modalCloseBtn} aria-label="Close modal"><X size={20} /></button>
          </div>

          {/* Body Content with Split View */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            flex: 1,
            background: 'var(--surface-lowest)',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            {/* Left Form Panel */}
            <form onSubmit={handleSubmit} style={{
              flex: '1 1 480px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              borderRight: '1px solid var(--outline-variant)'
            }}>
              {/* Widget Name */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Widget Name*</label>
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
                      setNameError(val.length === NAME_MAX_LENGTH ? `Limit reached (${NAME_MAX_LENGTH}/${NAME_MAX_LENGTH}).` : '')
                    }
                  }}
                  placeholder="e.g. Black Friday Launch Timer"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1.5px solid ${nameError ? '#ef4444' : 'var(--outline-variant)'}`,
                    background: 'var(--surface-container-lowest)', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontSize: '0.92rem', outline: 'none'
                  }}
                />
                {nameError && <span style={{ fontSize: '0.74rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{nameError}</span>}
              </div>

              {/* Text / Label */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Heading Text*</label>
                <input
                  required
                  type="text"
                  value={text}
                  maxLength={TEXT_MAX_LENGTH}
                  onChange={e => setText(e.target.value.slice(0, TEXT_MAX_LENGTH))}
                  placeholder="e.g. Sale Ends In"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--outline-variant)',
                    background: 'var(--surface-container-lowest)', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontSize: '0.92rem', outline: 'none'
                  }}
                />
              </div>

              {/* End Time Date-Time picker */}
              <div style={{ position: 'relative' }} ref={pickerRef}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>End Time*</label>
                <button
                  type="button"
                  onClick={() => setShowPicker(!showPicker)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--outline-variant)',
                    background: 'var(--surface-container-lowest)', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontSize: '0.92rem', outline: 'none',
                    textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} style={{ color: 'var(--primary)' }} />
                    {getReadableEndTime()}
                  </span>
                  <ChevronDown size={14} style={{ opacity: 0.6 }} />
                </button>

                {/* Custom Date Time Picker Dropdown */}
                {showPicker && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface-lowest)',
                    border: '1px solid var(--outline-variant)', borderRadius: '10px', boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
                    zIndex: 100, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Year</label>
                        <select 
                          value={pickYear} 
                          onChange={e => { const val = Number(e.target.value); setPickYear(val); updateEndTime(val, pickMonth, pickDay, pickHour, pickMinute, pickSecond) }}
                          style={pickerSelectStyle}
                        >
                          {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Month</label>
                        <select 
                          value={pickMonth} 
                          onChange={e => { const val = Number(e.target.value); setPickMonth(val); updateEndTime(pickYear, val, pickDay, pickHour, pickMinute, pickSecond) }}
                          style={pickerSelectStyle}
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Day</label>
                        <select 
                          value={pickDay} 
                          onChange={e => { const val = Number(e.target.value); setPickDay(val); updateEndTime(pickYear, pickMonth, val, pickHour, pickMinute, pickSecond) }}
                          style={pickerSelectStyle}
                        >
                          {Array.from({ length: new Date(pickYear, pickMonth, 0).getDate() }, (_, i) => i + 1).map(d => (
                            <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', borderTop: '1px solid var(--outline-variant)', paddingTop: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><ClockIcon size={12}/> Hour</label>
                        <select 
                          value={pickHour} 
                          onChange={e => { const val = Number(e.target.value); setPickHour(val); updateEndTime(pickYear, pickMonth, pickDay, val, pickMinute, pickSecond) }}
                          style={pickerSelectStyle}
                        >
                          {Array.from({ length: 24 }, (_, i) => i).map(h => (
                            <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Minute</label>
                        <select 
                          value={pickMinute} 
                          onChange={e => { const val = Number(e.target.value); setPickMinute(val); updateEndTime(pickYear, pickMonth, pickDay, pickHour, val, pickSecond) }}
                          style={pickerSelectStyle}
                        >
                          {Array.from({ length: 60 }, (_, i) => i).map(m => (
                            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Second</label>
                        <select 
                          value={pickSecond} 
                          onChange={e => { const val = Number(e.target.value); setPickSecond(val); updateEndTime(pickYear, pickMonth, pickDay, pickHour, pickMinute, val) }}
                          style={pickerSelectStyle}
                        >
                          {Array.from({ length: 60 }, (_, i) => i).map(s => (
                            <option key={s} value={s}>{String(s).padStart(2, '0')}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                      <button 
                        type="button" 
                        onClick={() => {
                          const now = new Date()
                          setPickYear(now.getFullYear())
                          setPickMonth(now.getMonth() + 1)
                          setPickDay(now.getDate())
                          setPickHour(now.getHours())
                          setPickMinute(now.getMinutes())
                          setPickSecond(now.getSeconds())
                          setEndTimeStr(now.toISOString())
                        }}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--outline-variant)', background: 'var(--surface-container)', fontSize: '0.78rem', color: 'var(--on-surface)', cursor: 'pointer' }}
                      >
                        Reset to Now
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setShowPicker(false)}
                        style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--primary)', fontSize: '0.78rem', color: 'var(--on-primary)', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* End Message */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>End Message*</label>
                <input
                  required
                  type="text"
                  value={endMessage}
                  maxLength={MESSAGE_MAX_LENGTH}
                  onChange={e => setEndMessage(e.target.value.slice(0, MESSAGE_MAX_LENGTH))}
                  placeholder="e.g. Sale is now closed!"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)',
                    background: 'var(--surface-container-lowest)', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontSize: '0.92rem', outline: 'none'
                  }}
                />
              </div>

              {/* Layout Splitting: Timer Style & Days Only */}
              <div style={{ display: 'flex', gap: '16px', width: '100%', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Timer Style</label>
                  <HoverPreviewSelect
                    value={timerStyle}
                    options={STYLE_OPTIONS}
                    onChange={val => { setTimerStyle(val as any); setPreviewOverride(p => ({ ...p, timerStyle: undefined })) }}
                    onHoverChange={val => setPreviewOverride(p => ({ ...p, timerStyle: val as any ?? undefined }))}
                  />
                </div>

                <div style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600, marginBottom: '8px' }}>Display format</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="daysOnlyCheckbox"
                      checked={daysOnly}
                      onChange={e => setDaysOnly(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                    />
                    <label htmlFor="daysOnlyCheckbox" style={{ fontSize: '0.9rem', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
                      Days Only
                    </label>
                  </div>
                </div>
              </div>

              {/* Theme Settings */}
              <div style={{ borderTop: '1px solid var(--outline-variant)', paddingTop: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Theme Preset</label>
                <HoverPreviewSelect
                  value={theme}
                  options={THEME_OPTIONS}
                  onChange={val => { handleThemeChange(val as any); setPreviewOverride(p => ({ ...p, theme: undefined })) }}
                  onHoverChange={val => setPreviewOverride(p => ({ ...p, theme: val as any ?? undefined }))}
                />

                {theme === 'custom' && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', background: 'rgba(0, 0, 0, 0.03)',
                    border: '1px dashed var(--outline-variant)', borderRadius: '10px', marginTop: '12px'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Primary Color</label>
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={e => setPrimaryColor(e.target.value)}
                          style={{ width: '100%', height: '36px', border: '1px solid var(--outline-variant)', borderRadius: '6px', cursor: 'pointer', padding: '2px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Secondary Color</label>
                        <input
                          type="color"
                          value={secondaryColor}
                          onChange={e => setSecondaryColor(e.target.value)}
                          style={{ width: '100%', height: '36px', border: '1px solid var(--outline-variant)', borderRadius: '6px', cursor: 'pointer', padding: '2px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Background Color</label>
                        <input
                          type="color"
                          value={backgroundColor}
                          onChange={e => setBackgroundColor(e.target.value)}
                          style={{ width: '100%', height: '36px', border: '1px solid var(--outline-variant)', borderRadius: '6px', cursor: 'pointer', padding: '2px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Text Color</label>
                        <input
                          type="color"
                          value={textColor}
                          onChange={e => setTextColor(e.target.value)}
                          style={{ width: '100%', height: '36px', border: '1px solid var(--outline-variant)', borderRadius: '6px', cursor: 'pointer', padding: '2px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Background Image URL (Optional)</label>
                      <input
                        type="text"
                        value={backgroundImage}
                        onChange={e => setBackgroundImage(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--outline-variant)',
                          background: 'var(--surface-container-lowest)', color: 'var(--on-surface)', fontSize: '0.84rem'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </form>

            {/* Right Live Simulator Panel */}
            <div style={{
              flex: '1 1 580px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'rgba(0, 0, 0, 0.02)',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Preview Mode selector buttons */}
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

              {/* Simulated Screen Frame with Scaled Down Target Proportions */}
              <div style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '520px', position: 'relative'
              }}>
                <div style={{
                  width: `${previewW}px`,
                  height: `${previewH}px`,
                  background: '#000000',
                  borderRadius: '8px',
                  border: '1px solid var(--outline-variant)',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div style={{
                    width: `${targetW}px`,
                    height: `${targetH}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }}>
                    <FlowCountdownRenderer
                      text={simulatedConfig.text}
                      endTime={simulatedConfig.endTime}
                      endMessage={simulatedConfig.endMessage}
                      timerStyle={simulatedConfig.timerStyle}
                      daysOnly={simulatedConfig.daysOnly}
                      theme={simulatedConfig.theme}
                      themeSettings={simulatedConfig.themeSettings}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Controls */}
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
                padding: '10px 18px', background: 'transparent', color: 'var(--on-surface-muted)', border: 'none', borderRadius: '8px',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-label)', fontSize: '0.88rem'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim() || !endTimeStr}
              style={{
                padding: '10px 24px',
                background: (!name.trim() || !endTimeStr) ? 'var(--surface-low)' : 'var(--primary)',
                color: (!name.trim() || !endTimeStr) ? 'var(--on-surface-subtle)' : 'var(--on-primary)',
                border: 'none', borderRadius: '8px', fontWeight: 600,
                cursor: (isSubmitting || !name.trim() || !endTimeStr) ? 'not-allowed' : 'pointer',
                opacity: (isSubmitting || !name.trim() || !endTimeStr) ? 0.7 : 1,
                boxShadow: (!name.trim() || !endTimeStr) ? 'none' : '0 4px 12px rgba(9, 76, 178, 0.2)',
                fontFamily: 'var(--font-label)', fontSize: '0.88rem'
              }}
            >
              {isSubmitting ? 'Saving...' : 'Save Widget'}
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Live Preview */}
      {showFullscreenPreview && (
        <div style={{
          position: 'fixed', inset: 0, background: '#05070a', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 200ms ease-out'
        }}>
          <div style={{
            width: previewMode === 'landscape' ? 'min(90vw, calc((90vh * 16) / 9))' : 'min(90vw, calc((90vh * 9) / 16))',
            height: previewMode === 'landscape' ? 'min(90vh, calc((90vw * 9) / 16))' : 'min(90vh, calc((90vw * 16) / 9))',
            background: '#000000', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FlowCountdownRenderer
              text={simulatedConfig.text}
              endTime={simulatedConfig.endTime}
              endMessage={simulatedConfig.endMessage}
              timerStyle={simulatedConfig.timerStyle}
              daysOnly={simulatedConfig.daysOnly}
              theme={simulatedConfig.theme}
              themeSettings={simulatedConfig.themeSettings}
            />
          </div>

          <div style={{
            position: 'absolute', top: '24px', right: '24px', display: 'flex', alignItems: 'center', gap: '12px',
            background: 'rgba(0, 0, 0, 0.6)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)',
            borderRadius: '30px', padding: '6px 16px', color: '#ffffff', fontSize: '0.86rem', fontFamily: 'var(--font-label)', fontWeight: 500, pointerEvents: 'none'
          }}>
            <span>Fullscreen Preview ({previewMode === 'landscape' ? '16:9' : '9:16'})</span>
            <button
              onClick={() => setShowFullscreenPreview(false)}
              style={{
                background: '#ffffff', border: 'none', color: '#000000', borderRadius: '50%', width: '26px', height: '26px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'auto', transition: 'transform 0.2s'
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
