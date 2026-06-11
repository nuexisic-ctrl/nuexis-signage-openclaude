'use client'

/**
 * WidgetEditContainer
 * Renders the appropriate widget editor modal pre-populated with the existing
 * asset's configuration.  On save it calls `updateWidgetAsset` and optimistically
 * updates the asset list so changes are visible immediately.
 */

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { YouTubeWidgetModal, YouTubePlaylistWidgetModal, RemoteUrlWidgetModal, HtmlWidgetModal, QRCodeWidgetModal, WebsiteWidgetModal, parseYouTubeConfig, parseYouTubePlaylistConfig } from './WidgetModals'
import FlowWidgetModal from './FlowWidgetModal'
import CountdownWidgetModal from './CountdownWidgetModal'
import CountUpWidgetModal from './CountUpWidgetModal'
import WorldClockWidgetModal from './WorldClockWidgetModal'
import { updateWidgetAsset } from './actions'
import { Asset } from './types'
import { toast } from '@/app/components/Toast'

interface WidgetEditContainerProps {
  /** The asset being edited */
  asset: Asset
  teamSlug: string
  /** Called when the modal is closed (on cancel or successful save) */
  onClose: () => void
  /** Optimistically update the parent's asset list */
  onUpdated: (updatedAsset: Asset) => void
  assets?: Asset[]
}

export function WidgetEditContainer({
  asset,
  teamSlug,
  onClose,
  onUpdated,
  assets = [],
}: WidgetEditContainerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  /** Parse the asset's file_path JSON safely */
  function parseConfig<T>(fallback: T): T {
    try {
      return JSON.parse(asset.file_path) as T
    } catch {
      return fallback
    }
  }

  /** Shared save handler used by all modal types */
  async function saveWidget(newName: string, newFilePath: string) {
    setIsSubmitting(true)
    const result = await updateWidgetAsset(teamSlug, asset.id, newName, newFilePath, asset.mime_type)
    setIsSubmitting(false)

    if (result.success) {
      const updatedAsset: Asset = { ...asset, file_name: newName, file_path: newFilePath }
      onUpdated(updatedAsset)
      toast.success(`Widget "${newName}" updated successfully`)
      startTransition(() => { router.refresh() })
      onClose()
    } else {
      toast.error(result.error || 'Failed to save widget changes.')
    }
  }

  // ── YouTube ──────────────────────────────────────────────────────────────
  if (asset.mime_type === 'application/x-widget-youtube') {
    const config = parseYouTubeConfig(asset.file_path)
    return (
      <YouTubeWidgetModal
        onClose={onClose}
        onSubmit={(name, cfg) => saveWidget(name, JSON.stringify(cfg))}
        isSubmitting={isSubmitting}
        initialData={{ name: asset.file_name, url: config.url, ccEnabled: config.ccEnabled }}
      />
    )
  }

  // ── YouTube Playlist ─────────────────────────────────────────────────────
  if (asset.mime_type === 'application/x-widget-youtube-playlist') {
    const config = parseYouTubePlaylistConfig(asset.file_path)
    return (
      <YouTubePlaylistWidgetModal
        onClose={onClose}
        onSubmit={(name, cfg) => saveWidget(name, JSON.stringify(cfg))}
        isSubmitting={isSubmitting}
        initialData={{
          name: asset.file_name,
          url: config.url,
          ccEnabled: config.ccEnabled,
          shuffleEnabled: config.shuffleEnabled
        }}
      />
    )
  }

  // ── Remote URL ───────────────────────────────────────────────────────────
  if (asset.mime_type === 'application/x-widget-remote-url') {
    return (
      <RemoteUrlWidgetModal
        onClose={onClose}
        onSubmit={(name, url) => saveWidget(name, url)}
        isSubmitting={isSubmitting}
        initialData={{ name: asset.file_name, url: asset.file_path }}
      />
    )
  }

  // ── Website ──────────────────────────────────────────────────────────────
  if (asset.mime_type === 'application/x-widget-website') {
    return (
      <WebsiteWidgetModal
        onClose={onClose}
        onSubmit={(name, url) => saveWidget(name, url)}
        isSubmitting={isSubmitting}
        initialData={{ name: asset.file_name, url: asset.file_path }}
        assets={assets}
      />
    )
  }

  // ── HTML Widget ──────────────────────────────────────────────────────────
  if (asset.mime_type === 'application/x-widget-html') {
    const config = parseConfig<{ html: string; css: string }>({ html: '', css: '' })
    return (
      <HtmlWidgetModal
        onClose={onClose}
        onSubmit={(name, html, css) => saveWidget(name, JSON.stringify({ html, css }))}
        isSubmitting={isSubmitting}
        teamSlug={teamSlug}
        initialData={{ name: asset.file_name, html: config.html, css: config.css }}
      />
    )
  }

  // ── Clock (Flow) Widget ──────────────────────────────────────────────────
  if (asset.mime_type === 'application/x-widget-flow') {
    const config = parseConfig<{
      style?: string
      showSeconds?: boolean
      showDate?: boolean
      use24Hour?: boolean
      dateFormat?: string
      theme?: 'light' | 'dark'
    }>({})
    return (
      <FlowWidgetModal
        onClose={onClose}
        onSubmit={(name, cfg) => saveWidget(name, JSON.stringify(cfg))}
        isSubmitting={isSubmitting}
        initialData={{
          name: asset.file_name,
          style: config.style ?? 'classic-digital',
          showSeconds: config.showSeconds ?? true,
          showDate: config.showDate ?? true,
          use24Hour: config.use24Hour ?? false,
          dateFormat: config.dateFormat ?? 'January 01, 2024',
          theme: config.theme ?? 'light',
        }}
      />
    )
  }

  // ── Countdown Widget ─────────────────────────────────────────────────────
  if (asset.mime_type === 'application/x-widget-countdown') {
    const config = parseConfig<{
      text?: string
      endTime?: string
      endMessage?: string
      timerStyle?: string
      daysOnly?: boolean
      theme?: string
      themeSettings?: {
        primaryColor?: string
        secondaryColor?: string
        backgroundColor?: string
        textColor?: string
        backgroundImage?: string
      }
    }>({})
    return (
      <CountdownWidgetModal
        onClose={onClose}
        onSubmit={(name, cfg) => saveWidget(name, JSON.stringify(cfg))}
        isSubmitting={isSubmitting}
        initialData={{
          name: asset.file_name,
          text: config.text,
          endTime: config.endTime,
          endMessage: config.endMessage,
          timerStyle: config.timerStyle,
          daysOnly: config.daysOnly,
          theme: config.theme,
          themeSettings: config.themeSettings,
        }}
      />
    )
  }

  // ── CountUp Widget ───────────────────────────────────────────────────────
  if (asset.mime_type === 'application/x-widget-countup') {
    const config = parseConfig<{
      text?: string
      startTime?: string
      endTime?: string
      endMessage?: string
      timerStyle?: string
      daysOnly?: boolean
      theme?: string
      themeSettings?: {
        primaryColor?: string
        secondaryColor?: string
        backgroundColor?: string
        textColor?: string
        backgroundImage?: string
      }
      advancedSettings?: {
        showDate?: boolean
        dateFormat?: string
      }
    }>({})
    return (
      <CountUpWidgetModal
        onClose={onClose}
        onSubmit={(name, cfg) => saveWidget(name, JSON.stringify(cfg))}
        isSubmitting={isSubmitting}
        initialData={{
          name: asset.file_name,
          text: config.text,
          startTime: config.startTime,
          endTime: config.endTime,
          endMessage: config.endMessage,
          timerStyle: config.timerStyle,
          daysOnly: config.daysOnly,
          theme: config.theme,
          themeSettings: config.themeSettings,
          advancedSettings: config.advancedSettings,
        }}
      />
    )
  }
  // ── World Clock Widget ───────────────────────────────────────────────────
  if (asset.mime_type === 'application/x-widget-worldclock') {
    const config = parseConfig<{
      clockType?: 'analog' | 'digital'
      timezone?: string
      theme?: 'light' | 'dark' | 'custom'
      themeSettings?: {
        backgroundColor?: string
        textColor?: string
      }
      use24Hour?: boolean
      showSeconds?: boolean
    }>({})
    return (
      <WorldClockWidgetModal
        onClose={onClose}
        onSubmit={(name, cfg) => saveWidget(name, JSON.stringify(cfg))}
        isSubmitting={isSubmitting}
        initialData={{
          name: asset.file_name,
          clockType: config.clockType ?? 'analog',
          timezone: config.timezone ?? 'UTC',
          theme: config.theme ?? 'light',
          themeSettings: config.themeSettings,
          use24Hour: config.use24Hour ?? false,
          showSeconds: config.showSeconds ?? true
        }}
      />
    )
  }

  // ── QR Code Widget ───────────────────────────────────────────────────────
  // QR Code edit is handled by the existing QRCodeWidgetModal but in edit-only mode:
  // the user can regenerate the QR from an updated URL, which requires a new file upload.
  // For now, we fall through to the standard preview for QR Codes (metadata-only edits
  // happen via the rename modal). To keep things simple, return null here so the caller
  // falls back to the preview modal.
  return null
}
