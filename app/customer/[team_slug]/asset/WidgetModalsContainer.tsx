'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { WidgetSelectionModal, YouTubeWidgetModal, RemoteUrlWidgetModal, HtmlWidgetModal } from './WidgetModals'
import FlowWidgetModal from './FlowWidgetModal'
import { insertAsset } from './actions'
import { Asset } from './types'

interface WidgetModalsContainerProps {
  showWidgetSelection: boolean
  setShowWidgetSelection: (val: boolean) => void
  teamSlug: string
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>
  setShowSuccess: (val: boolean) => void
}

export function WidgetModalsContainer({
  showWidgetSelection,
  setShowWidgetSelection,
  teamSlug,
  setAssets,
  setShowSuccess,
}: WidgetModalsContainerProps) {
  const [showYouTubeConfig, setShowYouTubeConfig] = useState(false)
  const [showRemoteUrlConfig, setShowRemoteUrlConfig] = useState(false)
  const [showHtmlConfig, setShowHtmlConfig] = useState(false)
  const [showFlowConfig, setShowFlowConfig] = useState(false)
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
    style: 'classic-digital' | 'modern-digital' | 'classic-analog' | 'modern-analog' | 'minimalist'
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
    </>
  )
}
