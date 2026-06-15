'use client'

import React, { useEffect, useState } from 'react'

interface NewsTickerRendererProps {
  feedUrl?: string
  speed?: number // seconds for one full scroll cycle
  theme?: 'dark' | 'light'
  title?: string
}

export default function NewsTickerRenderer({ feedUrl = '', speed = 25, theme = 'dark', title = 'BREAKING NEWS' }: NewsTickerRendererProps) {
  const [items, setItems] = useState<string[]>([])

  useEffect(() => {
    // Premium default mock feeds representing global news updates
    const mockFeeds = [
      'NuExis Platform releases Native Android digital signage player with local caching and offline recovery.',
      'Global market trends show a significant increase in smart retail interactive display deployments.',
      'Weather alert: Seasonal adjustments expected across the east coast; screens updating layouts in real time.',
      'Tech update: AI integrations in CMS platforms improve content rotation scheduling and efficiency by 40%.'
    ]
    setItems(mockFeeds)
  }, [feedUrl])

  const isDark = theme === 'dark'

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: '64px',
    background: isDark ? '#0b132b' : '#f1f5f9',
    color: isDark ? '#ffffff' : '#0f172a',
    borderTop: isDark ? '2px solid #1e293b' : '2px solid #e2e8f0',
    overflow: 'hidden',
    position: 'absolute',
    bottom: 0,
    left: 0,
    zIndex: 9999,
    fontFamily: 'system-ui, -apple-system, sans-serif'
  }

  const titleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '0 24px',
    background: '#ef4444',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: '0.9rem',
    letterSpacing: '1px',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    boxShadow: '4px 0 15px rgba(239, 68, 68, 0.4)',
    zIndex: 10
  }

  const tickerTrackStyle: React.CSSProperties = {
    display: 'flex',
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    height: '100%',
    alignItems: 'center'
  }

  const animationName = `marquee-${Math.random().toString(36).substr(2, 9)}`

  const itemsText = items.join('   •   ')

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>{title}</div>
      <div style={tickerTrackStyle}>
        <style>{`
          @keyframes ${animationName} {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-50%, 0, 0); }
          }
          .ticker-content {
            display: inline-flex;
            white-space: nowrap;
            padding-left: 20px;
            animation: ${animationName} ${speed}s linear infinite;
            font-size: 1.1rem;
            font-weight: 500;
            letter-spacing: 0.5px;
          }
          .ticker-content span {
            display: inline-block;
            margin-right: 50px;
          }
        `}</style>
        <div className="ticker-content">
          <span>{itemsText}</span>
          {/* Duplicate to ensure a seamless looping effect */}
          <span>{itemsText}</span>
        </div>
      </div>
    </div>
  )
}
