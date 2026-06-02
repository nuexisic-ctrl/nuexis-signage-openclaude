'use client'

import React from 'react'
import { Device, Asset, Playlist } from './types'
import { PairModal } from './PairModal'
import { AssignModal } from './AssignModal'
import { DeleteModal } from './DeleteModal'
import { RenameModal } from './RenameModal'
import { ScreenPreviewModal } from './ScreenPreviewModal'

interface ScreensModalsProps {
  showPairModal: boolean
  setShowPairModal: (show: boolean) => void
  assignModalDevice: Device | null
  setAssignModalDevice: (device: Device | null) => void
  deleteModalDevice: Device | null
  setDeleteModalDevice: (device: Device | null) => void
  renameModalDevice: Device | null
  setRenameModalDevice: (device: Device | null) => void
  previewState: any
  setPreviewState: (state: any) => void
  assets: Asset[]
  playlists: Playlist[]
  teamSlug: string
  handlePairSuccess: () => void
  handleAssignSuccess: () => void
  handleDeleteSuccess: () => void
  handleRenameSuccess: (name: string) => void
}

export function ScreensModals({
  showPairModal,
  setShowPairModal,
  assignModalDevice,
  setAssignModalDevice,
  deleteModalDevice,
  setDeleteModalDevice,
  renameModalDevice,
  setRenameModalDevice,
  previewState,
  setPreviewState,
  assets,
  playlists,
  teamSlug,
  handlePairSuccess,
  handleAssignSuccess,
  handleDeleteSuccess,
  handleRenameSuccess
}: ScreensModalsProps) {
  return (
    <>
      {showPairModal && (
        <PairModal 
          teamSlug={teamSlug} 
          onClose={() => setShowPairModal(false)} 
          onSuccess={handlePairSuccess} 
        />
      )}

      {assignModalDevice && (
        <AssignModal
          device={assignModalDevice} 
          assets={assets} 
          playlists={playlists} 
          teamSlug={teamSlug}
          onClose={() => setAssignModalDevice(null)} 
          onSuccess={handleAssignSuccess}
          onPreview={(device, contentType, assetId, playlistId, scaleMode, orientation) => 
            setPreviewState({ device, contentType, assetId, playlistId, scaleMode, orientation })
          }
        />
      )}

      {deleteModalDevice && (
        <DeleteModal 
          deviceId={deleteModalDevice.id} 
          deviceName={deleteModalDevice.name || 'Unnamed Screen'} 
          teamSlug={teamSlug} 
          onClose={() => setDeleteModalDevice(null)} 
          onSuccess={handleDeleteSuccess} 
        />
      )}

      {renameModalDevice && (
        <RenameModal 
          currentName={renameModalDevice.name || 'Unnamed Screen'} 
          teamSlug={teamSlug} 
          deviceId={renameModalDevice.id} 
          onClose={() => setRenameModalDevice(null)} 
          onSuccess={handleRenameSuccess} 
        />
      )}

      {previewState && (
        <ScreenPreviewModal
          device={previewState.device} 
          teamSlug={teamSlug} 
          onClose={() => setPreviewState(null)}
          contentType={previewState.contentType} 
          assetId={previewState.assetId} 
          playlistId={previewState.playlistId}
          scaleMode={previewState.scaleMode} 
          orientation={previewState.orientation} 
          assets={assets} 
          playlists={playlists}
        />
      )}
    </>
  )
}
