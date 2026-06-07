'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { WidgetSelectionModal, YouTubeWidgetModal, YouTubePlaylistWidgetModal, RemoteUrlWidgetModal, HtmlWidgetModal, QRCodeWidgetModal } from './WidgetModals'
import FlowWidgetModal from './FlowWidgetModal'
import CountdownWidgetModal from './CountdownWidgetModal'
import CountUpWidgetModal from './CountUpWidgetModal'
import { insertAsset, getUploadUrl } from './actions'
import { createClient } from '@/lib/supabase/client'
import { Asset } from './types'
import { toast } from '@/app/components/Toast'

interface WidgetModalsContainerProps {
  showWidgetSelection: boolean
  setShowWidgetSelection: (val: boolean) => void
  teamSlug: string
  assets: Asset[]
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>
  setShowSuccess: (val: boolean) => void
  folderId?: string | null
}

export function WidgetModalsContainer({
  showWidgetSelection,
  setShowWidgetSelection,
  teamSlug,
  assets,
  setAssets,
  setShowSuccess,
  folderId,
}: WidgetModalsContainerProps) {
  const supabase = createClient()
  const [showYouTubeConfig, setShowYouTubeConfig] = useState(false)
  const [showYouTubePlaylistConfig, setShowYouTubePlaylistConfig] = useState(false)
  const [showRemoteUrlConfig, setShowRemoteUrlConfig] = useState(false)
  const [showHtmlConfig, setShowHtmlConfig] = useState(false)
  const [showFlowConfig, setShowFlowConfig] = useState(false)
  const [showQRCodeConfig, setShowQRCodeConfig] = useState(false)
  const [showCountdownConfig, setShowCountdownConfig] = useState(false)
  const [showCountUpConfig, setShowCountUpConfig] = useState(false)
  const [isSubmittingWidget, setIsSubmittingWidget] = useState(false)
  
  const [, startTransition] = useTransition()
  const router = useRouter()

  const handleCreateYouTubeWidget = async (name: string, config: { url: string; ccEnabled: boolean }) => {
    setIsSubmittingWidget(true)
    const serialized = JSON.stringify(config)
    const result = await insertAsset(teamSlug, {
      file_name: name,
      file_path: serialized,
      mime_type: 'application/x-widget-youtube',
      size_bytes: 0,
      folder_id: folderId || null,
    })

    if (result.success) {
      const newAsset: Asset = {
        id: result.id!,
        file_name: name,
        file_path: serialized,
        mime_type: 'application/x-widget-youtube',
        size_bytes: 0,
        created_at: new Date().toISOString(),
        folder_id: folderId || null,
      }
      setAssets(prev => [newAsset, ...prev])
      setShowYouTubeConfig(false)
      toast.success(`YouTube widget "${name}" created successfully`)
      startTransition(() => { router.refresh() })
    } else {
      toast.error(result.error || 'Failed to create YouTube widget.')
    }
    setIsSubmittingWidget(false)
  }

  const handleCreateYouTubePlaylistWidget = async (name: string, config: { url: string; ccEnabled: boolean; shuffleEnabled: boolean }) => {
    setIsSubmittingWidget(true)
    const serialized = JSON.stringify(config)
    const result = await insertAsset(teamSlug, {
      file_name: name,
      file_path: serialized,
      mime_type: 'application/x-widget-youtube-playlist',
      size_bytes: 0,
      folder_id: folderId || null,
    })

    if (result.success) {
      const newAsset: Asset = {
        id: result.id!,
        file_name: name,
        file_path: serialized,
        mime_type: 'application/x-widget-youtube-playlist',
        size_bytes: 0,
        created_at: new Date().toISOString(),
        folder_id: folderId || null,
      }
      setAssets(prev => [newAsset, ...prev])
      setShowYouTubePlaylistConfig(false)
      toast.success(`YouTube Playlist widget "${name}" created successfully`)
      startTransition(() => { router.refresh() })
    } else {
      toast.error(result.error || 'Failed to create YouTube Playlist widget.')
    }
    setIsSubmittingWidget(false)
  }

  const handleCreateRemoteUrlWidget = async (name: string, url: string) => {
    setIsSubmittingWidget(true)
    const result = await insertAsset(teamSlug, {
      file_name: name,
      file_path: url,
      mime_type: 'application/x-widget-remote-url',
      size_bytes: 0,
      folder_id: folderId || null,
    })

    if (result.success) {
      const newAsset: Asset = {
        id: result.id!,
        file_name: name,
        file_path: url,
        mime_type: 'application/x-widget-remote-url',
        size_bytes: 0,
        created_at: new Date().toISOString(),
        folder_id: folderId || null,
      }
      setAssets(prev => [newAsset, ...prev])
      setShowRemoteUrlConfig(false)
      toast.success(`Webpage widget "${name}" created successfully`)
      startTransition(() => { router.refresh() })
    } else {
      toast.error(result.error || 'Failed to create Webpage widget.')
    }
    setIsSubmittingWidget(false)
  }

  const handleCreateHtmlWidget = async (name: string, html: string, css: string) => {
    setIsSubmittingWidget(true)
    const serialized = JSON.stringify({ html, css })
    const result = await insertAsset(teamSlug, {
      file_name: name,
      file_path: serialized,
      mime_type: 'application/x-widget-html',
      size_bytes: 0,
      folder_id: folderId || null,
    })

    if (result.success) {
      const newAsset: Asset = {
        id: result.id!,
        file_name: name,
        file_path: serialized,
        mime_type: 'application/x-widget-html',
        size_bytes: 0,
        created_at: new Date().toISOString(),
        folder_id: folderId || null,
      }
      setAssets(prev => [newAsset, ...prev])
      setShowHtmlConfig(false)
      toast.success(`HTML widget "${name}" created successfully`)
      startTransition(() => { router.refresh() })
    } else {
      toast.error(result.error || 'Failed to create HTML widget.')
    }
    setIsSubmittingWidget(false)
  }

  const handleCreateFlowWidget = async (name: string, config: {
    style: 'classic-digital' | 'modern-digital' | 'classic-analog' | 'modern-analog' | 'minimalist' | 'neon-digital' | 'boardroom-serif'
    showSeconds: boolean
    showDate: boolean
    use24Hour: boolean
    dateFormat: string
    theme?: 'light' | 'dark'
  }) => {
    setIsSubmittingWidget(true)
    const serialized = JSON.stringify(config)
    const result = await insertAsset(teamSlug, {
      file_name: name,
      file_path: serialized,
      mime_type: 'application/x-widget-flow',
      size_bytes: 0,
      folder_id: folderId || null,
    })

    if (result.success) {
      const newAsset: Asset = {
        id: result.id!,
        file_name: name,
        file_path: serialized,
        mime_type: 'application/x-widget-flow',
        size_bytes: 0,
        created_at: new Date().toISOString(),
        folder_id: folderId || null,
      }
      setAssets(prev => [newAsset, ...prev])
      setShowFlowConfig(false)
      toast.success(`Clock widget "${name}" created successfully`)
      startTransition(() => { router.refresh() })
    } else {
      toast.error(result.error || 'Failed to create Clock widget.')
    }
    setIsSubmittingWidget(false)
  }

  const handleCreateCountdownWidget = async (name: string, config: {
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
    advancedSettings?: any
  }) => {
    setIsSubmittingWidget(true)
    const serialized = JSON.stringify(config)
    const result = await insertAsset(teamSlug, {
      file_name: name,
      file_path: serialized,
      mime_type: 'application/x-widget-countdown',
      size_bytes: 0,
      folder_id: folderId || null,
    })

    if (result.success) {
      const newAsset: Asset = {
        id: result.id!,
        file_name: name,
        file_path: serialized,
        mime_type: 'application/x-widget-countdown',
        size_bytes: 0,
        created_at: new Date().toISOString(),
        folder_id: folderId || null,
      }
      setAssets(prev => [newAsset, ...prev])
      setShowCountdownConfig(false)
      toast.success(`Countdown widget "${name}" created successfully`)
      startTransition(() => { router.refresh() })
    } else {
      toast.error(result.error || 'Failed to create Countdown widget.')
    }
    setIsSubmittingWidget(false)
  }

  const handleCreateCountUpWidget = async (name: string, config: {
    text: string
    startTime: string
    endTime?: string
    endMessage?: string
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
    advancedSettings?: any
  }) => {
    setIsSubmittingWidget(true)
    const serialized = JSON.stringify(config)
    const result = await insertAsset(teamSlug, {
      file_name: name,
      file_path: serialized,
      mime_type: 'application/x-widget-countup',
      size_bytes: 0,
      folder_id: folderId || null,
    })

    if (result.success) {
      const newAsset: Asset = {
        id: result.id!,
        file_name: name,
        file_path: serialized,
        mime_type: 'application/x-widget-countup',
        size_bytes: 0,
        created_at: new Date().toISOString(),
        folder_id: folderId || null,
      }
      setAssets(prev => [newAsset, ...prev])
      setShowCountUpConfig(false)
      toast.success(`Count Up widget "${name}" created successfully`)
      startTransition(() => { router.refresh() })
    } else {
      toast.error(result.error || 'Failed to create Count Up widget.')
    }
    setIsSubmittingWidget(false)
  }

  return (
    <>
      {showWidgetSelection && (
        <WidgetSelectionModal 
          onClose={() => setShowWidgetSelection(false)} 
          onSelectYouTube={() => setShowYouTubeConfig(true)}
          onSelectYouTubePlaylist={() => setShowYouTubePlaylistConfig(true)}
          onSelectRemoteUrl={() => setShowRemoteUrlConfig(true)}
          onSelectHtml={() => setShowHtmlConfig(true)}
          onSelectFlow={() => setShowFlowConfig(true)}
          onSelectQRCode={() => setShowQRCodeConfig(true)}
          onSelectCountdown={() => setShowCountdownConfig(true)}
          onSelectCountUp={() => setShowCountUpConfig(true)}
        />
      )}

      {showYouTubeConfig && (
        <YouTubeWidgetModal 
          onClose={() => setShowYouTubeConfig(false)}
          onBack={() => {
            setShowYouTubeConfig(false)
            setShowWidgetSelection(true)
          }}
          onSubmit={handleCreateYouTubeWidget}
          isSubmitting={isSubmittingWidget}
        />
      )}

      {showYouTubePlaylistConfig && (
        <YouTubePlaylistWidgetModal 
          onClose={() => setShowYouTubePlaylistConfig(false)}
          onBack={() => {
            setShowYouTubePlaylistConfig(false)
            setShowWidgetSelection(true)
          }}
          onSubmit={handleCreateYouTubePlaylistWidget}
          isSubmitting={isSubmittingWidget}
        />
      )}

      {showRemoteUrlConfig && (
        <RemoteUrlWidgetModal 
          onClose={() => setShowRemoteUrlConfig(false)}
          onBack={() => {
            setShowRemoteUrlConfig(false)
            setShowWidgetSelection(true)
          }}
          onSubmit={handleCreateRemoteUrlWidget}
          isSubmitting={isSubmittingWidget}
        />
      )}

      {showHtmlConfig && (
        <HtmlWidgetModal
          onClose={() => setShowHtmlConfig(false)}
          onBack={() => {
            setShowHtmlConfig(false)
            setShowWidgetSelection(true)
          }}
          onSubmit={handleCreateHtmlWidget}
          isSubmitting={isSubmittingWidget}
          teamSlug={teamSlug}
        />
      )}

      {showFlowConfig && (
        <FlowWidgetModal
          onClose={() => setShowFlowConfig(false)}
          onBack={() => {
            setShowFlowConfig(false)
            setShowWidgetSelection(true)
          }}
          onSubmit={handleCreateFlowWidget}
          isSubmitting={isSubmittingWidget}
        />
      )}

      {showCountdownConfig && (
        <CountdownWidgetModal
          onClose={() => setShowCountdownConfig(false)}
          onBack={() => {
            setShowCountdownConfig(false)
            setShowWidgetSelection(true)
          }}
          onSubmit={handleCreateCountdownWidget}
          isSubmitting={isSubmittingWidget}
        />
      )}

      {showCountUpConfig && (
        <CountUpWidgetModal
          onClose={() => setShowCountUpConfig(false)}
          onBack={() => {
            setShowCountUpConfig(false)
            setShowWidgetSelection(true)
          }}
          onSubmit={handleCreateCountUpWidget}
          isSubmitting={isSubmittingWidget}
        />
      )}

      {showQRCodeConfig && (
        <QRCodeWidgetModal
          onClose={() => setShowQRCodeConfig(false)}
          onBack={() => {
            setShowQRCodeConfig(false)
            setShowWidgetSelection(true)
          }}
          onSubmit={async (name, config, file) => {
            setIsSubmittingWidget(true)
            try {
              // 1. Get signed upload URL
              const uploadUrlResult = await getUploadUrl(teamSlug, file.name, file.size)
              if (!uploadUrlResult.success) {
                toast.error(uploadUrlResult.error)
                setIsSubmittingWidget(false)
                return
              }
              
              // 2. Upload file to Supabase storage client-side
              const { path: filePath, token } = uploadUrlResult
              const { error: storageError } = await supabase.storage
                .from('workspace-media')
                .uploadToSignedUrl(filePath, token, file, { cacheControl: '3600', upsert: false })
              
              if (storageError) {
                toast.error(storageError.message)
                setIsSubmittingWidget(false)
                return
              }
 
              // 3. Insert widget asset config
              const serialized = JSON.stringify({
                ...config,
                png_path: filePath
              })
              const result = await insertAsset(teamSlug, {
                file_name: name,
                file_path: serialized,
                mime_type: 'application/x-widget-qrcode',
                size_bytes: file.size,
                folder_id: folderId || null,
              })
 
              if (result.success) {
                const newAsset: Asset = {
                  id: result.id!,
                  file_name: name,
                  file_path: serialized,
                  mime_type: 'application/x-widget-qrcode',
                  size_bytes: file.size,
                  created_at: new Date().toISOString(),
                  folder_id: folderId || null,
                }
                setAssets(prev => [newAsset, ...prev])
                setShowQRCodeConfig(false)
                toast.success(`QR Code widget "${name}" created successfully`)
                startTransition(() => { router.refresh() })
              } else {
                toast.error(result.error || 'Failed to save widget configuration.')
              }
            } catch (err: any) {
              console.error('[QRCodeWidget] Error saving widget:', err)
              toast.error(err.message || 'An unexpected error occurred.')
            } finally {
              setIsSubmittingWidget(false)
            }
          }}
          isSubmitting={isSubmittingWidget}
          assets={assets}
        />
      )}
    </>
  )
}
