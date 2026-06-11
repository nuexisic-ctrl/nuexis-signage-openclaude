'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import { getPlayerAsset } from '@/app/player/actions'
import FlowClockRenderer from '@/app/components/FlowClockRenderer'
import FlowCountdownRenderer from '@/app/components/FlowCountdownRenderer'
import FlowCountUpRenderer from '@/app/components/FlowCountUpRenderer'
import FlowWorldClockRenderer from '@/app/components/FlowWorldClockRenderer'
import WebsiteRenderer from '@/app/components/WebsiteRenderer'

function WidgetContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const assetId = params?.assetId as string
  const hardwareId = searchParams.get('hardwareId') || ''
  const secret = searchParams.get('secret') || ''

  const [asset, setAsset] = useState<{ file_path: string; mime_type: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!assetId || !hardwareId || !secret) {
      setError('Missing required parameters: assetId, hardwareId, or secret')
      setLoading(false)
      return
    }

    getPlayerAsset(assetId, hardwareId, secret)
      .then(data => {
        if (data) {
          setAsset(data)
        } else {
          setError('Widget not found or unauthorized')
        }
      })
      .catch(err => {
        console.error('Failed to load widget:', err)
        setError('Error loading widget')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [assetId, hardwareId, secret])

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', color: '#666', fontFamily: 'sans-serif' }}>
        Loading widget...
      </div>
    )
  }

  if (error || !asset) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', color: 'red', fontFamily: 'sans-serif', padding: '20px', textAlign: 'center' }}>
        {error || 'Widget failed to load'}
      </div>
    )
  }

  const { file_path: mediaUrl, mime_type: mimeType } = asset

  // Render Widget based on mimeType (mirrors PairedView.tsx and PlaylistEngine.tsx logic)
  if (mimeType === 'application/x-widget-flow') {
    try {
      const config = JSON.parse(mediaUrl)
      return (
        <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}>
          <FlowClockRenderer
            style={config.style}
            showSeconds={config.showSeconds}
            showDate={config.showDate}
            use24Hour={config.use24Hour}
            dateFormat={config.dateFormat}
            theme={config.theme}
          />
        </div>
      )
    } catch (err) {
      return <div style={{ color: 'red', padding: '20px' }}>Error rendering Clock widget</div>
    }
  }

  if (mimeType === 'application/x-widget-worldclock') {
    try {
      const config = JSON.parse(mediaUrl)
      return (
        <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}>
          <FlowWorldClockRenderer
            timezone={config.timezone}
            clockType={config.clockType}
            theme={config.theme}
            primaryColor={config.themeSettings?.primaryColor}
            secondaryColor={config.themeSettings?.secondaryColor}
            backgroundColor={config.themeSettings?.backgroundColor}
            textColor={config.themeSettings?.textColor}
            use24Hour={config.use24Hour}
            showSeconds={config.showSeconds}
          />
        </div>
      )
    } catch (err) {
      return <div style={{ color: 'red', padding: '20px' }}>Error rendering World Clock widget</div>
    }
  }

  if (mimeType === 'application/x-widget-countdown') {
    try {
      const config = JSON.parse(mediaUrl)
      return (
        <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}>
          <FlowCountdownRenderer
            text={config.text}
            endTime={config.endTime}
            endMessage={config.endMessage}
            timerStyle={config.timerStyle}
            daysOnly={config.daysOnly}
            theme={config.theme}
            themeSettings={config.themeSettings}
            advancedSettings={config.advancedSettings}
          />
        </div>
      )
    } catch (err) {
      return <div style={{ color: 'red', padding: '20px' }}>Error rendering Countdown widget</div>
    }
  }

  if (mimeType === 'application/x-widget-countup') {
    try {
      const config = JSON.parse(mediaUrl)
      return (
        <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}>
          <FlowCountUpRenderer
            text={config.text}
            startTime={config.startTime}
            endMessage={config.endMessage}
            timerStyle={config.timerStyle}
            daysOnly={config.daysOnly}
            theme={config.theme}
            themeSettings={config.themeSettings}
            advancedSettings={config.advancedSettings}
          />
        </div>
      )
    } catch (err) {
      return <div style={{ color: 'red', padding: '20px' }}>Error rendering CountUp widget</div>
    }
  }

  if (mimeType === 'application/x-widget-html') {
    try {
      const parsedConfig = JSON.parse(mediaUrl)
      if (parsedConfig) {
        const { html = '', css = '' } = parsedConfig
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
          <iframe
            title="widget-html-renderer"
            srcDoc={iframeSrcDoc}
            style={{ width: '100vw', height: '100vh', border: 'none' }}
            sandbox=""
          />
        )
      }
    } catch (err) {
      return <div style={{ color: 'red', padding: '20px' }}>Error rendering custom HTML widget</div>
    }
  }

  if (mimeType === 'application/x-widget-youtube') {
    let youtubeUrl = mediaUrl
    let ccEnabled = false
    try {
      const parsed = JSON.parse(mediaUrl)
      if (parsed && typeof parsed === 'object' && parsed.url) {
        youtubeUrl = parsed.url
        ccEnabled = !!parsed.ccEnabled
      }
    } catch {}

    const videoId = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)?.[1] || ''
    const ccParam = ccEnabled ? '&cc_load_policy=1' : ''
    return (
      <iframe 
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0${ccParam}`}
        style={{ width: '100vw', height: '100vh', border: 'none', pointerEvents: 'none' }}
        allow="autoplay; encrypted-media"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
      />
    )
  }

  if (mimeType === 'application/x-widget-website' || mimeType === 'application/x-widget-remote-url') {
    return (
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <WebsiteRenderer url={mediaUrl} />
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', color: 'white', fontFamily: 'sans-serif' }}>
      Unsupported widget type: {mimeType}
    </div>
  )
}

export default function WidgetPage() {
  return (
    <Suspense fallback={
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', color: '#666', fontFamily: 'sans-serif' }}>
        Loading widget...
      </div>
    }>
      <WidgetContent />
    </Suspense>
  )
}
