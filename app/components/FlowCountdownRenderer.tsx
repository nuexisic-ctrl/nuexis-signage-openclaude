'use client'

import { useEffect, useState, useRef } from 'react'

const STYLE_ID = 'flow-countdown-styles-v1'

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,300;0,400;0,600&family=Public+Sans:wght@300;400;500;600;700;800&family=Share+Tech+Mono&display=swap');

.fcd-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 6cqmin;
  box-sizing: border-box;
  text-align: center;
  background: var(--fcd-bg, #0f172a);
  color: var(--fcd-text, #ffffff);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transition: background 0.3s ease, color 0.3s ease;
  position: relative;
}

.fcd-bg-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1;
}

.fcd-content {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.fcd-heading {
  font-family: 'Public Sans', sans-serif;
  font-weight: 700;
  font-size: min(7cqmin, 3.2rem);
  margin-bottom: 5cqmin;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fcd-primary, #8b5cf6);
  text-shadow: 0 2px 4px rgba(0,0,0,0.15);
}

.fcd-timer-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: min(4cqw, 40px);
  width: 100%;
  flex-wrap: wrap;
}

/* Flip Styles */
.fcd-flip-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.fcd-flip-card {
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
.fcd-flip-card::after {
  content: '';
  position: absolute;
  left: 0; right: 0; top: 50%;
  height: 1px;
  background: rgba(0, 0, 0, 0.45);
  box-shadow: 0 1px 0 rgba(255,255,255,0.08);
}
.fcd-flip-label {
  font-family: 'Public Sans', sans-serif;
  font-size: min(3.5cqmin, 1.4rem);
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.12em;
  margin-top: min(2cqmin, 14px);
  color: var(--fcd-secondary, #a855f7);
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

/* Digital Styles */
.fcd-digital-box {
  background: rgba(0, 0, 0, 0.3);
  padding: min(4cqmin, 24px) min(6cqmin, 40px);
  border-radius: min(16px, 2cqmin);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.fcd-digital-text {
  font-family: 'Share Tech Mono', monospace;
  font-size: min(16cqmin, 9.5rem);
  color: var(--fcd-primary, #00f0ff);
  text-shadow: 0 0 15px var(--fcd-primary, #00f0ff), 0 0 30px rgba(0,240,255,0.2);
  letter-spacing: 0.04em;
  line-height: 1;
}

/* Modern Styles */
.fcd-modern-box {
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
.fcd-modern-time {
  font-family: 'Public Sans', sans-serif;
  font-size: min(15cqmin, 8.5rem);
  font-weight: 800;
  background: linear-gradient(135deg, var(--fcd-primary, #38bdf8), var(--fcd-secondary, #ec4899));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1;
}
.fcd-modern-label {
  font-family: 'Public Sans', sans-serif;
  font-size: min(3.5cqmin, 1.4rem);
  color: var(--fcd-text, #ffffff);
  opacity: 0.8;
  text-transform: uppercase;
  margin-top: min(1.5cqmin, 10px);
  letter-spacing: 0.08em;
  font-weight: 500;
}

/* Minimal Styles */
.fcd-minimal-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.fcd-minimal-time {
  font-family: 'Noto Serif', Georgia, serif;
  font-size: min(13cqmin, 7.5rem);
  font-weight: 300;
  letter-spacing: 0.06em;
  border-bottom: 1.5px solid var(--fcd-primary, rgba(255, 255, 255, 0.2));
  padding-bottom: min(3cqmin, 20px);
  margin-bottom: min(3cqmin, 20px);
  color: var(--fcd-text, #ffffff);
  line-height: 1.1;
}
.fcd-minimal-label {
  font-family: 'Public Sans', sans-serif;
  font-size: min(3.5cqmin, 1.4rem);
  font-weight: 400;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  opacity: 0.75;
}

/* Card Styles */
.fcd-card-unit {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(8px);
  border: 1.5px solid var(--fcd-primary, #8b5cf6);
  border-radius: min(20px, 3cqmin);
  width: min(22cqw, 24cqh, 260px);
  height: min(22cqw, 24cqh, 260px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 30px rgba(0,0,0,0.15);
  transition: transform 0.2s ease;
}
.fcd-card-unit:hover {
  transform: translateY(-2px);
}
.fcd-card-val {
  font-family: 'Public Sans', sans-serif;
  font-size: min(10cqmin, 6rem);
  font-weight: 800;
  color: var(--fcd-text, #ffffff);
  line-height: 1;
}
.fcd-card-lbl {
  font-family: 'Public Sans', sans-serif;
  font-size: min(2.8cqmin, 1.3rem);
  text-transform: uppercase;
  font-weight: 600;
  color: var(--fcd-secondary, #a855f7);
  margin-top: min(1cqmin, 8px);
  letter-spacing: 0.05em;
}

/* End Message styles */
.fcd-end-message {
  font-family: 'Noto Serif', Georgia, serif;
  font-size: min(9cqmin, 7rem);
  font-weight: 600;
  line-height: 1.4;
  padding: min(4cqmin, 30px) min(8cqmin, 60px);
  animation: fcd-fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  color: var(--fcd-primary, currentColor);
  background: rgba(0, 0, 0, 0.2);
  border-radius: min(16px, 2cqmin);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

@keyframes fcd-fade-in {
  from { opacity: 0; transform: scale(0.96) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
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
    primaryColor: '#8b5cf6',
    secondaryColor: '#d946ef',
    backgroundColor: '#0f172a',
    textColor: '#ffffff',
  }
}

export interface FlowCountdownRendererProps {
  text: string
  endTime: string
  endMessage: string
  timerStyle?: 'flip' | 'digital' | 'modern' | 'minimal' | 'card'
  daysOnly?: boolean
  theme?: 'light' | 'dark' | 'sunset' | 'neon' | 'ocean' | 'custom'
  themeSettings?: {
    primaryColor?: string
    secondaryColor?: string
    backgroundColor?: string
    textColor?: string
    backgroundImage?: string
  }
  advancedSettings?: unknown
}

export default function FlowCountdownRenderer({
  text,
  endTime,
  endMessage,
  timerStyle = 'card',
  daysOnly = false,
  theme = 'dark',
  themeSettings = {},
}: FlowCountdownRendererProps) {

  const [timeLeft, setTimeLeft] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
    isZero: boolean
  } | null>(null)

  useEffect(() => {
    ensureGlobalStyles()
  }, [])

  useEffect(() => {
    if (!endTime) return

    const targetTime = new Date(endTime).getTime()
    if (isNaN(targetTime)) return

    const calculateTimeLeft = () => {
      const difference = targetTime - Date.now()
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isZero: true })
        return true // finished
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isZero: false
      })
      return false
    }

    const finished = calculateTimeLeft()
    if (finished) return

    const timer = setInterval(() => {
      const isDone = calculateTimeLeft()
      if (isDone) {
        clearInterval(timer)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [endTime])

  if (!timeLeft) {
    return (
      <div style={{ color: '#888', fontFamily: 'sans-serif', fontSize: '1rem',
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading countdown…
      </div>
    )
  }

  const activePreset = THEME_PRESETS[theme] || THEME_PRESETS.dark
  const primaryColor = themeSettings.primaryColor || activePreset.primaryColor
  const secondaryColor = themeSettings.secondaryColor || activePreset.secondaryColor
  const backgroundColor = themeSettings.backgroundColor || activePreset.backgroundColor
  const textColor = themeSettings.textColor || activePreset.textColor
  const backgroundImage = themeSettings.backgroundImage || undefined

  const formatNumber = (num: number) => String(num).padStart(2, '0')

  const containerStyle: React.CSSProperties = {
    '--fcd-primary': primaryColor,
    '--fcd-secondary': secondaryColor,
    '--fcd-bg': backgroundImage ? 'transparent' : backgroundColor,
    '--fcd-text': textColor,
    backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
  } as React.CSSProperties

  const renderTimerContent = () => {
    if (timeLeft.isZero) {
      return <div className="fcd-end-message">{endMessage}</div>
    }

    if (daysOnly) {
      const daysVal = String(timeLeft.days)
      if (timerStyle === 'flip') {
        return (
          <div className="fcd-flip-box">
            <div className="fcd-flip-card">{daysVal}</div>
            <div className="fcd-flip-label">Days Only</div>
          </div>
        )
      }
      if (timerStyle === 'digital') {
        return <div className="fcd-digital-text">{daysVal} Days</div>
      }
      if (timerStyle === 'modern') {
        return (
          <div className="fcd-modern-box">
            <div className="fcd-modern-time">{daysVal}</div>
            <div className="fcd-modern-label">Days Only</div>
          </div>
        )
      }
      if (timerStyle === 'minimal') {
        return (
          <div className="fcd-minimal-box">
            <div className="fcd-minimal-time">{daysVal} Days</div>
            <div className="fcd-minimal-label">Days Only</div>
          </div>
        )
      }
      // Card (default)
      return (
        <div className="fcd-card-unit">
          <div className="fcd-card-val">{daysVal}</div>
          <div className="fcd-card-lbl">Days Only</div>
        </div>
      )
    }

    // Days, Hours, Minutes, Seconds
    const dStr = formatNumber(timeLeft.days)
    const hStr = formatNumber(timeLeft.hours)
    const mStr = formatNumber(timeLeft.minutes)
    const sStr = formatNumber(timeLeft.seconds)

    if (timerStyle === 'flip') {
      return (
        <div className="fcd-timer-row">
          <div className="fcd-flip-box">
            <div className="fcd-flip-card">{dStr}</div>
            <div className="fcd-flip-label">Days</div>
          </div>
          <div className="fcd-flip-box">
            <div className="fcd-flip-card">{hStr}</div>
            <div className="fcd-flip-label">Hours</div>
          </div>
          <div className="fcd-flip-box">
            <div className="fcd-flip-card">{mStr}</div>
            <div className="fcd-flip-label">Mins</div>
          </div>
          <div className="fcd-flip-box">
            <div className="fcd-flip-card">{sStr}</div>
            <div className="fcd-flip-label">Secs</div>
          </div>
        </div>
      )
    }

    if (timerStyle === 'digital') {
      return (
        <div className="fcd-digital-box">
          <div className="fcd-digital-text">
            {dStr}:{hStr}:{mStr}:{sStr}
          </div>
        </div>
      )
    }

    if (timerStyle === 'modern') {
      return (
        <div className="fcd-timer-row">
          <div className="fcd-modern-box">
            <div className="fcd-modern-time">{dStr}</div>
            <div className="fcd-modern-label">Days</div>
          </div>
          <div className="fcd-modern-box">
            <div className="fcd-modern-time">{hStr}</div>
            <div className="fcd-modern-label">Hours</div>
          </div>
          <div className="fcd-modern-box">
            <div className="fcd-modern-time">{mStr}</div>
            <div className="fcd-modern-label">Minutes</div>
          </div>
          <div className="fcd-modern-box">
            <div className="fcd-modern-time">{sStr}</div>
            <div className="fcd-modern-label">Seconds</div>
          </div>
        </div>
      )
    }

    if (timerStyle === 'minimal') {
      return (
        <div className="fcd-minimal-box">
          <div className="fcd-minimal-time">
            {dStr}d &nbsp;{hStr}h &nbsp;{mStr}m &nbsp;{sStr}s
          </div>
          <div className="fcd-minimal-label">Time Remaining</div>
        </div>
      )
    }

    // Card (default)
    return (
      <div className="fcd-timer-row">
        <div className="fcd-card-unit">
          <div className="fcd-card-val">{dStr}</div>
          <div className="fcd-card-lbl">Days</div>
        </div>
        <div className="fcd-card-unit">
          <div className="fcd-card-val">{hStr}</div>
          <div className="fcd-card-lbl">Hours</div>
        </div>
        <div className="fcd-card-unit">
          <div className="fcd-card-val">{mStr}</div>
          <div className="fcd-card-lbl">Mins</div>
        </div>
        <div className="fcd-card-unit">
          <div className="fcd-card-val">{sStr}</div>
          <div className="fcd-card-lbl">Secs</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fcd-container" style={containerStyle}>
      {backgroundImage && <div className="fcd-bg-overlay" />}
      <div className="fcd-content">
        {!timeLeft.isZero && text && <h2 className="fcd-heading">{text}</h2>}
        {renderTimerContent()}
      </div>
    </div>
  )
}
