'use client'

import React from 'react'
import { WidgetSelectionModal, YouTubeWidgetModal, RemoteUrlWidgetModal, HtmlWidgetModal } from './WidgetModals'
import FlowWidgetModal from './FlowWidgetModal'

interface WidgetModalsContainerProps {
  showWidgetSelection: boolean
  setShowWidgetSelection: (val: boolean) => void
  showYouTubeConfig: boolean
  setShowYouTubeConfig: (val: boolean) => void
  showRemoteUrlConfig: boolean
  setShowRemoteUrlConfig: (val: boolean) => void
  showHtmlConfig: boolean
  setShowHtmlConfig: (val: boolean) => void
  showFlowConfig: boolean
  setShowFlowConfig: (val: boolean) => void
  isSubmittingWidget: boolean
  teamSlug: string
  onCreateYouTube: (name: string, url: string) => Promise<void>
  onCreateRemoteUrl: (name: string, url: string) => Promise<void>
  onCreateHtml: (name: string, html: string, css: string) => Promise<void>
  onCreateFlow: (name: string, config: any) => Promise<void>
}

export function WidgetModalsContainer({
  showWidgetSelection,
  setShowWidgetSelection,
  showYouTubeConfig,
  setShowYouTubeConfig,
  showRemoteUrlConfig,
  setShowRemoteUrlConfig,
  showHtmlConfig,
  setShowHtmlConfig,
  showFlowConfig,
  setShowFlowConfig,
  isSubmittingWidget,
  teamSlug,
  onCreateYouTube,
  onCreateRemoteUrl,
  onCreateHtml,
  onCreateFlow,
}: WidgetModalsContainerProps) {
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
          onSubmit={onCreateYouTube}
          isSubmitting={isSubmittingWidget}
        />
      )}

      {showRemoteUrlConfig && (
        <RemoteUrlWidgetModal 
          onClose={() => setShowRemoteUrlConfig(false)}
          onSubmit={onCreateRemoteUrl}
          isSubmitting={isSubmittingWidget}
        />
      )}

      {showHtmlConfig && (
        <HtmlWidgetModal
          onClose={() => setShowHtmlConfig(false)}
          onSubmit={onCreateHtml}
          isSubmitting={isSubmittingWidget}
          teamSlug={teamSlug}
        />
      )}

      {showFlowConfig && (
        <FlowWidgetModal
          onClose={() => setShowFlowConfig(false)}
          onSubmit={onCreateFlow}
          isSubmitting={isSubmittingWidget}
        />
      )}
    </>
  )
}
