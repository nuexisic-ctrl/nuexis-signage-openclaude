'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { WidgetSelectionModal, YouTubeWidgetModal, RemoteUrlWidgetModal, HtmlWidgetModal, QRCodeWidgetModal } from './WidgetModals'
import FlowWidgetModal from './FlowWidgetModal'
import { insertAsset, getUploadUrl } from './actions'
import { createClient } from '@/lib/supabase/client'
import { Asset } from './types'

interface WidgetModalsContainerProps {
  showWidgetSelection: boolean
  setShowWidgetSelection: (val: boolean) => void
  teamSlug: string
  assets: Asset[]
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>
  setShowSuccess: (val: boolean) => void
}

export function WidgetModalsContainer({
  showWidgetSelection,
  setShowWidgetSelection,
  teamSlug,
  assets,
  setAssets,
  setShowSuccess,
}: WidgetModalsContainerProps) {
  const supabase = createClient()
  const [showYouTubeConfig, setShowYouTubeConfig] = useState(false)
  const [showRemoteUrlConfig, setShowRemoteUrlConfig] = useState(false)
  const [showHtmlConfig, setShowHtmlConfig] = useState(false)
  const [showFlowConfig, setShowFlowConfig] = useState(false)
  const [showQRCodeConfig, setShowQRCodeConfig] = useState(false)
  const [isSubmittingWidget, setIsSubmittingWidget] = useState(false)
  
  const [, startTransition] = useTransition()
  const router = useRouter()

  const handleCreateYouTubeWidget = async (name: string, url: string) => {
    setIsSubmittingWidget(true)
    const result = await insertAsset(teamSlug, {
      file_name: name,
      file_path: url,
      mime_type: 'application/x-widget-youtube',
      size_bytes: 0,
    })

    if (result.success) {
      const newAsset: Asset = {
        id: result.id!,
        file_name: name,
        file_path: url,
        mime_type: 'application/x-widget-youtube',
        size_bytes: 0,
        created_at: new Date().toISOString(),
      }
      setAssets(prev => [newAsset, ...prev])
      setShowYouTubeConfig(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
      startTransition(() => { router.refresh() })
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
    })

    if (result.success) {
      const newAsset: Asset = {
        id: result.id!,
        file_name: name,
        file_path: url,
        mime_type: 'application/x-widget-remote-url',
        size_bytes: 0,
        created_at: new Date().toISOString(),
      }
      setAssets(prev => [newAsset, ...prev])
      setShowRemoteUrlConfig(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
      startTransition(() => { router.refresh() })
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
    })

    if (result.success) {
      const newAsset: Asset = {
        id: result.id!,
        file_name: name,
        file_path: serialized,
        mime_type: 'application/x-widget-html',
        size_bytes: 0,
        created_at: new Date().toISOString(),
      }
      setAssets(prev => [newAsset, ...prev])
      setShowHtmlConfig(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
      startTransition(() => { router.refresh() })
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
    })

    if (result.success) {
      const newAsset: Asset = {
        id: result.id!,
        file_name: name,
        file_path: serialized,
        mime_type: 'application/x-widget-flow',
        size_bytes: 0,
        created_at: new Date().toISOString(),
      }
      setAssets(prev => [newAsset, ...prev])
      setShowFlowConfig(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
      startTransition(() => { router.refresh() })
    }
    setIsSubmittingWidget(false)
  }

  return (
    <>
      {showWidgetSelection && (
        <WidgetSelectionModal 
          onClose={() => setShowWidgetSelection(false)} 
          onSelectYouTube={() => setShowYouTubeConfig(true)}
          onSelectRemoteUrl={() => setShowRemoteUrlConfig(true)}
          onSelectHtml={() => setShowHtmlConfig(true)}
          onSelectFlow={() => setShowFlowConfig(true)}
          onSelectQRCode={() => setShowQRCodeConfig(true)}
        />
      )}

      {showYouTubeConfig && (
        <YouTubeWidgetModal 
          onClose={() => setShowYouTubeConfig(false)}
          onSubmit={handleCreateYouTubeWidget}
          isSubmitting={isSubmittingWidget}
        />
      )}

      {showRemoteUrlConfig && (
        <RemoteUrlWidgetModal 
          onClose={() => setShowRemoteUrlConfig(false)}
          onSubmit={handleCreateRemoteUrlWidget}
          isSubmitting={isSubmittingWidget}
        />
      )}

      {showHtmlConfig && (
        <HtmlWidgetModal
          onClose={() => setShowHtmlConfig(false)}
          onSubmit={handleCreateHtmlWidget}
          isSubmitting={isSubmittingWidget}
          teamSlug={teamSlug}
        />
      )}

      {showFlowConfig && (
        <FlowWidgetModal
          onClose={() => setShowFlowConfig(false)}
          onSubmit={handleCreateFlowWidget}
          isSubmitting={isSubmittingWidget}
        />
      )}

      {showQRCodeConfig && (
        <QRCodeWidgetModal
          onClose={() => setShowQRCodeConfig(false)}
          onSubmit={async (name, config, file) => {
            setIsSubmittingWidget(true)
            try {
              // 1. Get signed upload URL
              const uploadUrlResult = await getUploadUrl(teamSlug, file.name, file.size)
              if (!uploadUrlResult.success) {
                alert(uploadUrlResult.error)
                setIsSubmittingWidget(false)
                return
              }
              
              // 2. Upload file to Supabase storage client-side
              const { path: filePath, token } = uploadUrlResult
              const { error: storageError } = await supabase.storage
                .from('workspace-media')
                .uploadToSignedUrl(filePath, token, file, { cacheControl: '3600', upsert: false })
              
              if (storageError) {
                alert(storageError.message)
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
              })

              if (result.success) {
                const newAsset: Asset = {
                  id: result.id!,
                  file_name: name,
                  file_path: serialized,
                  mime_type: 'application/x-widget-qrcode',
                  size_bytes: file.size,
                  created_at: new Date().toISOString(),
                }
                setAssets(prev => [newAsset, ...prev])
                setShowQRCodeConfig(false)
                setShowSuccess(true)
                setTimeout(() => setShowSuccess(false), 5000)
                startTransition(() => { router.refresh() })
              } else {
                alert(result.error || 'Failed to save widget configuration.')
              }
            } catch (err: any) {
              console.error('[QRCodeWidget] Error saving widget:', err)
              alert(err.message || 'An unexpected error occurred.')
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
