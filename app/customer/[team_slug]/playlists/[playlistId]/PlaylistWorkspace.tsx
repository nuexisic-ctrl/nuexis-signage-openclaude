'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/app/components/Toast'
import { updatePlaylist, deletePlaylist } from '../actions'
import { updatePlaylistName, duplicatePlaylist } from './actions'
import type { PlaylistEditorData, PlaylistItemWithAsset, AssignedDevice } from './actions'
import type { SelectedAsset } from './components/AssetPickerModal'
import WorkspaceHeader from './components/WorkspaceHeader'
import PlaylistTable from './components/PlaylistTable'
import PlaylistInfoPanel from './components/PlaylistInfoPanel'
import PlaylistPreview from './components/PlaylistPreview'
import PushToScreenModal from './components/PushToScreenModal'
import AssetPickerModal from './components/AssetPickerModal'
import styles from './workspace.module.css'

interface PlaylistWorkspaceProps {
  initialData: PlaylistEditorData
  teamSlug: string
  teamId: string
  userRole: string
}

// ── Undo/Redo Engine ────────────────────────────────────────────────────
interface HistoryState {
  items: PlaylistItemWithAsset[]
}

const MAX_HISTORY = 50

function useUndoRedo(initial: PlaylistItemWithAsset[]) {
  const [items, setItemsRaw] = useState<PlaylistItemWithAsset[]>(initial)
  const undoStack = useRef<HistoryState[]>([])
  const redoStack = useRef<HistoryState[]>([])
  const lastPersistedRef = useRef<PlaylistItemWithAsset[]>(initial)

  const pushSnapshot = useCallback(() => {
    undoStack.current.push({ items: [...items] })
    if (undoStack.current.length > MAX_HISTORY) {
      undoStack.current.shift()
    }
    redoStack.current = []
  }, [items])

  const setItems = useCallback((newItems: PlaylistItemWithAsset[] | ((prev: PlaylistItemWithAsset[]) => PlaylistItemWithAsset[])) => {
    setItemsRaw(prev => {
      const next = typeof newItems === 'function' ? newItems(prev) : newItems
      return next
    })
  }, [])

  const setItemsWithHistory = useCallback((newItems: PlaylistItemWithAsset[] | ((prev: PlaylistItemWithAsset[]) => PlaylistItemWithAsset[])) => {
    pushSnapshot()
    setItems(newItems)
  }, [pushSnapshot, setItems])

  const undo = useCallback(() => {
    const snapshot = undoStack.current.pop()
    if (!snapshot) return
    redoStack.current.push({ items: [...items] })
    setItemsRaw(snapshot.items)
  }, [items])

  const redo = useCallback(() => {
    const snapshot = redoStack.current.pop()
    if (!snapshot) return
    undoStack.current.push({ items: [...items] })
    setItemsRaw(snapshot.items)
  }, [items])

  const markPersisted = useCallback(() => {
    lastPersistedRef.current = [...items]
  }, [items])

  const isDirty = useCallback(() => {
    return JSON.stringify(items) !== JSON.stringify(lastPersistedRef.current)
  }, [items])

  return {
    items,
    setItems: setItemsWithHistory,
    setItemsRaw: setItems,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    markPersisted,
    isDirty,
  }
}

// ── Main Workspace Component ────────────────────────────────────────────

export default function PlaylistWorkspace({ initialData, teamSlug, teamId, userRole }: PlaylistWorkspaceProps) {
  const { t } = useTranslation()
  const router = useRouter()

  const {
    items, setItems, setItemsRaw, undo, redo, canUndo, canRedo, markPersisted, isDirty,
  } = useUndoRedo(initialData.items)

  const [playlistName, setPlaylistName] = useState(initialData.name)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [isSaving, setIsSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showPushModal, setShowPushModal] = useState(false)
  const [showAssetPicker, setShowAssetPicker] = useState(false)
  const [assignedDevices, setAssignedDevices] = useState<AssignedDevice[]>(initialData.assignedDevices)

  // Track dirty state
  useEffect(() => {
    if (isDirty()) {
      setSaveStatus('unsaved')
    }
  }, [items, isDirty])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey

      if (isCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if (isCtrl && (e.key === 'Z' || (e.key === 'z' && e.shiftKey)) ) {
        e.preventDefault()
        redo()
      }
      if (isCtrl && e.key === 'y') {
        e.preventDefault()
        redo()
      }
      if (isCtrl && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  // ── Save ──
  const handleSave = useCallback(async () => {
    if (isSaving) return
    setIsSaving(true)
    setSaveStatus('saving')

    try {
      const itemsPayload = items.map((item, index) => ({
        type: item.type,
        asset_id: item.asset_id || null,
        duration_seconds: item.duration_seconds,
        widget_type: item.widget_type || null,
        widget_config: item.widget_config || null,
      }))

      await updatePlaylist(initialData.id, playlistName, teamSlug, itemsPayload)

      // Broadcast refresh to players
      const supabase = createClient()
      const channel = supabase.channel(`playlist-broadcast-${initialData.id}`)
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'refresh',
            payload: { timestamp: Date.now() },
          })
          setTimeout(() => supabase.removeChannel(channel), 1000)
        }
      })

      markPersisted()
      setSaveStatus('saved')
      toast.success(t('Playlist saved successfully'))
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || t('Failed to save playlist'))
      setSaveStatus('unsaved')
    } finally {
      setIsSaving(false)
    }
  }, [items, playlistName, initialData.id, teamSlug, isSaving, markPersisted, t])

  // ── Rename ──
  const handleRename = useCallback(async (newName: string) => {
    const oldName = playlistName
    setPlaylistName(newName) // optimistic
    try {
      await updatePlaylistName(initialData.id, newName, teamSlug)
      toast.success(t('Playlist renamed'))
    } catch (err: any) {
      setPlaylistName(oldName) // rollback
      toast.error(err.message || t('Failed to rename playlist'))
    }
  }, [initialData.id, teamSlug, playlistName, t])

  // ── Delete ──
  const handleDelete = useCallback(async () => {
    if (!confirm(t('Are you sure you want to delete this playlist?'))) return
    try {
      await deletePlaylist(initialData.id, teamSlug)
      toast.success(t('Playlist deleted'))
      router.push(`/customer/${teamSlug}/playlists`)
    } catch (err: any) {
      toast.error(err.message || t('Failed to delete playlist'))
    }
  }, [initialData.id, teamSlug, router, t])

  // ── Duplicate ──
  const handleDuplicate = useCallback(async () => {
    try {
      const result = await duplicatePlaylist(initialData.id, teamSlug)
      toast.success(t('Playlist duplicated successfully'))
      router.push(`/customer/${teamSlug}/playlists/${result.id}`)
    } catch (err: any) {
      toast.error(err.message || t('Failed to duplicate playlist'))
    }
  }, [initialData.id, teamSlug, router, t])

  // ── Item mutations ──
  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    setItems(prev => {
      const newItems = [...prev]
      const [moved] = newItems.splice(fromIndex, 1)
      newItems.splice(toIndex, 0, moved)
      return newItems.map((item, i) => ({ ...item, sort_order: i }))
    })
  }, [setItems])

  const handleRemoveItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, sort_order: i })))
  }, [setItems])

  const handleUpdateDuration = useCallback((index: number, seconds: number) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, duration_seconds: seconds } : item
    ))
  }, [setItems])

  const handleAssetsSelected = useCallback((assets: SelectedAsset[]) => {
    setItems(prev => {
      const newItems = [...prev]
      for (const asset of assets) {
        const type = asset.mime_type.startsWith('video/') ? 'video' : 'image'
        newItems.push({
          id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          playlist_id: initialData.id,
          type,
          asset_id: asset.id,
          widget_type: null,
          widget_config: null,
          duration_seconds: 10,
          sort_order: newItems.length,
          created_at: new Date().toISOString(),
          assets: {
            id: asset.id,
            file_name: asset.file_name,
            file_path: asset.file_path,
            mime_type: asset.mime_type,
            size_bytes: asset.size_bytes,
            width: asset.width,
            height: asset.height,
          },
        })
      }
      return newItems
    })
  }, [initialData.id, setItems])

  const handlePushed = useCallback(() => {
    // Re-fetch assigned devices by refreshing page data
    router.refresh()
  }, [router])

  // Auto-save on dirty state (debounced)
  useEffect(() => {
    if (!isDirty()) return
    const timeout = setTimeout(() => {
      handleSave()
    }, 3000) // Auto-save after 3 seconds of inactivity
    return () => clearTimeout(timeout)
  }, [items])

  return (
    <>
      <WorkspaceHeader
        name={playlistName}
        teamSlug={teamSlug}
        saveStatus={saveStatus}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onPreviewToggle={() => setShowPreview(!showPreview)}
        onPushToScreen={() => setShowPushModal(true)}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onRename={handleRename}
        isPreviewOpen={showPreview}
      />

      <div className={styles.body}>
        <div className={styles.contentArea}>
          {/* Preview (above table when open) */}
          {showPreview && (
            <PlaylistPreview
              items={items}
              onClose={() => setShowPreview(false)}
            />
          )}

          {/* Content Table */}
          <PlaylistTable
            items={items}
            onReorder={handleReorder}
            onRemoveItem={handleRemoveItem}
            onUpdateDuration={handleUpdateDuration}
            onOpenAssetPicker={() => setShowAssetPicker(true)}
          />
        </div>

        {/* Info Panel */}
        <PlaylistInfoPanel
          items={items}
          createdAt={initialData.created_at}
          updatedAt={initialData.updated_at}
          assignedDevices={assignedDevices}
        />
      </div>

      {/* Push to Screen Modal */}
      {showPushModal && (
        <PushToScreenModal
          playlistId={initialData.id}
          playlistName={playlistName}
          teamSlug={teamSlug}
          currentAssignedIds={assignedDevices.map(d => d.id)}
          onClose={() => setShowPushModal(false)}
          onPushed={handlePushed}
        />
      )}

      {/* Asset Picker Modal */}
      {showAssetPicker && (
        <AssetPickerModal
          teamId={teamId}
          onSelect={handleAssetsSelected}
          onClose={() => setShowAssetPicker(false)}
        />
      )}
    </>
  )
}
