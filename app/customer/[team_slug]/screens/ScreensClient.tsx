'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateDeviceLastSeen } from './actions'
import styles from './screens.module.css'

import { Device, Asset, Playlist, LiveStatus } from './types'
import { DeviceCard } from './DeviceCard'
import { DeviceTableRow } from './DeviceTableRow'
import { PairModal } from './PairModal'
import { AssignModal } from './AssignModal'
import { DeleteModal } from './DeleteModal'
import { RenameModal } from './RenameModal'
import { FilterSidebar } from './FilterSidebar'
import { StatsGrid } from './StatsGrid'
import { ScreenPreviewModal } from './ScreenPreviewModal'

const RELATIVE_TIME_TICK_MS = 15 * 1000
const DEVICE_SELECT_FIELDS =
  'id, name, status, created_at, content_type, asset_id, playlist_id, orientation, last_seen_at, total_playtime_seconds'

const mapDevice = (d: any): Device => ({
  id: d.id,
  name: d.name,
  status: d.status,
  created_at: d.created_at,
  content_type: d.content_type,
  asset_id: d.asset_id,
  playlist_id: d.playlist_id,
  orientation: d.orientation,
  last_seen_at: d.last_seen_at || null,
  total_playtime_seconds: Number(d.total_playtime_seconds) || 0,
})

interface Props {
  devices: Device[]
  assets: Asset[]
  playlists?: Playlist[]
  teamSlug: string
  teamId: string
  totalScreens?: number
  currentPage?: number
  pageSize?: number
}

export default function ScreensClient({
  devices: initialDevices,
  assets,
  playlists = [],
  teamSlug,
  teamId,
  totalScreens = 0,
  currentPage = 1,
  pageSize = 30
}: Props) {
  const [devices, setDevices] = useState<Device[]>(initialDevices)
  const [showPairModal, setShowPairModal] = useState(false)
  const [assignModalDevice, setAssignModalDevice] = useState<Device | null>(null)
  const [deleteModalDevice, setDeleteModalDevice] = useState<Device | null>(null)
  const [renameModalDevice, setRenameModalDevice] = useState<Device | null>(null)
  const [onlineDeviceIds, setOnlineDeviceIds] = useState<Set<string>>(new Set())
  const [presenceRefreshKey, setPresenceRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showSyncToast, setShowSyncToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [showSuccessPulse, setShowSuccessPulse] = useState(false)
  const [, setNowMs] = useState(() => Date.now())
  const [isMounted, setIsMounted] = useState(false)
  const [previewState, setPreviewState] = useState<{
    device: Device
    contentType: 'Asset' | 'Playlist' | 'Schedule'
    assetId: string | null
    playlistId: string | null
    scaleMode: string
    orientation: number
  } | null>(null)
  
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('screensViewMode')
    if (saved === 'grid' || saved === 'table') {
      setViewMode(saved)
    }
    setIsMounted(true)
  }, [])

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number, right: number } | null>(null)
  
  // Advanced Filter States
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterOrientation, setFilterOrientation] = useState<string>('all')
  const [filterDatePreset, setFilterDatePreset] = useState<string>('all')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode)
    localStorage.setItem('screensViewMode', mode)
  }

  const router = useRouter()
  const supabase = createClient()

  // Persistent presence channel ref
  const teamChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const lastRefreshRef = useRef<number>(0)

  useEffect(() => {
    setDevices(initialDevices)
  }, [initialDevices])

  useEffect(() => {
    const intervalId = setInterval(() => setNowMs(Date.now()), RELATIVE_TIME_TICK_MS)
    return () => clearInterval(intervalId)
  }, [])

  // ── Persistent presence channel ────────────────────────────────────────
  useEffect(() => {
    if (!teamId) return

    let isUnmounting = false
    let debounceTimer: NodeJS.Timeout | null = null

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
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          if (isUnmounting) return
          console.warn(`[Dashboard] Presence channel ${status}, auto-reconnecting in 3s...`)
          if (debounceTimer) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(() => {
            if (!isUnmounting) {
              setPresenceRefreshKey(prev => prev + 1)
            }
          }, 3000)
        }
      })

    teamChannelRef.current = channel

    return () => {
      isUnmounting = true
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
      if (teamChannelRef.current === channel) {
        teamChannelRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, presenceRefreshKey])

  // Handle presence shifts (side-effects for online/offline transitions)
  useEffect(() => {
    if (!isMounted || devices.length === 0) return

    const leftIds = devices
      .filter(d => getLiveStatus(d) === 'online' && !onlineDeviceIds.has(d.id))
      .map(d => d.id)

    if (leftIds.length > 0) {
      const now = new Date().toISOString()
      setDevices(prev => 
        prev.map(d => leftIds.includes(d.id) ? { ...d, status: 'offline', last_seen_at: now } : d)
      )
      updateDeviceLastSeen(teamSlug, leftIds).catch(err => 
        console.error('[Dashboard] Error updating last seen:', err)
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineDeviceIds, isMounted, teamSlug])

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

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .from('devices')
          .select(DEVICE_SELECT_FIELDS)
          .eq('team_id', teamId)
          .order('created_at', { ascending: false })
          .range(from, to)
        
        if (!error && data) {
          setDevices((data as any[]).map(mapDevice))
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  useEffect(() => {
    if (showSyncToast) {
      const timer = setTimeout(() => {
        setShowSyncToast(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [showSyncToast])

  useEffect(() => {
    const handleClick = () => {
      setOpenMenuId(null)
      setMenuPosition(null)
    }
    if (openMenuId) document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openMenuId])

  async function handleRefresh() {
    if (isRefreshing) return
    setIsRefreshing(true)

    try {
      setPresenceRefreshKey(prev => prev + 1)

      const from = (currentPage - 1) * pageSize
      const to = from + pageSize - 1

      const { data, error } = await supabase
        .from('devices')
        .select(DEVICE_SELECT_FIELDS)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (!error && data) {
        await new Promise(resolve => setTimeout(resolve, 550))
        setDevices((data as any[]).map(mapDevice))
        
        // Trigger subtle success pulse on grid/table
        setShowSuccessPulse(true)
        setTimeout(() => setShowSuccessPulse(false), 600)
        
        // Show elegant success toast
        setToastMessage('Screens synchronized successfully')
        setShowSyncToast(true)
      } else {
        setToastMessage('Failed to synchronize screens')
        setShowSyncToast(true)
      }
    } catch (err) {
      console.error('[Dashboard] Error during async refresh:', err)
      setToastMessage('Failed to synchronize screens')
      setShowSyncToast(true)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handlePairSuccess = () => { setShowPairModal(false); router.refresh(); }
  const handleAssignSuccess = () => { setAssignModalDevice(null); router.refresh(); }
  const handleDeleteSuccess = () => { setDeleteModalDevice(null); router.refresh(); }
  const handleRenameSuccess = (newName: string) => {
    setDevices(prev => prev.map(d => d.id === renameModalDevice?.id ? { ...d, name: newName } : d))
    setRenameModalDevice(null)
  }

  function getLiveStatus(device: Device): LiveStatus {
    if (device.status === 'pairing') return 'pairing'
    return onlineDeviceIds.has(device.id) ? 'online' : 'offline'
  }

  const filteredDevices = devices.filter(d => {
    const liveStatus = getLiveStatus(d)
    if (filterStatus !== 'all' && liveStatus !== filterStatus) return false
    if (filterOrientation !== 'all' && (d.orientation ?? 0).toString() !== filterOrientation) return false
    if (filterDatePreset !== 'all') {
      const dTime = new Date(d.created_at).getTime()
      const now = Date.now()
      if (filterDatePreset === 'today' && dTime < new Date().setHours(0,0,0,0)) return false
      if (filterDatePreset === '7days' && dTime < now - 7 * 86400000) return false
      if (filterDatePreset === '30days' && dTime < now - 30 * 86400000) return false
      if (filterDatePreset === 'custom') {
        if (filterStartDate && dTime < new Date(filterStartDate).getTime()) return false
        if (filterEndDate && dTime >= new Date(filterEndDate).getTime() + 86400000) return false
      }
    }
    const q = searchQuery.toLowerCase()
    return !searchQuery || d.name?.toLowerCase().includes(q) || liveStatus.includes(q) || d.status.includes(q)
  })

  const onlineCount = devices.filter(d => getLiveStatus(d) === 'online').length;
  const offlineCount = devices.length - onlineCount;
  const totalPlaytimeSeconds = devices.reduce((acc, d) => acc + (Number(d.total_playtime_seconds) || 0), 0);

  const totalPages = Math.ceil(totalScreens / pageSize)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalScreens)

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.pageTitle}>Screens</h1>
          <p className={styles.pageSubtitle}>
            Manage and monitor your workspace screens
          </p>
        </div>
        <div className={styles.topbarActions}>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh Status"
            title="Refresh Status"
          >
            <RefreshCw size={20} className={isRefreshing ? styles.spin : ''} />
          </button>
          <button
            id="add-screen-btn"
            className={styles.addBtn}
            onClick={() => setShowPairModal(true)}
          >
            <Plus className={styles.addBtnIcon} size={18} />
            Add Screen
          </button>
        </div>
      </div>

      <div className={styles.pageLayout}>
        <div className={`${styles.mainContent} ${isFilterSidebarOpen ? styles.sidebarOpen : ''}`}>

          <StatsGrid
            totalScreens={devices.length}
            onlineCount={onlineCount}
            offlineCount={offlineCount}
            totalPlaytimeSeconds={totalPlaytimeSeconds}
          />

          <div className={styles.mainBlockContainer}>
            <div className={styles.controlsBar}>
              <div className={styles.searchBox}>
                <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input 
                  type="text" 
                  className={styles.searchInput}
                  placeholder="Search by name or status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className={styles.controlsRight}>
                <button 
                  className={`${styles.filterBtn} ${isFilterSidebarOpen || filterStatus !== 'all' || filterOrientation !== 'all' || filterDatePreset !== 'all' ? styles.active : ''}`}
                  onClick={() => setIsFilterSidebarOpen(!isFilterSidebarOpen)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                  </svg>
                  Filters
                  {(filterStatus !== 'all' || filterOrientation !== 'all' || filterDatePreset !== 'all') && (
                    <span className={styles.filterDot} />
                  )}
                </button>
                {isMounted && (
                  <div className={styles.viewToggleGroup}>
                    <button 
                      className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
                      onClick={() => handleSetViewMode('table')}
                      title="Table View"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                      </svg>
                    </button>
                    <button 
                      className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                      onClick={() => handleSetViewMode('grid')}
                      title="Grid View"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" rx="1" ry="1"></rect>
                        <rect x="14" y="3" width="7" height="7" rx="1" ry="1"></rect>
                        <rect x="14" y="14" width="7" height="7" rx="1" ry="1"></rect>
                        <rect x="3" y="14" width="7" height="7" rx="1" ry="1"></rect>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className={`${styles.progressBarWrapper} ${isRefreshing ? styles.active : ''}`}>
              <div className={styles.progressBarLine} />
            </div>

            {!isMounted ? (
              <div className={styles.grid} style={{ opacity: 0 }}>
                <div style={{ height: '300px' }} />
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>NX</div>
                <h3 className={styles.emptyTitle}>No screens found</h3>
                <p className={styles.emptyText}>
                  {devices.length === 0 
                    ? <>Open the NuExis player app on a screen, then click <strong>Add Screen</strong> to pair it to your workspace.</>
                    : "No screens matched your search criteria."
                  }
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className={`${styles.grid} ${showSuccessPulse ? styles.successPulse : ''}`}>
                {filteredDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    liveStatus={getLiveStatus(device)}
                    onEdit={() => setAssignModalDevice(device)}
                    onDelete={() => {
                      setOpenMenuId(null);
                      setDeleteModalDevice(device);
                    }}
                    onRename={() => {
                      setOpenMenuId(null);
                      setRenameModalDevice(device);
                    }}
                    menuOpen={openMenuId === device.id}
                    onToggleMenu={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === device.id ? null : device.id);
                    }}
                    assets={assets}
                    playlists={playlists}
                  />
                ))}
              </div>
            ) : (
              <div className={`${styles.tableContainer} ${showSuccessPulse ? styles.successPulse : ''}`}>
                <table className={styles.screensTable}>
                  <thead className={styles.tableHeader}>
                    <tr>
                      <th>Screen Name</th>
                      <th>Status</th>
                      <th>Last Seen</th>
                      <th>Current Playlist</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.map(device => (
                      <DeviceTableRow
                        key={device.id}
                        device={device}
                        liveStatus={getLiveStatus(device)}
                        assets={assets}
                        playlists={playlists}
                        openMenuId={openMenuId}
                        menuPosition={menuPosition}
                        setOpenMenuId={setOpenMenuId}
                        setMenuPosition={setMenuPosition}
                        onEdit={() => setAssignModalDevice(device)}
                        onRename={() => {
                          setOpenMenuId(null);
                          setRenameModalDevice(device);
                        }}
                        onDelete={() => {
                          setOpenMenuId(null);
                          setDeleteModalDevice(device);
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {devices.length > 0 && (
              <div className={styles.tableFooter}>
                <div>
                  {searchQuery 
                    ? `Showing ${filteredDevices.length} filtered screens` 
                    : `Showing ${startItem} to ${endItem} of ${totalScreens} screens`
                  }
                </div>
                {!searchQuery && (
                  <div className={styles.pagination}>
                    <button 
                      className={styles.pageBtn} 
                      onClick={() => router.push(`?page=${currentPage - 1}`)}
                      disabled={!hasPrevPage}
                      style={{ opacity: hasPrevPage ? 1 : 0.5, cursor: hasPrevPage ? 'pointer' : 'not-allowed' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                      </svg>
                    </button>
                    <button className={`${styles.pageBtn} ${styles.active}`}>{currentPage}</button>
                    <button 
                      className={styles.pageBtn} 
                      onClick={() => router.push(`?page=${currentPage + 1}`)}
                      disabled={!hasNextPage}
                      style={{ opacity: hasNextPage ? 1 : 0.5, cursor: hasNextPage ? 'pointer' : 'not-allowed' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <FilterSidebar
          isFilterSidebarOpen={isFilterSidebarOpen} setIsFilterSidebarOpen={setIsFilterSidebarOpen}
          filterStatus={filterStatus} setFilterStatus={setFilterStatus}
          filterOrientation={filterOrientation} setFilterOrientation={setFilterOrientation}
          filterDatePreset={filterDatePreset} setFilterDatePreset={setFilterDatePreset}
          filterStartDate={filterStartDate} setFilterStartDate={setFilterStartDate}
          filterEndDate={filterEndDate} setFilterEndDate={setFilterEndDate}
        />
      </div>

      {showPairModal && <PairModal teamSlug={teamSlug} onClose={() => setShowPairModal(false)} onSuccess={handlePairSuccess} />}

      {assignModalDevice && (
        <AssignModal
          device={assignModalDevice} assets={assets} playlists={playlists} teamSlug={teamSlug}
          onClose={() => setAssignModalDevice(null)} onSuccess={handleAssignSuccess}
          onPreview={(device, contentType, assetId, playlistId, scaleMode, orientation) => 
            setPreviewState({ device, contentType, assetId, playlistId, scaleMode, orientation })
          }
        />
      )}

      {deleteModalDevice && (
        <DeleteModal deviceId={deleteModalDevice.id} deviceName={deleteModalDevice.name || 'Unnamed Screen'} teamSlug={teamSlug} onClose={() => setDeleteModalDevice(null)} onSuccess={handleDeleteSuccess} />
      )}

      {renameModalDevice && (
        <RenameModal currentName={renameModalDevice.name || 'Unnamed Screen'} teamSlug={teamSlug} deviceId={renameModalDevice.id} onClose={() => setRenameModalDevice(null)} onSuccess={handleRenameSuccess} />
      )}

      {previewState && (
        <ScreenPreviewModal
          device={previewState.device} teamSlug={teamSlug} onClose={() => setPreviewState(null)}
          contentType={previewState.contentType} assetId={previewState.assetId} playlistId={previewState.playlistId}
          scaleMode={previewState.scaleMode} orientation={previewState.orientation} assets={assets} playlists={playlists}
        />
      )}

      {showSyncToast && (
        <div className={`${styles.toastContainer} ${showSyncToast ? styles.toastShow : ''}`}>
          <div className={styles.toastContent}>
            <svg className={styles.toastIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className={styles.toastMessage}>{toastMessage}</span>
          </div>
        </div>
      )}
    </>
  )
}
