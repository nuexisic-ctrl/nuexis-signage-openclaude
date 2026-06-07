'use client'

import { useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Global CSS injected ONCE into <head> – never touched again on re-renders
// ─────────────────────────────────────────────────────────────────────────────
const STYLE_ID = 'flow-clock-styles-v2'

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,300;0,400;0,600&family=Public+Sans:wght@300;400;500;600;700&display=swap');

.fck-classic-root {
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  width:100%;height:100%;padding:4cqmin;box-sizing:border-box;
  font-family:'Noto Serif',Georgia,serif;text-align:center;
  background: var(--fck-bg, #ffffff);
  transition: background var(--transition-base, 0.2s), color var(--transition-base, 0.2s);
}
.fck-classic-root[data-theme="light"] {
  --fck-bg: #ffffff;
  --fck-text: #000000;
}
.fck-classic-root[data-theme="dark"] {
  --fck-bg: #121214;
  --fck-text: #ffffff;
}
.fck-classic-time {
  font-size:min(24cqmin,7rem);font-weight:400;margin:0;
  line-height:1.1;letter-spacing:-0.02em;color: var(--fck-text);
}
.fck-classic-secs {
  font-size:0.5em;margin-left:0.15em;font-weight:300;color: var(--fck-text);
}
.fck-classic-ampm {
  font-size:min(6cqmin,1.8rem);font-weight:300;margin-left:12px;
  font-family:'Public Sans',sans-serif;text-transform:uppercase;color: var(--fck-text);
}
.fck-classic-date {
  font-size:min(5.5cqmin,1.6rem);font-weight:400;margin-top:2cqmin;margin-bottom:0;
  letter-spacing:0.12em;font-family:'Public Sans',sans-serif;color: var(--fck-text);text-transform:uppercase;
}

.fck-modern-root {
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  width:100%;height:100%;padding:4cqmin;
  box-sizing:border-box;font-family:'Public Sans',sans-serif;text-align:center;
  background: var(--fck-modern-bg, #090d16);
  color: var(--fck-modern-text, #ffffff);
  transition: background var(--transition-base, 0.2s), color var(--transition-base, 0.2s);
}
.fck-modern-root[data-theme="light"] {
  --fck-modern-bg: #f8fafc;
  --fck-modern-text: #0f172a;
  --fck-modern-date: #64748b;
  --fck-modern-accent: #0284c7;
}
.fck-modern-root[data-theme="dark"] {
  --fck-modern-bg: #090d16;
  --fck-modern-text: #ffffff;
  --fck-modern-date: #94a3b8;
  --fck-modern-accent: #38bdf8;
}
.fck-modern-time {
  font-size:min(22cqmin,6.5rem);font-weight:700;margin:0;line-height:1;letter-spacing:-0.03em;
}
.fck-modern-date {
  font-size:min(6cqmin,1.8rem);font-weight:600;margin-top:2cqmin;margin-bottom:0;letter-spacing:0.05em;
  color: var(--fck-modern-date);text-transform:uppercase;
}

.fck-mini-root {
  display:flex;flex-direction:row;align-items:center;justify-content:center;
  gap:4cqw;width:100%;height:100%;box-sizing:border-box;
  --fck-mini-bg: #f4f5f7;
  --fck-mini-card-bg: #ffffff;
  --fck-mini-text: #111111;
  --fck-mini-muted: #666666;
  --fck-mini-accent: #094cb2;
  --fck-mini-border: rgba(0,0,0,0.1);
  --fck-mini-shadow: rgba(0,0,0,0.03);
}
.fck-mini-root[data-theme="dark"] {
  --fck-mini-bg: #0f172a;
  --fck-mini-card-bg: #1e293b;
  --fck-mini-text: #ffffff;
  --fck-mini-muted: #94a3b8;
  --fck-mini-accent: #38bdf8;
  --fck-mini-border: rgba(255,255,255,0.08);
  --fck-mini-shadow: rgba(0,0,0,0.4);
}
.fck-mini-left {
  background: var(--fck-mini-card-bg);
  border-radius:min(24px, 5cqmin);
  width:min(500px, 70cqh);height:min(500px, 70cqh);
  display:flex;align-items:center;justify-content:center;
  position:relative;box-shadow:0 10px 25px var(--fck-mini-shadow);
  transition: background var(--transition-base, 0.2s);
}
.fck-mini-right {
  background: var(--fck-mini-card-bg);
  border-radius:min(24px, 5cqmin);padding:min(28px, 5cqmin);
  width:min(550px, 80cqh);height:min(500px, 70cqh);
  box-shadow:0 10px 25px var(--fck-mini-shadow);
  display:flex;flex-direction:column;justify-content:center;gap:min(16px, 3cqh);
  transition: background var(--transition-base, 0.2s);
}

@container (orientation: portrait) {
  .fck-mini-root {
    flex-direction:column!important;gap:4cqh!important;
  }
  .fck-mini-left {
    width:min(450px, 75cqw)!important;height:min(450px, 75cqw)!important;
    border-radius:16px!important;
  }
  .fck-mini-right {
    width:min(500px, 80cqw)!important;height:auto!important;
    padding:20px!important;border-radius:16px!important;
    gap:16px!important;
  }
}
/* ─── Neon Pulse ─── */
.fck-neon-root {
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  width:100%;height:100%;padding:4cqmin;box-sizing:border-box;
  background:#000000;text-align:center;
  font-family:'Public Sans',sans-serif;
}
.fck-neon-time {
  font-size:min(22cqmin,6.5rem);font-weight:700;margin:0;line-height:1;letter-spacing:-0.04em;
  color:#00f0ff;
  text-shadow:0 0 10px #00f0ff,0 0 30px #00f0ff,0 0 60px #00aaff;
}
.fck-neon-secs {
  font-size:0.55em;color:#ff00cc;
  text-shadow:0 0 8px #ff00cc,0 0 22px #ff00cc;
  margin-left:0.1em;
}
.fck-neon-ampm {
  font-size:min(5cqmin,1.4rem);color:#00f0ff;margin-left:10px;font-weight:600;
  text-shadow:0 0 8px #00f0ff;
}
.fck-neon-date {
  font-size:min(5cqmin,1.5rem);font-weight:500;margin-top:2cqmin;margin-bottom:0;
  color:#ff00cc;letter-spacing:0.1em;text-transform:uppercase;
  text-shadow:0 0 6px #ff00cc,0 0 16px #ff00cc;
}

/* ─── Boardroom Serif ─── */
.fck-board-root {
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  width:100%;height:100%;padding:6cqmin;box-sizing:border-box;
  background: var(--fck-board-bg, #0c0c0e);text-align:center;
  font-family:'Noto Serif',Georgia,serif;
  transition: background var(--transition-base, 0.2s), color var(--transition-base, 0.2s);
}
.fck-board-root[data-theme="light"] {
  --fck-board-bg: #fbf9f5;
  --fck-board-text: #3d3013;
  --fck-board-accent: #8f7634;
  --fck-board-glow: rgba(143,118,52,0.1);
  --fck-board-divider: linear-gradient(90deg,transparent,#8f7634,transparent);
}
.fck-board-root[data-theme="dark"] {
  --fck-board-bg: #0c0c0e;
  --fck-board-text: #e8d5a3;
  --fck-board-accent: #c9a84c;
  --fck-board-glow: rgba(201,168,76,0.3);
  --fck-board-divider: linear-gradient(90deg,transparent,#c9a84c,transparent);
}
.fck-board-divider {
  width:min(120px,20cqmin);height:1px;background: var(--fck-board-divider, linear-gradient(90deg,transparent,#c9a84c,transparent));
  margin:2cqmin auto;
}
.fck-board-time {
  font-size:min(20cqmin,6rem);font-weight:300;margin:0;line-height:1.05;
  letter-spacing:0.08em;color: var(--fck-board-text, #e8d5a3);
  text-shadow:0 0 20px var(--fck-board-glow, rgba(201,168,76,0.3));
}
.fck-board-secs {
  font-size:0.45em;color: var(--fck-board-accent, #c9a84c);margin-left:0.12em;font-weight:300;
}
.fck-board-ampm {
  font-size:min(5cqmin,1.3rem);color: var(--fck-board-accent, #c9a84c);margin-left:10px;font-weight:400;letter-spacing:0.2em;
}
.fck-board-date {
  font-size:min(4.5cqmin,1.3rem);font-weight:400;margin:0;
  letter-spacing:0.2em;color: var(--fck-board-accent, #c9a84c);text-transform:uppercase;
}
`

function ensureGlobalStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = GLOBAL_CSS
  document.head.appendChild(el)
}

// ─────────────────────────────────────────────────────────────────────────────
// Date formatting
// ─────────────────────────────────────────────────────────────────────────────
function formatDate(date: Date, format: string): string {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const monthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const daysShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const yyyy = date.getFullYear()
  const mm   = String(date.getMonth() + 1).padStart(2, '0')
  const dd   = String(date.getDate()).padStart(2, '0')
  const monthName      = months.at(date.getMonth()) || ''
  const monthNameUpper = (months.at(date.getMonth()) || '').toUpperCase()
  const monthNameShort = monthsShort.at(date.getMonth()) || ''
  const dayName        = days.at(date.getDay()) || ''
  const dayNameShort   = daysShort.at(date.getDay()) || ''

  switch (format) {
    case 'January 01, 2024':            return `${monthName} ${dd}, ${yyyy}`
    case 'Monday, January 01, 2024':    return `${dayName}, ${monthName} ${dd}, ${yyyy}`
    case 'Mon, Jan 01, 2024':           return `${dayNameShort}, ${monthNameShort} ${dd}, ${yyyy}`
    case '31/01/2024':                  return `${dd}/${mm}/${yyyy}`
    case 'Monday, 31/01/2024':          return `${dayName}, ${dd}/${mm}/${yyyy}`
    case '01/31/2024 (US)':             return `${mm}/${dd}/${yyyy}`
    case '2024-01-31':                  return `${yyyy}-${mm}-${dd}`
    case 'CLASSIC_CAPS':                return `${monthNameUpper} ${dd}, ${yyyy}`
    default:                            return `${monthName} ${dd}, ${yyyy}`
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface FlowClockRendererProps {
  style?: 'classic-digital' | 'modern-digital' | 'classic-analog' | 'modern-analog' | 'minimalist' | 'neon-digital' | 'boardroom-serif'
  showSeconds?: boolean
  showDate?: boolean
  use24Hour?: boolean
  dateFormat?: string
  theme?: 'light' | 'dark'
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function FlowClockRenderer({
  style = 'classic-digital',
  showSeconds = true,
  showDate = true,
  use24Hour = false,
  dateFormat  = 'January 01, 2024',
  theme,
}: FlowClockRendererProps) {

  const isAnalog = style === 'classic-analog' || style === 'modern-analog'

  // Single time state – the Date object we render from
  const [time, setTime] = useState<Date | null>(null)

  // For analog: we store the sub-second ms in a ref so we can interpolate hand angles
  // without triggering extra renders – the rAF loop writes here and React state is set
  // via the throttle mechanism below.
  const msRef = useRef(0)

  // Tracks the last rendered second (digital) or last rendered 50ms-bucket (analog)
  // so we only call setTime when the visible output would actually change.
  const lastBucketRef = useRef(-1)

  useEffect(() => {
    ensureGlobalStyles()
  }, [])

  useEffect(() => {
    let rafId: number

    const loop = () => {
      const now  = new Date()
      const ms   = now.getMilliseconds()
      msRef.current = ms

      if (isAnalog) {
        // Analog: update React state at ~20 fps (every 50 ms) for smooth hand sweep
        const bucket = Math.floor(now.getTime() / 50)
        if (bucket !== lastBucketRef.current) {
          lastBucketRef.current = bucket
          setTime(new Date(now))      // snapshot so render sees consistent values
        }
      } else {
        // Digital / minimalist: update only when the displayed second changes
        const sec = now.getSeconds()
        if (sec !== lastBucketRef.current) {
          lastBucketRef.current = sec
          setTime(new Date(now))
        }
      }

      rafId = requestAnimationFrame(loop)
    }

    // Kick off immediately so the first paint shows the current time
    lastBucketRef.current = -1
    rafId = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(rafId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnalog])   // only re-run if clock type switches (which never happens in practice)

  // ── Loading state ───────────────────────────────────────────────────────────
  if (!time) {
    return (
      <div style={{ color: '#888', fontFamily: 'sans-serif', fontSize: '1rem',
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading…
      </div>
    )
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  // For digital clocks msRef is irrelevant (we update once/second), so ms = 0 is fine.
  const ms  = isAnalog ? msRef.current : 0
  const sec = time.getSeconds() + ms / 1000
  const min = time.getMinutes() + sec / 60
  const hr  = (time.getHours() % 12) + min / 60

  const secAngle = sec * 6
  const minAngle = min * 6
  const hrAngle  = hr  * 30

  const hoursRaw  = time.getHours()
  const ampm      = hoursRaw >= 12 ? 'PM' : 'AM'
  const hours12   = hoursRaw % 12 || 12
  const hours24   = hoursRaw
  const hoursStr  = use24Hour ? String(hours24).padStart(2, '0') : String(hours12)
  const minsStr   = String(time.getMinutes()).padStart(2, '0')
  const secsStr   = String(time.getSeconds()).padStart(2, '0')

  // ── Render ──────────────────────────────────────────────────────────────────
  const defaultTheme = theme ?? (
    (style === 'modern-digital' || style === 'modern-analog' || style === 'boardroom-serif') ? 'dark' : 'light'
  )

  return (
    <div style={{
      width: '100%', height: '100%',
      containerType: 'size',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>

      {/* ── Classic Digital ── */}
      {style === 'classic-digital' && (
        <div className="fck-classic-root" data-theme={defaultTheme}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
            <h1 className="fck-classic-time">
              {hoursStr}:{minsStr}
              {showSeconds && <span className="fck-classic-secs">:{secsStr}</span>}
            </h1>
            {!use24Hour && <span className="fck-classic-ampm">{ampm}</span>}
          </div>
          {showDate && (
            <p className="fck-classic-date">
              {formatDate(time, dateFormat === 'January 01, 2024' ? 'CLASSIC_CAPS' : dateFormat)}
            </p>
          )}
        </div>
      )}

      {/* ── Modern Digital ── */}
      {style === 'modern-digital' && (
        <div className="fck-modern-root" data-theme={defaultTheme}>
          <h1 className="fck-modern-time">
            {hoursStr}:{minsStr}
            {showSeconds && <span style={{ fontSize: '0.6em', color: 'var(--fck-modern-accent)' }}>:{secsStr}</span>}
            {!use24Hour && <> <span style={{ fontSize: '0.7em', color: 'var(--fck-modern-accent)' }}>{ampm}</span></>}
          </h1>
          {showDate && <p className="fck-modern-date">{formatDate(time, dateFormat)}</p>}
        </div>
      )}

      {/* ── Classic Analog ── */}
      {style === 'classic-analog' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: defaultTheme === 'dark' ? '#121214' : '#ffffff', width: '100%', height: '100%', padding: '4cqmin', boxSizing: 'border-box',
          fontFamily: "'Public Sans', sans-serif",
          transition: 'background 0.2s',
        }}>
          <div style={{ position: 'relative', width: 'min(70cqw, 70cqh)', height: 'min(70cqw, 70cqh)' }}>
            <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
              {Array.from({ length: 60 }).map((_, i) => {
                if (i % 5 === 0) return null
                const a = (i * 6 * Math.PI) / 180
                return <line key={i} x1={100+82*Math.sin(a)} y1={100-82*Math.cos(a)} x2={100+86*Math.sin(a)} y2={100-86*Math.cos(a)} stroke={defaultTheme === 'dark' ? '#444446' : '#aaa'} strokeWidth="1" />
              })}
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i * 30 * Math.PI) / 180
                return <line key={i} x1={100+78*Math.sin(a)} y1={100-78*Math.cos(a)} x2={100+86*Math.sin(a)} y2={100-86*Math.cos(a)} stroke={defaultTheme === 'dark' ? '#ffffff' : '#000'} strokeWidth="3" strokeLinecap="round" />
              })}
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i * 30 * Math.PI) / 180
                return <text key={i} x={100+64*Math.sin(a)} y={100-64*Math.cos(a)+4} textAnchor="middle" style={{ fontSize: '12px', fontWeight: 500, fill: defaultTheme === 'dark' ? '#cccccc' : '#333' }}>{i || 12}</text>
              })}
              <line x1="100" y1="100" x2={100+42*Math.sin(hrAngle*Math.PI/180)} y2={100-42*Math.cos(hrAngle*Math.PI/180)} stroke={defaultTheme === 'dark' ? '#ffffff' : '#111'} strokeWidth="5" strokeLinecap="round" />
              <line x1="100" y1="100" x2={100+68*Math.sin(minAngle*Math.PI/180)} y2={100-68*Math.cos(minAngle*Math.PI/180)} stroke={defaultTheme === 'dark' ? '#dddddd' : '#222'} strokeWidth="3.5" strokeLinecap="round" />
              {showSeconds && (
                <>
                  <line x1={100-15*Math.sin(secAngle*Math.PI/180)} y1={100+15*Math.cos(secAngle*Math.PI/180)} x2={100+78*Math.sin(secAngle*Math.PI/180)} y2={100-78*Math.cos(secAngle*Math.PI/180)} stroke={defaultTheme === 'dark' ? '#ffb74d' : '#ff9800'} strokeWidth="1.2" />
                  <circle cx="100" cy="100" r="5" fill={defaultTheme === 'dark' ? '#ffb74d' : '#ff9900'} />
                </>
              )}
              <circle cx="100" cy="100" r="2.5" fill={defaultTheme === 'dark' ? '#ffffff' : '#111'} />
            </svg>
          </div>
          {showDate && (
            <p style={{ fontSize: 'min(32px, 4.5cqmin)', fontWeight: 500, color: defaultTheme === 'dark' ? '#a1a1aa' : '#666', marginTop: '2.5cqmin', marginBottom: 0, letterSpacing: '0.04em', transition: 'color 0.2s' }}>
              {formatDate(time, dateFormat)}
            </p>
          )}
        </div>
      )}

      {/* ── Modern Analog ── */}
      {style === 'modern-analog' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: defaultTheme === 'dark' ? '#090d16' : '#f8fafc', width: '100%', height: '100%', padding: '4cqmin', boxSizing: 'border-box',
          transition: 'background 0.2s',
        }}>
          <div style={{
            background: defaultTheme === 'dark' ? '#1e293b' : '#fff', borderRadius: 'min(36px, 5cqmin)', padding: 'min(24px, 4cqmin)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 'min(70cqw, 70cqh)', height: 'min(70cqw, 70cqh)',
            boxShadow: defaultTheme === 'dark' ? '0 20px 40px rgba(0,0,0,0.4)' : '0 20px 40px rgba(0,0,0,0.06)',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
                <defs>
                  <filter id="fck-shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.08" />
                  </filter>
                </defs>
                {Array.from({ length: 60 }).map((_, i) => {
                  const a = (i * 6 * Math.PI) / 180
                  const isHr = i % 5 === 0
                  return <line key={i} x1={100+(isHr?78:82)*Math.sin(a)} y1={100-(isHr?78:82)*Math.cos(a)} x2={100+86*Math.sin(a)} y2={100-86*Math.cos(a)} stroke={isHr ? (defaultTheme === 'dark' ? '#ffffff' : '#111') : (defaultTheme === 'dark' ? '#475569' : '#bbb')} strokeWidth={isHr?2.5:1} strokeLinecap="round" />
                })}
                <line x1="100" y1="100" x2={100+44*Math.sin(hrAngle*Math.PI/180)} y2={100-44*Math.cos(hrAngle*Math.PI/180)} stroke={defaultTheme === 'dark' ? '#e2e8f0' : '#1c1c1e'} strokeWidth="5" strokeLinecap="round" filter="url(#fck-shadow)" />
                <line x1="100" y1="100" x2={100+72*Math.sin(minAngle*Math.PI/180)} y2={100-72*Math.cos(minAngle*Math.PI/180)} stroke={defaultTheme === 'dark' ? '#cbd5e1' : '#2c2c2e'} strokeWidth="3.2" strokeLinecap="round" filter="url(#fck-shadow)" />
                {showSeconds && (
                  <>
                    <line x1={100-20*Math.sin(secAngle*Math.PI/180)} y1={100+20*Math.cos(secAngle*Math.PI/180)} x2={100+82*Math.sin(secAngle*Math.PI/180)} y2={100-82*Math.cos(secAngle*Math.PI/180)} stroke={defaultTheme === 'dark' ? '#ff453a' : '#ff3b30'} strokeWidth="1.2" />
                    <circle cx="100" cy="100" r="5" fill={defaultTheme === 'dark' ? '#ff453a' : '#ff3b30'} />
                  </>
                )}
                <circle cx="100" cy="100" r="2" fill={defaultTheme === 'dark' ? '#1e293b' : '#fff'} />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* ── Minimalist ── */}
      {style === 'minimalist' && (() => {
        const currentYear     = time.getFullYear()
        const currentMonth    = time.getMonth()
        const monthNames      = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']
        const firstDayIndex   = new Date(currentYear, currentMonth, 1).getDay()
        const totalDays       = new Date(currentYear, currentMonth + 1, 0).getDate()
        const currentDay      = time.getDate()

        const cells: (number | null)[] = []
        for (let i = 0; i < firstDayIndex; i++) cells.push(null)
        for (let d = 1; d <= totalDays; d++) cells.push(d)

        const isDark = defaultTheme === 'dark'
        const miniCardBg = isDark ? '#1e293b' : '#fff'
        const miniText = isDark ? '#ffffff' : '#111'
        const miniMuted = isDark ? '#94a3b8' : '#666'
        const miniAccent = isDark ? '#38bdf8' : '#094cb2'
        const activeTick = isDark ? '#ffffff' : '#111'
        const inactiveTick = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'
        const shadow = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.03)'

        return (
          <div style={{
            display: 'flex', background: isDark ? '#0f172a' : '#f4f5f7', width: '100%', height: '100%',
            padding: '4cqmin', boxSizing: 'border-box',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Public Sans', sans-serif",
            transition: 'background 0.2s',
          }}>
            <div className={showDate ? 'fck-mini-root' : ''} data-theme={defaultTheme} style={!showDate ? { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' } : {}}>

              {/* Clock card */}
              <div className={showDate ? 'fck-mini-left' : ''} style={!showDate ? {
                background: miniCardBg, borderRadius: 'min(24px, 5cqmin)',
                width: 'min(400px, 70cqw)', height: 'min(400px, 70cqw)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', boxShadow: `0 10px 25px ${shadow}`,
                transition: 'background 0.2s',
              } : {}}>
                <svg viewBox="0 0 200 200" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                  {Array.from({ length: 60 }).map((_, i) => {
                    const a          = (i * 6 * Math.PI) / 180
                    const isHr       = i % 5 === 0
                    const isActive   = showSeconds ? i <= time.getSeconds() : true
                    return (
                      <line
                        key={i}
                        x1={100+(isHr?78:82)*Math.sin(a)} y1={100-(isHr?78:82)*Math.cos(a)}
                        x2={100+88*Math.sin(a)}            y2={100-88*Math.cos(a)}
                        stroke={isActive ? activeTick : inactiveTick}
                        strokeWidth={isHr ? 3 : 1.5} strokeLinecap="round"
                        style={{ transition: 'stroke 0.12s ease' }}
                      />
                    )
                  })}
                </svg>
                <div style={{ textAlign: 'center', zIndex: 5 }}>
                  <h1 style={{ fontSize: 'min(96px, 12cqmin)', fontWeight: 750, margin: 0, color: miniText, lineHeight: 1, fontFamily: "'Public Sans',sans-serif", letterSpacing: '-0.04em', transition: 'color 0.2s' }}>
                    {hoursStr}:{minsStr}
                  </h1>
                  {showSeconds && (
                    <div style={{ fontSize: 'min(32px, 3.5cqmin)', fontWeight: 600, color: miniMuted, marginTop: '1.5cqmin', letterSpacing: '0.05em', transition: 'color 0.2s' }}>
                      {secsStr}s
                    </div>
                  )}
                </div>
              </div>

              {/* Calendar card */}
              {showDate && (
                <div className="fck-mini-right">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: 'min(48px, 4.5cqmin)', fontWeight: 700, color: miniAccent, fontFamily: "'Public Sans',sans-serif", transition: 'color 0.2s' }}>
                      {monthNames[currentMonth]}
                    </h2>
                    <span style={{ fontSize: 'min(32px, 3cqmin)', fontWeight: 600, color: miniMuted, transition: 'color 0.2s' }}>{currentYear}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 'min(16px, 1.5cqmin) min(8px, 1cqmin)', textAlign: 'center' }}>
                    {['S','M','T','W','T','F','S'].map((l, i) => (
                      <span key={i} style={{ fontSize: 'min(28px, 2.5cqmin)', fontWeight: 600, color: miniMuted, paddingBottom: '4px', transition: 'color 0.2s' }}>{l}</span>
                    ))}
                    {cells.map((day, idx) => {
                      if (day === null) return <div key={`e-${idx}`} />
                      const isToday = day === currentDay
                      return (
                        <div key={`d-${day}`} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 'min(48px, 5.5cqmin)', fontSize: 'min(32px, 3cqmin)',
                          fontWeight: isToday ? 700 : 500, color: isToday ? (isDark ? '#0f172a' : '#fff') : miniText,
                          position: 'relative',
                          transition: 'color 0.2s',
                        }}>
                          {isToday && (
                            <div style={{
                              position: 'absolute',
                              width: 'min(44px, 5.2cqmin)',
                              height: 'min(44px, 5.2cqmin)',
                              borderRadius: '50%',
                              background: miniAccent,
                              zIndex: 1,
                              transition: 'background 0.2s',
                            }} />
                          )}
                          <span style={{ zIndex: 2 }}>{day}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>
        )
      })()}
      {/* ── Neon Pulse ── */}
      {style === 'neon-digital' && (
        <div className="fck-neon-root">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
            <h1 className="fck-neon-time">
              {hoursStr}:{minsStr}
              {showSeconds && <span className="fck-neon-secs">:{secsStr}</span>}
            </h1>
            {!use24Hour && <span className="fck-neon-ampm">{ampm}</span>}
          </div>
          {showDate && <p className="fck-neon-date">{formatDate(time, dateFormat)}</p>}
        </div>
      )}

      {/* ── Boardroom Serif ── */}
      {style === 'boardroom-serif' && (
        <div className="fck-board-root" data-theme={defaultTheme}>
          <div className="fck-board-divider" />
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
            <h1 className="fck-board-time">
              {hoursStr}:{minsStr}
              {showSeconds && <span className="fck-board-secs">:{secsStr}</span>}
            </h1>
            {!use24Hour && <span className="fck-board-ampm">{ampm}</span>}
          </div>
          <div className="fck-board-divider" />
          {showDate && <p className="fck-board-date">{formatDate(time, dateFormat)}</p>}
        </div>
      )}

    </div>
  )
}

