'use client'

import { useState, useCallback } from 'react'
import { getUploadUrl, insertAsset } from './actions'
import { Asset } from './types'
import { UploadItem } from './UploadPanel'

import { toast } from '@/app/components/Toast'

import { MAX_FILE_SIZE_BYTES } from '@/lib/utils/constants'
import { validateFile } from './validators'

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
      toast.error('Could not determine your team. Please refresh and try again.')
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

      let filePath: string | null = null
      try {
        // Validate file size and type
        const check = validateFile(file, MAX_FILE_SIZE_BYTES)
        if (!check.valid) {
          setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, status: 'failed', progress: 0, error: check.error } : item))
          continue
        }

        const uploadUrlResult = await getUploadUrl(teamSlug, file.name, file.size)
        if (!uploadUrlResult.success) {
          setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, status: 'failed', progress: 0, error: uploadUrlResult.error } : item))
          continue
        }

        const { path: uploadedPath, token, signedUrl } = uploadUrlResult
        filePath = uploadedPath

        // Perform manual upload with XMLHttpRequest to trace actual progress events
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', signedUrl, true)
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)
          xhr.setRequestHeader('Cache-Control', 'no-cache')
          
          const uploadStartTime = Date.now()
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.min(99, Math.round((event.loaded / event.total) * 100))
              const elapsedMs = Date.now() - uploadStartTime
              const speedBytesPerSec = elapsedMs > 0 ? (event.loaded / (elapsedMs / 1000)) : 0
              setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, progress: percentComplete, speed: speedBytesPerSec } : item))
            }
          }
          
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve()
            } else {
              reject(new Error(xhr.responseText || `Upload failed with status ${xhr.status}`))
            }
          }
          
          xhr.onerror = () => {
            reject(new Error('Network connection error occurred during upload.'))
          }
          
          xhr.ontimeout = () => {
            reject(new Error('Upload request timed out.'))
          }
          
          xhr.timeout = 10 * 60 * 1000 // 10 minutes timeout
          xhr.send(file)
        })

        const result = await insertAsset(teamSlug, {
          file_name: file.name,
          file_path: filePath,
          mime_type: file.type,
          size_bytes: file.size,
          folder_id: folderId || null,
        })

        if (!result.success) {
          await supabase.storage.from('workspace-media').remove([filePath])
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
        if (filePath) {
          try {
            await supabase.storage.from('workspace-media').remove([filePath])
          } catch (storageErr) {
            console.error('[useAssetUpload] failed to remove orphan storage file:', storageErr)
          }
        }
        setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, status: 'failed', progress: 0, error: err?.message || 'Unexpected error' } : item))
      }
    }

    if (uploadedAssets.length > 0) {
      toast.success(
        uploadedAssets.length === 1
          ? `Media "${uploadedAssets[0].file_name}" uploaded successfully.`
          : `Successfully uploaded ${uploadedAssets.length} media files.`
      )
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
