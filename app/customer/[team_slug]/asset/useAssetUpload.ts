'use client'

import { useState, useCallback } from 'react'
import { getUploadUrl, insertAsset } from './actions'
import { Asset } from './types'
import { UploadItem } from './UploadPanel'

const MAX_FILE_SIZE = 50 * 1024 * 1024
const ALLOWED_EXTENSIONS = /\.(png|jpg|jpeg|mp4|webm|pdf)$/i

function validateFile(file: File): { valid: true } | { valid: false; error: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `"${file.name}" exceeds the 50MB limit.` }
  }
  if (!file.name.match(ALLOWED_EXTENSIONS)) {
    return { valid: false, error: `"${file.name}" has an invalid file type. Only PNG, JPG, JPEG, MP4, WEBM, and PDF are allowed.` }
  }
  return { valid: true }
}

interface UseAssetUploadProps {
  teamId: string
  teamSlug: string
  supabase: any
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>
  startTransition: React.TransitionStartFunction
  router: any
  folderId?: string | null
}

export function useAssetUpload({
  teamId,
  teamSlug,
  supabase,
  setAssets,
  startTransition,
  router,
  folderId,
}: UseAssetUploadProps) {
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([])
  const [isQueueCollapsed, setIsQueueCollapsed] = useState(false)
  const [showQueuePanel, setShowQueuePanel] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleFiles = useCallback(async (files: File[]) => {
    if (!teamId) {
      setUploadError('Could not determine your team. Please refresh and try again.')
      return
    }
    setUploadError(null)
    
    // Add all files to the queue
    const newItems: UploadItem[] = files.map((file, idx) => ({
      id: `${file.name}-${Date.now()}-${idx}`,
      fileName: file.name,
      progress: 0,
      status: 'waiting',
      size: file.size
    }))
    
    setShowQueuePanel(true)
    setIsQueueCollapsed(false)
    setUploadQueue(prev => [...newItems, ...prev])

    const uploadedAssets: Asset[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files.at(i)
      const queueItem = newItems.at(i)

      if (!file || !queueItem) continue

      // Set status to uploading and initial progress
      setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, status: 'uploading', progress: 5, startTime: Date.now() } : item))

      // Simulate smooth progress
      let simulatedProgress = 5
      const progressInterval = setInterval(() => {
        setUploadQueue(prev => prev.map(item => {
          if (item.id === queueItem.id && item.status === 'uploading' && item.progress < 90) {
            simulatedProgress = Math.min(90, simulatedProgress + Math.floor(Math.random() * 8) + 2)
            return { ...item, progress: simulatedProgress }
          }
          return item
        }))
      }, 150)

      try {
        // Validate file size and type
        const check = validateFile(file)
        if (!check.valid) {
          clearInterval(progressInterval)
          setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, status: 'failed', progress: 0, error: check.error } : item))
          continue
        }

        const uploadUrlResult = await getUploadUrl(teamSlug, file.name, file.size)
        if (!uploadUrlResult.success) {
          clearInterval(progressInterval)
          setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, status: 'failed', progress: 0, error: uploadUrlResult.error } : item))
          continue
        }

        const { path: filePath, token } = uploadUrlResult
        const { error: storageError } = await supabase.storage
          .from('workspace-media')
          .uploadToSignedUrl(filePath, token, file, { cacheControl: '3600', upsert: false })

        if (storageError) {
          clearInterval(progressInterval)
          setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, status: 'failed', progress: 0, error: storageError.message } : item))
          continue
        }

        const result = await insertAsset(teamSlug, {
          file_name: file.name,
          file_path: filePath,
          mime_type: file.type,
          size_bytes: file.size,
          folder_id: folderId || null,
        })

        clearInterval(progressInterval)

        if (!result.success) {
          setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, status: 'failed', progress: 0, error: result.error } : item))
        } else {
          // Success!
          setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, status: 'completed', progress: 100 } : item))
          
          const newAsset: Asset = {
            id: result.id,
            file_name: file.name,
            file_path: filePath,
            mime_type: file.type,
            size_bytes: file.size,
            created_at: new Date().toISOString(),
            folder_id: folderId || null,
          }
          uploadedAssets.push(newAsset)
          // Add directly to local assets list so it renders instantly
          setAssets(prev => [newAsset, ...prev])
        }
      } catch (err: any) {
        clearInterval(progressInterval)
        setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, status: 'failed', progress: 0, error: err?.message || 'Unexpected error' } : item))
      }
    }

    if (uploadedAssets.length > 0) {
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
    }

    startTransition(() => { router.refresh() })
  }, [teamId, teamSlug, supabase, router, setAssets, folderId])

  return {
    uploadQueue,
    setUploadQueue,
    isQueueCollapsed,
    setIsQueueCollapsed,
    showQueuePanel,
    setShowQueuePanel,
    uploadError,
    setUploadError,
    showSuccess,
    setShowSuccess,
    handleFiles,
  }
}
