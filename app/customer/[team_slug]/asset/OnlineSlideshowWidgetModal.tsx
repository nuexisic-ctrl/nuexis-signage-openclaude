'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { X, Monitor, Smartphone, Maximize, Images, ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react'
import styles from './Modal.module.css'
import FlowSlideshowRenderer, { SlideshowImage } from '@/app/components/FlowSlideshowRenderer'
import { modalStack } from '@/lib/utils/modalStack'
import CustomSelect from '../components/CustomSelect'
import { createClient } from '@/lib/supabase/client'
import { getCachedSignedUrl } from '@/lib/supabase/mediaCache'
import { Asset } from './types'
import AssetBrowserModal from '../components/AssetBrowser/AssetBrowserModal'
import { toast } from '@/app/components/Toast'

interface OnlineSlideshowWidgetModalProps {
  onClose: () => void
  onBack?: () => void
  onSubmit: (
    name: string,
    config: {
      animation: 'fade' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out'
      backgroundColor: string
      duration: number
      images: { id: string; file_name: string; file_path: string }[]
    }
  ) => void
  isSubmitting: boolean
  assets: Asset[]
  teamSlug?: string
  teamId?: string
  initialData?: {
    name: string
    animation?: 'fade' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out'
    backgroundColor?: string
    duration?: number
    images?: SlideshowImage[]
  }
}

const NAME_MAX_LENGTH = 100
const MAX_IMAGES = 50

const ANIMATION_OPTIONS = [
  { value: 'fade', label: 'Fade Transition' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'zoom-out', label: 'Zoom Out' },
] as const

export default function OnlineSlideshowWidgetModal({
  onClose,
  onBack,
  onSubmit,
  isSubmitting,
  assets,
  teamSlug,
  teamId,
  initialData,
}: OnlineSlideshowWidgetModalProps) {
  const isEditMode = !!initialData
  const supabase = createClient()

  // Form states
  const [name, setName] = useState(initialData?.name ?? '')
  const [nameError, setNameError] = useState('')
  const [animation, setAnimation] = useState<'fade' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out'>(
    initialData?.animation ?? 'fade'
  )
  const [backgroundColor, setBackgroundColor] = useState(initialData?.backgroundColor ?? '#000000')
  const [duration, setDuration] = useState<number>(initialData?.duration ?? 5)
  const [durationError, setDurationError] = useState('')
  const [selectedImages, setSelectedImages] = useState<SlideshowImage[]>(initialData?.images ?? [])

  // Asset browser modal state
  const [showAssetBrowser, setShowAssetBrowser] = useState(false)

  // Drag select and backdrop click detection
  const dragStartRef = useRef(false)
  const wasDropdownOpenRef = useRef(false)

  // Live simulator orientation & fullscreen
  const [previewMode, setPreviewMode] = useState<'landscape' | 'portrait'>('landscape')
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false)

  // Lock body scroll and register with modalStack
  useEffect(() => {
    modalStack.push('slideshow-widget-modal')
    document.body.style.overflow = 'hidden'
    return () => {
      modalStack.pop('slideshow-widget-modal')
      document.body.style.overflow = ''
    }
  }, [])

  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFullscreenPreview) {
          setShowFullscreenPreview(false)
        } else if (modalStack.isTop('slideshow-widget-modal')) {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showFullscreenPreview, onClose])

  // Resolve signed URLs for initialData images that might not have preview URLs
  useEffect(() => {
    if (selectedImages.length === 0) return

    let isCancelled = false
    const resolveInitialUrls = async () => {
      const updated = await Promise.all(
        selectedImages.map(async (img) => {
          if (img.url) return img
          try {
            const url = await getCachedSignedUrl(supabase, img.file_path, 3600)
            return { ...img, url: url || undefined }
          } catch (err) {
            console.error('Failed to resolve initial slide preview:', img.file_path, err)
            return img
          }
        })
      )

      if (!isCancelled) {
        setSelectedImages(updated)
      }
    }

    resolveInitialUrls()
    return () => {
      isCancelled = true
    }
  }, [])

  const handleDurationChange = (val: string) => {
    const num = parseInt(val, 10)
    if (isNaN(num)) {
      setDuration(0)
      setDurationError('Duration must be between 1 and 300 seconds.')
      return
    }

    if (num < 1 || num > 300) {
      setDuration(num)
      setDurationError('Duration must be between 1 and 300 seconds.')
    } else {
      setDuration(num)
      setDurationError('')
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isSubmitting || nameError || durationError) return

    if (!name.trim()) {
      setNameError('Widget name is required.')
      return
    }

    if (duration < 1 || duration > 300) {
      setDurationError('Duration must be between 1 and 300 seconds.')
      return
    }

    if (selectedImages.length === 0) {
      toast.error('Please select at least one image for the slideshow.')
      return
    }

    if (selectedImages.length > MAX_IMAGES) {
      toast.error(`A maximum of ${MAX_IMAGES} images is allowed. Please remove some images.`)
      return
    }

    onSubmit(name.trim(), {
      animation,
      backgroundColor,
      duration,
      // Only send database reference fields
      images: selectedImages.map((img) => ({
        id: img.id,
        file_name: img.file_name,
        file_path: img.file_path,
      })),
    })
  }

  // Handle asset browser multiple select callback
  const handleSelectMultipleAssets = async (ids: string[]) => {
    setShowAssetBrowser(false)

    // Lookup selected IDs in the assets list
    const foundImages: SlideshowImage[] = []
    const toResolve: Asset[] = []

    for (const id of ids) {
      const asset = assets.find((a) => a.id === id)
      if (asset && asset.mime_type.startsWith('image/')) {
        // Keep order or map existing
        const existing = selectedImages.find((img) => img.id === id)
        if (existing) {
          foundImages.push(existing)
        } else {
          toResolve.push(asset)
        }
      }
    }

    // Resolve pre-signed urls for any newly selected images
    const resolvedNewImages = await Promise.all(
      toResolve.map(async (asset) => {
        try {
          const url = await getCachedSignedUrl(supabase, asset.file_path, 3600)
          return {
            id: asset.id,
            file_name: asset.file_name,
            file_path: asset.file_path,
            url: url || undefined,
          }
        } catch {
          return {
            id: asset.id,
            file_name: asset.file_name,
            file_path: asset.file_path,
          }
        }
      })
    )

    const totalPotential = foundImages.length + resolvedNewImages.length
    if (totalPotential > MAX_IMAGES) {
      toast.error(`You have reached the maximum limit of ${MAX_IMAGES} images for this slideshow.`)
    }
    const nextSelection = [...foundImages, ...resolvedNewImages].slice(0, MAX_IMAGES)
    setSelectedImages(nextSelection)
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    setSelectedImages((prev) => {
      const list = [...prev]
      const temp = list[index]
      list[index] = list[index - 1]
      list[index - 1] = temp
      return list
    })
  }

  const moveDown = (index: number) => {
    if (index === selectedImages.length - 1) return
    setSelectedImages((prev) => {
      const list = [...prev]
      const temp = list[index]
      list[index] = list[index + 1]
      list[index + 1] = temp
      return list
    })
  }

  const removeImage = (id: string) => {
    setSelectedImages((prev) => prev.filter((img) => img.id !== id))
  }

  return (
    <>
      <div
        className={`${styles.modalOverlay} ${styles.countdownWidgetOverlay}`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            dragStartRef.current = true
            wasDropdownOpenRef.current = !!document.querySelector('[data-dropdown]')
          } else {
            dragStartRef.current = false
          }
        }}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return
          if (!dragStartRef.current) return
          if (wasDropdownOpenRef.current) {
            wasDropdownOpenRef.current = false
            return
          }
          if (modalStack.hasActiveChildOf('slideshow-widget-modal')) {
            return
          }
          onClose()
        }}
      >
        <div
          className={styles.modalContainer}
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', flexDirection: 'column', padding: 0, width: '100%', maxWidth: '640px', height: 'auto', maxHeight: 'calc(100vh - 32px)' }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid var(--outline-variant)',
              background: 'var(--surface-low)',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className={styles.modalCloseBtn}
                  aria-label="Back to widget selection"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <Images size={22} color="var(--primary)" />
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    fontFamily: 'var(--font-serif)',
                    color: 'var(--on-surface)',
                    fontWeight: 600,
                  }}
                >
                  {isEditMode ? 'Edit Online Slideshow Widget' : 'Create Online Slideshow Widget'}
                </h2>
                {isEditMode && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                      color: 'var(--primary)',
                      fontFamily: 'var(--font-label)',
                      display: 'inline-block',
                      marginTop: '4px',
                    }}
                  >
                    EDITING
                  </span>
                )}
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--on-surface-subtle)' }}>
                  Configure slideshow animations, colors, durations, and manage selected images.
                </p>
              </div>
            </div>
            <button onClick={onClose} className={styles.modalCloseBtn} type="button" aria-label="Close modal">
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Form Content */}
          <form 
            onSubmit={handleSubmit} 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '18px', 
              padding: '24px', 
              overflowY: 'auto', 
              flex: 1,
              background: 'var(--surface-lowest)'
            }}
          >
              {/* Widget Name */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.84rem',
                    color: 'var(--on-surface)',
                    fontFamily: 'var(--font-label)',
                    fontWeight: 600,
                  }}
                >
                  Widget Name*
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  maxLength={NAME_MAX_LENGTH}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val.length > NAME_MAX_LENGTH) {
                      setName(val.slice(0, NAME_MAX_LENGTH))
                      setNameError(`Name cannot exceed ${NAME_MAX_LENGTH} characters.`)
                    } else {
                      setName(val)
                      setNameError(
                        val.length === NAME_MAX_LENGTH ? `Limit reached (${NAME_MAX_LENGTH}/${NAME_MAX_LENGTH}).` : ''
                      )
                    }
                  }}
                  placeholder="e.g. Office Slideshow"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1.5px solid ${nameError ? '#ef4444' : 'var(--outline-variant)'}`,
                    background: 'var(--surface-container-lowest)',
                    color: 'var(--on-surface)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.92rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {nameError && (
                  <span style={{ fontSize: '0.74rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                    {nameError}
                  </span>
                )}
              </div>

              {/* Animation Transition Style */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.84rem',
                    color: 'var(--on-surface)',
                    fontFamily: 'var(--font-label)',
                    fontWeight: 600,
                  }}
                >
                  Transition Animation
                </label>
                <CustomSelect
                  id="slideshow-animation"
                  value={animation}
                  options={ANIMATION_OPTIONS}
                  onChange={(val) => setAnimation(val as any)}
                />
              </div>

              {/* Duration Settings */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.84rem',
                    color: 'var(--on-surface)',
                    fontFamily: 'var(--font-label)',
                    fontWeight: 600,
                  }}
                >
                  Slide Duration (seconds - must be a number)*
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  max={300}
                  value={duration || ''}
                  onChange={(e) => handleDurationChange(e.target.value)}
                  placeholder="Enter a number (e.g. 5)"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1.5px solid ${durationError ? '#ef4444' : 'var(--outline-variant)'}`,
                    background: 'var(--surface-container-lowest)',
                    color: 'var(--on-surface)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.92rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {!durationError && (
                  <span style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', marginTop: '4px', display: 'block' }}>
                    Enter a number between 1 and 300 to set how long each image stays on screen.
                  </span>
                )}
                {durationError && (
                  <span style={{ fontSize: '0.74rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                    {durationError}
                  </span>
                )}
              </div>

              {/* Background Color Picker */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.84rem',
                    color: 'var(--on-surface)',
                    fontFamily: 'var(--font-label)',
                    fontWeight: 600,
                  }}
                >
                  Background Color
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={backgroundColor.startsWith('#') && backgroundColor.length === 7 ? backgroundColor : '#000000'}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    style={{
                      width: '40px',
                      height: '40px',
                      padding: 0,
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: 'none',
                    }}
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    placeholder="#000000"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--outline-variant)',
                      background: 'var(--surface-container-lowest)',
                      color: 'var(--on-surface)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.92rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Selected Images Section */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '0.84rem',
                      color: 'var(--on-surface)',
                      fontFamily: 'var(--font-label)',
                      fontWeight: 600,
                    }}
                  >
                    Slideshow Images ({selectedImages.length})*
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAssetBrowser(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--primary)',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={14} /> Select Images
                  </button>
                </div>

                <div
                  style={{
                    border: '1.5px solid var(--outline-variant)',
                    borderRadius: '8px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    background: 'var(--surface-container-lowest)',
                  }}
                >
                  {selectedImages.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--on-surface-subtle)' }}>
                      <p style={{ margin: 0, fontSize: '0.86rem' }}>No images selected yet.</p>
                      <button
                        type="button"
                        onClick={() => setShowAssetBrowser(true)}
                        style={{
                          marginTop: '8px',
                          padding: '6px 12px',
                          background: 'var(--primary)',
                          color: 'var(--on-primary)',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Browse Gallery
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {selectedImages.map((img, index) => (
                        <div
                          key={img.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderBottom: index < selectedImages.length - 1 ? '1px solid var(--outline-variant)' : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            {img.url ? (
                              <img
                                src={img.url}
                                alt="thumbnail"
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  objectFit: 'cover',
                                  borderRadius: '4px',
                                  background: 'black',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '4px',
                                  background: 'var(--surface-container-high)',
                                }}
                              />
                            )}
                            <span
                              style={{
                                fontSize: '0.84rem',
                                color: 'var(--on-surface)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={img.file_name}
                            >
                              {img.file_name}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => moveUp(index)}
                              disabled={index === 0}
                              style={{
                                padding: '4px',
                                color: index === 0 ? 'var(--on-surface-muted)' : 'var(--on-surface)',
                                cursor: index === 0 ? 'default' : 'pointer',
                                border: 'none',
                                background: 'none',
                              }}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveDown(index)}
                              disabled={index === selectedImages.length - 1}
                              style={{
                                padding: '4px',
                                color: index === selectedImages.length - 1 ? 'var(--on-surface-muted)' : 'var(--on-surface)',
                                cursor: index === selectedImages.length - 1 ? 'default' : 'pointer',
                                border: 'none',
                                background: 'none',
                              }}
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeImage(img.id)}
                              style={{ padding: '4px', color: '#ef4444', cursor: 'pointer', border: 'none', background: 'none' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </form>

          {/* Footer Controls */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--outline-variant)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            background: 'var(--surface-low)',
            gap: '12px',
            borderBottomLeftRadius: '16px',
            borderBottomRightRadius: '16px'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px', background: 'transparent', color: 'var(--on-surface-muted)', border: 'none', borderRadius: '8px',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-label)', fontSize: '0.88rem'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setShowFullscreenPreview(true)}
              disabled={selectedImages.length === 0}
              style={{
                padding: '10px 18px',
                background: 'var(--surface-container-high)',
                color: 'var(--on-surface)',
                border: '1px solid var(--outline-variant)',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: selectedImages.length === 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-label)',
                fontSize: '0.88rem'
              }}
            >
              Preview
            </button>
            <button
              onClick={() => handleSubmit()}
              disabled={isSubmitting || !name.trim() || !!nameError || !!durationError || selectedImages.length === 0}
              style={{
                padding: '10px 24px',
                background: (!name.trim() || selectedImages.length === 0) ? 'var(--surface-low)' : 'var(--primary)',
                color: (!name.trim() || selectedImages.length === 0) ? 'var(--on-surface-subtle)' : 'var(--on-primary)',
                border: 'none', borderRadius: '8px', fontWeight: 600,
                cursor: (isSubmitting || !name.trim() || selectedImages.length === 0) ? 'not-allowed' : 'pointer',
                opacity: (isSubmitting || !name.trim() || selectedImages.length === 0) ? 0.7 : 1,
                boxShadow: (!name.trim() || selectedImages.length === 0) ? 'none' : '0 4px 12px rgba(9, 76, 178, 0.2)',
                fontFamily: 'var(--font-label)', fontSize: '0.88rem'
              }}
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save Widget'}
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Live Preview */}
      {showFullscreenPreview && (
        <div style={{
          position: 'fixed', inset: 0, background: '#05070a', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 200ms ease-out'
        }}>
          <div style={{
            width: previewMode === 'landscape' ? 'min(90vw, calc((90vh * 16) / 9))' : 'min(90vw, calc((90vh * 9) / 16))',
            height: previewMode === 'landscape' ? 'min(90vh, calc((90vw * 9) / 16))' : 'min(90vh, calc((90vw * 16) / 9))',
            aspectRatio: previewMode === 'landscape' ? '16 / 9' : '9 / 16',
            background: '#000000', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FlowSlideshowRenderer
              images={selectedImages}
              animation={animation}
              backgroundColor={backgroundColor}
              duration={duration}
            />
          </div>

          <div style={{
            position: 'absolute', top: '24px', right: '24px', display: 'flex', alignItems: 'center', gap: '12px',
            background: 'rgba(0, 0, 0, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)',
            borderRadius: '30px', padding: '6px 16px', color: '#ffffff', fontSize: '0.86rem', fontFamily: 'var(--font-label)', fontWeight: 500
          }}>
            <span style={{ marginRight: '8px' }}>Preview:</span>
            <button
              type="button"
              onClick={() => setPreviewMode('landscape')}
              style={{
                background: previewMode === 'landscape' ? '#ffffff' : 'transparent',
                color: previewMode === 'landscape' ? '#000000' : '#ffffff',
                border: 'none', borderRadius: '15px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
              }}
            >
              16:9
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('portrait')}
              style={{
                background: previewMode === 'portrait' ? '#ffffff' : 'transparent',
                color: previewMode === 'portrait' ? '#000000' : '#ffffff',
                border: 'none', borderRadius: '15px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
              }}
            >
              9:16
            </button>
            <div style={{ width: '1px', height: '16px', background: 'rgba(255, 255, 255, 0.2)', margin: '0 4px' }} />
            <button
              onClick={() => setShowFullscreenPreview(false)}
              style={{
                background: '#ffffff', border: 'none', color: '#000000', borderRadius: '50%', width: '26px', height: '26px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1.0)'}
              aria-label="Exit fullscreen preview"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Shared Asset Browser Modal */}
      {showAssetBrowser && (
        <AssetBrowserModal
          assets={assets}
          teamSlug={teamSlug}
          teamId={teamId}
          isMultiSelect={true}
          allowedMimeTypes={['image/']}
          initialSelectedIds={selectedImages.map((img) => img.id)}
          onClose={() => setShowAssetBrowser(false)}
          onSelectMultiple={handleSelectMultipleAssets}
        />
      )}
    </>
  )
}
