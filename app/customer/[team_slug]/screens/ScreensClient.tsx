'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { claimDevice, updateDeviceAssignment, deleteAndUnpairDevice, AssignmentData } from './actions'
import styles from './screens.module.css'

type LiveStatus = 'online' | 'offline' | 'pairing'

interface Device {
  id: string
  name: string | null
  status: 'online' | 'offline' | 'pairing'
  created_at: string
  content_type?: string | null
  asset_id?: string | null
  scale_mode?: string | null
  orientation?: number | null
  last_seen_at?: string | null
}

export interface Asset {
  id: string
  file_name: string
  file_path: string
  mime_type: string
  size_bytes: number
}

interface Props {
  devices: Device[]
  assets: Asset[]
  teamSlug: string
  teamId: string
}

function StatusBadge({ status }: { status: LiveStatus }) {
  const cls: Record<LiveStatus, string> = {
    online:  styles.statusOnline,
    offline: styles.statusOffline,
    pairing: styles.statusPairing,
  }

  const dotCls: Record<LiveStatus, string> = {
    online:  styles.statusDotOnline,
    offline: styles.statusDotOffline,
    pairing: styles.statusDotPairing,
  }

  return (
    <span className={`${styles.statusBadge} ${cls[status]}`}>
      <span className={`${styles.statusDot} ${dotCls[status]}`} />
      {status}
    </span>
  )
}

function formatLastSeen(dateStr: string | null | undefined, isOnline: boolean): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const prefix = isOnline ? 'Active' : 'Seen'
  if (diff < 60000) return `${prefix} just now`
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${prefix} ${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${prefix} ${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${prefix} ${days}d ago`
}

function DeviceCard({
  device,
  liveStatus,
  onEdit,
  onDelete,
  menuOpen,
  onToggleMenu
}: {
  device: Device
  liveStatus: LiveStatus
  onEdit: () => void
  onDelete: () => void
  menuOpen: boolean
  onToggleMenu: (e: React.MouseEvent) => void
}) {
  const createdAt = new Date(device.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  const lastSeen = formatLastSeen(device.last_seen_at, liveStatus === 'online')

  return (
    <div className={styles.deviceCard}>
      <div className={styles.deviceCardHeaderTop}>
        <h3 className={styles.deviceName}>{device.name || 'Unnamed Screen'}</h3>
        <div className={styles.statusAndMenu}>
          <StatusBadge status={liveStatus} />
          <div className={styles.moreMenuWrapper}>
            <button 
              className={`${styles.moreBtn} ${menuOpen ? styles.active : ''}`}
              onClick={onToggleMenu}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
              </svg>
            </button>
            {menuOpen && (
              <div className={styles.moreDropdown}>
                <button className={styles.dropdownItem} onClick={onEdit}>
                  Edit Content
                </button>
                <button className={`${styles.dropdownItem} ${styles.danger}`} onClick={onDelete}>
                  Unpair & Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={styles.deviceMeta} onClick={onEdit} style={{ cursor: 'pointer' }}>
        <div className={styles.deviceMetaRow}>
          <span className={styles.deviceMetaLabel}>Added</span>
          <span className={styles.deviceMetaValue}>{createdAt}</span>
        </div>
        <div className={styles.deviceMetaRow}>
          <span className={styles.deviceMetaLabel}>Last Seen</span>
          <span className={styles.deviceMetaValue}>{lastSeen}</span>
        </div>
      </div>
    </div>
  )
}

function PairModal({
  teamSlug,
  onClose,
  onSuccess,
}: {
  teamSlug: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [code, setCode]       = useState('')
  const [name, setName]       = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await claimDevice(teamSlug, code, name)
      if (result.success) {
        onSuccess()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div
      id="pair-modal-overlay"
      className={styles.overlay}
      ref={overlayRef}
      onClick={handleOverlayClick}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className={styles.modalHeader}>
          <div>
            <h2 id="modal-title" className={styles.modalTitle}>Add Screen</h2>
            <p className={styles.modalSubtitle}>
              Open the NuExis player app on your screen and enter the 6-digit code shown.
            </p>
          </div>
          <button
            id="modal-close-btn"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label htmlFor="pairing-code" className={styles.label}>Pairing Code</label>
            <input
              id="pairing-code"
              className={styles.codeInput}
              type="text"
              inputMode="text"
              placeholder="A1B 2C3"
              maxLength={7}
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6)
                setCode(val)
                if (val.length === 6) {
                  document.getElementById('screen-name')?.focus()
                }
              }}
              autoFocus
              autoComplete="off"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="screen-name" className={styles.label}>Screen Name</label>
            <input
              id="screen-name"
              className={styles.input}
              type="text"
              placeholder="e.g. Lobby Display, Reception TV"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {error && (
            <div className={styles.errorMsg} role="alert">
              <span>⚠</span>
              {error}
            </div>
          )}

          <button
            id="pair-submit-btn"
            className={styles.submitBtn}
            type="submit"
            disabled={isPending || code.length !== 6 || name.trim().length === 0}
          >
            {isPending ? 'Pairing…' : 'Pair Screen'}
          </button>
        </form>
      </div>
    </div>
  )
}

function AssignModal({
  device,
  assets,
  teamSlug,
  onClose,
  onSuccess,
}: {
  device: Device
  assets: Asset[]
  teamSlug: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [contentType, setContentType] = useState<'Asset' | 'Playlist' | 'Schedule'>(
    (device.content_type as 'Asset' | 'Playlist' | 'Schedule') || 'Asset'
  )
  const [assetId, setAssetId] = useState<string>(device.asset_id || '')
  const [scaleMode, setScaleMode] = useState<'None' | 'Fit' | 'Stretch' | 'Zoom'>(
    (device.scale_mode as 'None' | 'Fit' | 'Stretch' | 'Zoom') || 'Fit'
  )
  const [orientation, setOrientation] = useState<0 | 90 | 180 | 270>(
    (device.orientation as 0 | 90 | 180 | 270) || 0
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const data: AssignmentData = {
        content_type: contentType,
        asset_id: contentType === 'Asset' ? (assetId || null) : null,
        scale_mode: scaleMode,
        orientation,
      }
      const result = await updateDeviceAssignment(teamSlug, device.id, data)
      if (result.success) {
        onSuccess()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.modal} role="dialog">
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Assign Content</h2>
            <p className={styles.modalSubtitle}>Configure what plays on {device.name || 'Unnamed Screen'}</p>
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Content Type</label>
            <select className={styles.input} value={contentType} onChange={(e) => setContentType(e.target.value as 'Asset' | 'Playlist' | 'Schedule')}>
              <option value="Asset">Asset</option>
              <option value="Playlist" disabled>Playlist (Coming Soon)</option>
              <option value="Schedule" disabled>Schedule (Coming Soon)</option>
            </select>
          </div>

          {contentType === 'Asset' && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Selected Asset</label>
              <select className={styles.input} value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                <option value="">-- Select an asset --</option>
                {assets.map(asset => (
                  <option key={asset.id} value={asset.id}>{asset.file_name}</option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Scale Mode</label>
            <select className={styles.input} value={scaleMode} onChange={(e) => setScaleMode(e.target.value as 'None' | 'Fit' | 'Stretch' | 'Zoom')}>
              <option value="None">None</option>
              <option value="Fit">Fit</option>
              <option value="Stretch">Stretch</option>
              <option value="Zoom">Zoom</option>
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Orientation</label>
            <select className={styles.input} value={orientation} onChange={(e) => setOrientation(Number(e.target.value) as 0 | 90 | 180 | 270)}>
              <option value={0}>Landscape (0°)</option>
              <option value={90}>Rotate 90°</option>
              <option value={180}>Rotate 180°</option>
              <option value={270}>Rotate 270°</option>
            </select>
          </div>

          {error && <div className={styles.errorMsg}><span>⚠</span>{error}</div>}

          <button className={styles.submitBtn} type="submit" disabled={isPending || (contentType === 'Asset' && !assetId)}>
            {isPending ? 'Saving…' : 'Save Assignment'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ScreensClient({ devices: initialDevices, assets, teamSlug, teamId }: Props) {
  const [devices, setDevices] = useState<Device[]>(initialDevices)
  const [showPairModal, setShowPairModal] = useState(false)
  const [assignModalDevice, setAssignModalDevice] = useState<Device | null>(null)
  const [onlineDeviceIds, setOnlineDeviceIds] = useState<Set<string>>(new Set())
  
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  // Persistent presence channel ref
  const teamChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDevices(initialDevices)
  }, [initialDevices])

  // ── Persistent presence channel ────────────────────────────────────────
  useEffect(() => {
    if (!teamId) return

    const channel = supabase
      .channel(`team-status:${teamId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ device_id: string }>()
        const ids = new Set(
          Object.values(state)
            .flat()
            .map((p) => p.device_id)
            .filter(Boolean)
        )
        setOnlineDeviceIds(ids)
        console.log('[Dashboard] Presence sync — online devices:', [...ids])
      })
      .on('presence', { event: 'join' }, ({ newPresences }: { newPresences: Array<{ device_id: string }> }) => {
        const joined = newPresences.map((p) => p.device_id).filter(Boolean)
        setOnlineDeviceIds((prev) => {
          const next = new Set(prev)
          joined.forEach((id) => next.add(id))
          return next
        })
        console.log('[Dashboard] Presence join:', joined)
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: Array<{ device_id: string }> }) => {
        const left = leftPresences.map((p) => p.device_id).filter(Boolean)
        setOnlineDeviceIds((prev) => {
          const next = new Set(prev)
          left.forEach((id) => next.delete(id))
          return next
        })
        console.log('[Dashboard] Presence leave:', left)
      })
      .subscribe((status) => {
        console.log('[Dashboard] Presence channel status:', status)
      })

    teamChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      teamChannelRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  // ── Postgres Changes for device list (INSERT/UPDATE/DELETE) ───────────
  useEffect(() => {
    if (!teamId) return

    const channel = supabase
      .channel('screens-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setDevices((prev) => [payload.new as Device, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setDevices((prev) =>
              prev.map((d) => (d.id === payload.new.id ? { ...d, ...payload.new } as Device : d))
            )
          } else if (payload.eventType === 'DELETE') {
            setDevices((prev) => prev.filter((d) => d.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  // ── Polling fallback (Heartbeat check) ────────────────────────────────
  useEffect(() => {
    if (!teamId) return

    // Every 30 seconds, fetch the latest device states
    const intervalId = setInterval(async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*, device_heartbeats(last_seen_at)')
        .eq('team_id', teamId)
      
      if (!error && data) {
        // We do a functional update to avoid race conditions with Realtime,
        // though Realtime is also updating this state. This ensures we have 
        // a reliable heartbeat check if Realtime drops.
        const mapped = data.map((d: any) => ({
          ...d,
          last_seen_at: d.device_heartbeats?.last_seen_at || null,
          device_heartbeats: undefined
        })) as Device[]
        setDevices(mapped)
      }
    }, 30000) // 30s

    return () => clearInterval(intervalId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  useEffect(() => {
    const handleClick = () => setOpenMenuId(null)
    if (openMenuId) document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openMenuId])

  function handlePairSuccess() {
    setShowPairModal(false)
    router.refresh()
  }

  function handleAssignSuccess() {
    setAssignModalDevice(null)
    router.refresh()
  }

  async function handleDeleteDevice(deviceId: string) {
    if (confirm('Are you sure you want to unpair and delete this screen? The physical screen will automatically reset to pairing mode.')) {
      await deleteAndUnpairDevice(teamSlug, deviceId)
      setOpenMenuId(null)
    }
  }

  // ── Derive live status for each device ────────────────────────────────
  function getLiveStatus(device: Device): LiveStatus {
    if (device.status === 'pairing') return 'pairing'
    
    // Consider online if tracked via Presence OR if last_seen_at is recent (within ~60 seconds).
    // The player sends a heartbeat every 30s, so 60s allows for 1 missed heartbeat.
    const now = new Date().getTime()
    const isRecentlySeen = device.last_seen_at && (now - new Date(device.last_seen_at).getTime() < 60000)
    
    return (onlineDeviceIds.has(device.id) || isRecentlySeen) ? 'online' : 'offline'
  }

  const filteredDevices = devices.filter(d => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (d.name?.toLowerCase().includes(q) || d.status.includes(q))
  })

  return (
    <>
      <div className={styles.addBtnWrapper}>
        <button
          id="add-screen-btn"
          className={styles.addBtn}
          onClick={() => setShowPairModal(true)}
        >
          <span className={styles.addBtnIcon}>+</span>
          Add Screen
        </button>
      </div>

      <div className={styles.controlsBar}>
        <div className={styles.searchBox}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input 
            type="text" 
            className={styles.searchInput}
            placeholder="Search screens by name or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className={styles.viewToggleGroup}>
          <button 
            className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.active : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </button>
          <button 
            className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
            onClick={() => setViewMode('table')}
            title="Table View"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>
      </div>

      {filteredDevices.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>◫</div>
          <h3 className={styles.emptyTitle}>No screens found</h3>
          <p className={styles.emptyText}>
            {devices.length === 0 
              ? <>Open the NuExis player app on a screen, then click <strong>Add Screen</strong> to pair it to your workspace.</>
              : "No screens matched your search criteria."
            }
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className={styles.grid}>
          {filteredDevices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              liveStatus={getLiveStatus(device)}
              onEdit={() => setAssignModalDevice(device)}
              onDelete={() => handleDeleteDevice(device.id)}
              menuOpen={openMenuId === device.id}
              onToggleMenu={(e) => {
                e.stopPropagation();
                setOpenMenuId(openMenuId === device.id ? null : device.id);
              }}
            />
          ))}
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.screensTable}>
            <thead className={styles.tableHeader}>
              <tr>
                <th>Screen Name</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map(device => {
                const status = getLiveStatus(device)
                const lastSeen = formatLastSeen(device.last_seen_at, status === 'online')
                const isMenuOpen = openMenuId === device.id

                return (
                  <tr key={device.id} className={styles.tableRow}>
                    <td className={styles.tableCell}>
                      <div className={styles.cellName}>{device.name || 'Unnamed Screen'}</div>
                      <div className={styles.cellId}>{device.id.slice(0,8)}...</div>
                    </td>
                    <td className={styles.tableCell}>
                      <StatusBadge status={status} />
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.cellLastSeen}>{lastSeen}</div>
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.actionsGroup}>
                        <button className={styles.editBtn} onClick={() => setAssignModalDevice(device)}>Edit</button>
                        <div className={styles.moreMenuWrapper}>
                          <button 
                            className={`${styles.moreBtn} ${isMenuOpen ? styles.active : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(isMenuOpen ? null : device.id)
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                            </svg>
                          </button>
                          {isMenuOpen && (
                            <div className={styles.moreDropdown}>
                              <button className={`${styles.dropdownItem} ${styles.danger}`} onClick={() => handleDeleteDevice(device.id)}>
                                Unpair & Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

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
          teamSlug={teamSlug}
          onClose={() => setAssignModalDevice(null)}
          onSuccess={handleAssignSuccess}
        />
      )}
    </>
  )
}
