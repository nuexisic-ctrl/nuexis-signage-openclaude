'use client'

import { useEffect, useMemo, useState } from 'react'

const STYLE_ID = 'flow-countup-styles-v1'

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,300;0,400;0,600&family=Public+Sans:wght@300;400;500;600;700;800&family=Share+Tech+Mono&display=swap');

.fcu-root {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  background: var(--fcu-bg, #090d16);
  color: var(--fcu-text, #ffffff);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.fcu-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.40);
}

.fcu-stage {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  padding: 6cqmin;
  box-sizing: border-box;
  container-type: size;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4cqmin;
  text-align: center;
}

.fcu-heading {
  font-family: 'Public Sans', sans-serif;
  font-weight: 800;
  font-size: min(6cqmin, 3.2rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fcu-primary, #38bdf8);
  margin: 0;
}

.fcu-subtle {
  font-family: 'Public Sans', sans-serif;
  font-size: min(3.2cqmin, 1.2rem);
  opacity: 0.85;
  margin: 0;
}

.fcu-timerRow {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: min(3cqw, 36px);
  flex-wrap: wrap;
}

.fcu-cardUnit {
  width: min(22cqw, 24cqh, 260px);
  height: min(22cqw, 24cqh, 260px);
  border-radius: min(20px, 3cqmin);
  border: 1.5px solid color-mix(in srgb, var(--fcu-primary, #38bdf8) 65%, transparent);
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16px 40px rgba(0,0,0,0.25);
}

.fcu-cardVal {
  font-family: 'Public Sans', sans-serif;
  font-weight: 900;
  font-size: min(10cqmin, 6rem);
  line-height: 1;
  margin: 0;
}

.fcu-cardLbl {
  font-family: 'Public Sans', sans-serif;
  font-weight: 700;
  font-size: min(2.8cqmin, 1.2rem);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-top: min(1cqmin, 8px);
  color: var(--fcu-secondary, #818cf8);
}

.fcu-digitalBox {
  padding: min(4cqmin, 24px) min(6cqmin, 40px);
  border-radius: min(16px, 2cqmin);
  background: rgba(0, 0, 0, 0.32);
  border: 1px solid rgba(255,255,255,0.07);
}
.fcu-digitalText {
  font-family: 'Share Tech Mono', monospace;
  font-size: min(13cqmin, 8cqw, 9.5rem);
  line-height: 1;
  letter-spacing: 0.04em;
  color: var(--fcu-primary, #00f0ff);
  text-shadow: 0 0 18px color-mix(in srgb, var(--fcu-primary, #00f0ff) 60%, transparent);
}

.fcu-minimalText {
  font-family: 'Noto Serif', Georgia, serif;
  font-weight: 300;
  font-size: min(13cqmin, 7.5rem);
  letter-spacing: 0.06em;
  margin: 0;
  padding-bottom: min(3cqmin, 20px);
  border-bottom: 1.5px solid color-mix(in srgb, var(--fcu-primary, #38bdf8) 35%, transparent);
}

.fcu-message {
  font-family: 'Noto Serif', Georgia, serif;
  font-weight: 700;
  font-size: min(9cqmin, 6.5rem);
  line-height: 1.2;
  padding: min(4cqmin, 30px) min(8cqmin, 60px);
  border-radius: min(16px, 2cqmin);
  background: rgba(0,0,0,0.24);
  border: 1px solid rgba(255,255,255,0.08);
  color: var(--fcu-primary, currentColor);
}

/* Flip Styles */
.fcu-flipBox {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.fcu-flipCard {
  position: relative;
  background: #18181b;
  color: #ffffff;
  border-radius: min(16px, 2.5cqmin);
  padding: min(5cqmin, 45px) min(4cqmin, 35px);
  font-family: 'Public Sans', sans-serif;
  font-size: min(15cqmin, 8.5rem);
  font-weight: 800;
  min-width: min(18cqw, 180px);
  text-align: center;
  box-shadow: 0 10px 20px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.1);
  border: 1.5px solid rgba(255,255,255,0.06);
  line-height: 1;
}
.fcu-flipCard::after {
  content: '';
  position: absolute;
  left: 0; right: 0; top: 50%;
  height: 1px;
  background: rgba(0, 0, 0, 0.45);
  box-shadow: 0 1px 0 rgba(255,255,255,0.08);
}
.fcu-flipLbl {
  font-family: 'Public Sans', sans-serif;
  font-size: min(3.5cqmin, 1.4rem);
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.12em;
  margin-top: min(2cqmin, 14px);
  color: var(--fcu-secondary, #818cf8);
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

/* Modern Styles */
.fcu-modernBox {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(16px);
  border-radius: min(24px, 3cqmin);
  padding: min(5cqmin, 30px) min(7cqmin, 45px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 40px rgba(0,0,0,0.25);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.fcu-modernTime {
  font-family: 'Public Sans', sans-serif;
  font-size: min(15cqmin, 8.5rem);
  font-weight: 800;
  background: linear-gradient(135deg, var(--fcu-primary, #38bdf8), var(--fcu-secondary, #818cf8));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1;
}
.fcu-modernLbl {
  font-family: 'Public Sans', sans-serif;
  font-size: min(3.5cqmin, 1.4rem);
  color: var(--fcu-text, #ffffff);
  opacity: 0.8;
  text-transform: uppercase;
  margin-top: min(1.5cqmin, 10px);
  letter-spacing: 0.08em;
  font-weight: 500;
}
`

function ensureGlobalStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = GLOBAL_CSS
  document.head.appendChild(el)
}

interface ThemePreset {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
}

const THEME_PRESETS: Record<string, ThemePreset> = {
  light: {
    primaryColor: '#4f46e5',
    secondaryColor: '#0ea5e9',
    backgroundColor: '#f8fafc',
    textColor: '#0f172a',
  },
  dark: {
    primaryColor: '#38bdf8',
    secondaryColor: '#818cf8',
    backgroundColor: '#090d16',
    textColor: '#f8fafc',
  },
  sunset: {
    primaryColor: '#fca5a5',
    secondaryColor: '#f472b6',
    backgroundColor: 'linear-gradient(135deg, #e11d48, #4f46e5)',
    textColor: '#ffffff',
  },
  neon: {
    primaryColor: '#00f0ff',
    secondaryColor: '#ff00cc',
    backgroundColor: '#000000',
    textColor: '#ffffff',
  },
  ocean: {
    primaryColor: '#22d3ee',
    secondaryColor: '#0d9488',
    backgroundColor: 'linear-gradient(135deg, #0f172a, #115e59)',
    textColor: '#ffffff',
  },
  custom: {
    primaryColor: '#38bdf8',
    secondaryColor: '#818cf8',
    backgroundColor: '#090d16',
    textColor: '#ffffff',
  }
}

type TimerStyle = 'card' | 'digital' | 'modern' | 'minimal' | 'flip'
type Theme = 'light' | 'dark' | 'sunset' | 'neon' | 'ocean' | 'custom'

export interface FlowCountUpRendererProps {
  text: string
  startTime: string
  endTime?: string
  endMessage?: string
  timerStyle?: TimerStyle
  daysOnly?: boolean
  theme?: Theme
  themeSettings?: {
    primaryColor?: string
    secondaryColor?: string
    backgroundColor?: string
    textColor?: string
    backgroundImage?: string
  }
  advancedSettings?: {
    showDate?: boolean
    dateFormat?: 'January 01, 2024' | 'Monday, January 01, 2024' | 'Mon, Jan 01, 2024' | '31/01/2024' | 'Monday, 31/01/2024' | '01/31/2024 (US)' | '2024-01-31'
  }
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatDate(date: Date, format: string): string {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const monthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const daysShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const yyyy = date.getFullYear()
  const mm = pad2(date.getMonth() + 1)
  const dd = pad2(date.getDate())
  const monthName = months.at(date.getMonth()) || ''
  const monthNameShort = monthsShort.at(date.getMonth()) || ''
  const dayName = days.at(date.getDay()) || ''
  const dayNameShort = daysShort.at(date.getDay()) || ''

  switch (format) {
    case 'January 01, 2024':            return `${monthName} ${dd}, ${yyyy}`
    case 'Monday, January 01, 2024':    return `${dayName}, ${monthName} ${dd}, ${yyyy}`
    case 'Mon, Jan 01, 2024':           return `${dayNameShort}, ${monthNameShort} ${dd}, ${yyyy}`
    case '31/01/2024':                  return `${dd}/${mm}/${yyyy}`
    case 'Monday, 31/01/2024':          return `${dayName}, ${dd}/${mm}/${yyyy}`
    case '01/31/2024 (US)':             return `${mm}/${dd}/${yyyy}`
    case '2024-01-31':                  return `${yyyy}-${mm}-${dd}`
    default:                            return `${monthName} ${dd}, ${yyyy}`
  }
}

export default function FlowCountUpRenderer({
  text,
  startTime,
  endTime,
  endMessage,
  timerStyle = 'card',
  daysOnly = false,
  theme = 'dark',
  themeSettings,
  advancedSettings,
}: FlowCountUpRendererProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    ensureGlobalStyles()
  }, [])

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const startMs = useMemo(() => {
    const d = new Date(startTime)
    const ms = d.getTime()
    return Number.isFinite(ms) ? ms : Date.now()
  }, [startTime])

  const endMs = useMemo(() => {
    if (!endTime) return null
    const d = new Date(endTime)
    const ms = d.getTime()
    return Number.isFinite(ms) ? ms : null
  }, [endTime])

  const shouldShowMessage = endMs !== null && now >= endMs && !!endMessage?.trim()

  const elapsedMs = Math.max(0, now - startMs)
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const themePreset = THEME_PRESETS[theme] ?? THEME_PRESETS.dark
  const resolvedTheme = theme === 'custom'
    ? {
        primaryColor: themeSettings?.primaryColor ?? themePreset.primaryColor,
        secondaryColor: themeSettings?.secondaryColor ?? themePreset.secondaryColor,
        backgroundColor: themeSettings?.backgroundColor ?? themePreset.backgroundColor,
        textColor: themeSettings?.textColor ?? themePreset.textColor,
      }
    : themePreset

  const bgImage = theme === 'custom' ? (themeSettings?.backgroundImage?.trim() || '') : ''

  const rootStyle: React.CSSProperties = {
    ['--fcu-primary' as any]: resolvedTheme.primaryColor,
    ['--fcu-secondary' as any]: resolvedTheme.secondaryColor,
    ['--fcu-bg' as any]: resolvedTheme.backgroundColor,
    ['--fcu-text' as any]: resolvedTheme.textColor,
    backgroundImage: bgImage ? `url(${bgImage})` : undefined,
  }

  const dateLine = useMemo(() => {
    if (!advancedSettings?.showDate) return null
    const fmt = advancedSettings?.dateFormat ?? 'January 01, 2024'
    try {
      return `Since ${formatDate(new Date(startMs), fmt)}`
    } catch {
      return null
    }
  }, [advancedSettings?.showDate, advancedSettings?.dateFormat, startMs])

  const digitalText = daysOnly
    ? `${days}d`
    : `${days > 0 ? `${days}d ` : ''}${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`

  const renderTimerContent = () => {
    if (shouldShowMessage) {
      return <div className="fcu-message">{endMessage}</div>
    }

    if (daysOnly) {
      const daysVal = String(days)
      if (timerStyle === 'flip') {
        return (
          <div className="fcu-timerRow">
            <div className="fcu-flipBox">
              <div className="fcu-flipCard">{daysVal}</div>
              <div className="fcu-flipLbl">Days Only</div>
            </div>
          </div>
        )
      }
      if (timerStyle === 'digital') {
        return (
          <div className="fcu-digitalBox">
            <div className="fcu-digitalText">{daysVal} Days</div>
          </div>
        )
      }
      if (timerStyle === 'modern') {
        return (
          <div className="fcu-timerRow">
            <div className="fcu-modernBox">
              <div className="fcu-modernTime">{daysVal}</div>
              <div className="fcu-modernLbl">Days Only</div>
            </div>
          </div>
        )
      }
      if (timerStyle === 'minimal') {
        return (
          <div>
            <p className="fcu-minimalText">{daysVal} Days</p>
          </div>
        )
      }
      // Card (default)
      return (
        <div className="fcu-timerRow">
          <div className="fcu-cardUnit">
            <p className="fcu-cardVal">{daysVal}</p>
            <div className="fcu-cardLbl">Days Only</div>
          </div>
        </div>
      )
    }

    // Full format
    const dStr = String(days)
    const hStr = pad2(hours)
    const mStr = pad2(minutes)
    const sStr = pad2(seconds)

    if (timerStyle === 'flip') {
      return (
        <div className="fcu-timerRow">
          <div className="fcu-flipBox">
            <div className="fcu-flipCard">{dStr}</div>
            <div className="fcu-flipLbl">Days</div>
          </div>
          <div className="fcu-flipBox">
            <div className="fcu-flipCard">{hStr}</div>
            <div className="fcu-flipLbl">Hours</div>
          </div>
          <div className="fcu-flipBox">
            <div className="fcu-flipCard">{mStr}</div>
            <div className="fcu-flipLbl">Mins</div>
          </div>
          <div className="fcu-flipBox">
            <div className="fcu-flipCard">{sStr}</div>
            <div className="fcu-flipLbl">Secs</div>
          </div>
        </div>
      )
    }

    if (timerStyle === 'digital') {
      return (
        <div className="fcu-digitalBox">
          <div className="fcu-digitalText">
            {days > 0 ? `${days}d ` : ''}{hStr}:{mStr}:{sStr}
          </div>
        </div>
      )
    }

    if (timerStyle === 'modern') {
      return (
        <div className="fcu-timerRow">
          <div className="fcu-modernBox">
            <div className="fcu-modernTime">{dStr}</div>
            <div className="fcu-modernLbl">Days</div>
          </div>
          <div className="fcu-modernBox">
            <div className="fcu-modernTime">{hStr}</div>
            <div className="fcu-modernLbl">Hours</div>
          </div>
          <div className="fcu-modernBox">
            <div className="fcu-modernTime">{mStr}</div>
            <div className="fcu-modernLbl">Minutes</div>
          </div>
          <div className="fcu-modernBox">
            <div className="fcu-modernTime">{sStr}</div>
            <div className="fcu-modernLbl">Seconds</div>
          </div>
        </div>
      )
    }

    if (timerStyle === 'minimal') {
      return (
        <div>
          <p className="fcu-minimalText">{digitalText}</p>
        </div>
      )
    }

    // Card (default)
    return (
      <div className="fcu-timerRow">
        <div className="fcu-cardUnit">
          <p className="fcu-cardVal">{dStr}</p>
          <div className="fcu-cardLbl">Days</div>
        </div>
        <div className="fcu-cardUnit">
          <p className="fcu-cardVal">{hStr}</p>
          <div className="fcu-cardLbl">Hours</div>
        </div>
        <div className="fcu-cardUnit">
          <p className="fcu-cardVal">{mStr}</p>
          <div className="fcu-cardLbl">Mins</div>
        </div>
        <div className="fcu-cardUnit">
          <p className="fcu-cardVal">{sStr}</p>
          <div className="fcu-cardLbl">Secs</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fcu-root" style={rootStyle}>
      <div className="fcu-overlay" />
      <div className="fcu-stage">
        <h1 className="fcu-heading">{text}</h1>
        {dateLine && <p className="fcu-subtle">{dateLine}</p>}
        {renderTimerContent()}
      </div>
    </div>
  )
}

