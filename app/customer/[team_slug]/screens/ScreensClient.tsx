'use client'

import { useState, useRef, useEffect, useTransition, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Plus, RefreshCw, ChevronLeft, ChevronRight, FolderPlus, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { GroupFilterDropdown } from './GroupFilterDropdown'
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
import { DeviceTable } from './DeviceTable'
import { ScreensModals } from './ScreensModals'
import { useDevicePresence } from './useDevicePresence'
import { deleteGroup } from '../groups/actions'
import { SelectedActions } from './SelectedActions'
import { toast } from '@/app/components/Toast'


// Tick relative timestamps every 60s — "5 mins ago" accuracy doesn't need faster updates
// (was 15s which caused 4 full re-renders/min of the device list for no user-visible benefit)
const RELATIVE_TIME_TICK_MS = 60 * 1000
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
  groups?: any[]
  memberships?: any[]
  teamSlug: string
  teamId: string
  totalScreens?: number
  currentPage?: number
  pageSize?: number
  historicalPlaytime?: number
}

export default function ScreensClient({
  devices: initialDevices,
  assets,
  playlists = [],
  groups: initialGroups = [],
  memberships: initialMemberships = [],
  teamSlug,
  teamId,
  historicalPlaytime = 0,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(10)

  useEffect(() => {
    const savedLimit = localStorage.getItem('nuexis_screens_per_page')
    if (savedLimit) {
      setPageSize(Number(savedLimit) || 10)
    }
  }, [])

  const [showPairModal, setShowPairModal] = useState(false)
  const [assignModalDevice, setAssignModalDevice] = useState<Device | null>(null)
  const [deleteModalDevice, setDeleteModalDevice] = useState<Device | null>(null)
  const [renameModalDevice, setRenameModalDevice] = useState<Device | null>(null)

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showSelectionDropdown, setShowSelectionDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [sortOption, setSortOption] = useState<string>('updated_newest')
  const [showSuccessPulse, setShowSuccessPulse] = useState(false)
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
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set())
  const [filterGroupIds, setFilterGroupIds] = useState<string[]>([])
  const [showCreateGroupFromSelection, setShowCreateGroupFromSelection] = useState(false)

  const [groups, setGroups] = useState<any[]>(initialGroups)
  const [memberships, setMemberships] = useState<any[]>(initialMemberships)
  const [editGroup, setEditGroup] = useState<any | null>(null)
  const [historicalPlaytimeState, setHistoricalPlaytimeState] = useState(historicalPlaytime)


  // Use Custom Hook for device presence & fallback polling
  const {
    devices,
    setDevices,
    onlineDeviceIds,
    setPresenceRefreshKey,
    hasSyncedPresence,
    mapDevice
  } = useDevicePresence(
    initialDevices,
    teamId,
    teamSlug,
    isRefreshing,
    router
  )

  useEffect(() => {
    const saved = localStorage.getItem('screensViewMode')
    if (saved === 'grid' || saved === 'table') {
      setViewMode(saved)
    }
    // Restore saved group filter — must be done client-side only to avoid hydration mismatch
    try {
      const savedGroups = localStorage.getItem('filterGroupIds')
      if (savedGroups) {
        const parsed = JSON.parse(savedGroups)
        if (Array.isArray(parsed) && parsed.length > 0) setFilterGroupIds(parsed)
      }
    } catch {}
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setGroups(initialGroups)
    setMemberships(initialMemberships)
  }, [initialGroups, initialMemberships])

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number, right: number } | null>(null)
  
  // Advanced Filter States
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterOrientation, setFilterOrientation] = useState<string>('all')
  const [filterDatePreset, setFilterDatePreset] = useState<string>('custom')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterStatus, filterOrientation, filterDatePreset, filterGroupIds])

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode)
    localStorage.setItem('screensViewMode', mode)
  }

  const supabase = createClient()

  // ── Postgres changes realtime subscription for assets ────────────────
  useEffect(() => {
    if (!teamId) return

    const channel = supabase
      .channel('assets-realtime-screens')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assets', filter: `team_id=eq.${teamId}` }, 
        async () => {
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [teamId, router, supabase])

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

      const [devicesRes, groupsRes, membershipsRes, teamRes] = await Promise.all([
        supabase
          .from('devices')
          .select(DEVICE_SELECT_FIELDS)
          .eq('team_id', teamId)
          .order('created_at', { ascending: false })
          .range(from, to),
        supabase
          .from('screen_groups')
          .select('*')
          .eq('team_id', teamId)
          .order('name', { ascending: true }),
        supabase
          .from('screen_group_members')
          .select('group_id, device_id, is_primary')
          .eq('team_id', teamId),
        supabase
          .from('teams')
          .select('historical_playtime_seconds')
          .eq('id', teamId)
          .single()
      ])

      if (!devicesRes.error && devicesRes.data) {
        await new Promise(resolve => setTimeout(resolve, 550))
        setDevices((devicesRes.data as any[]).map(mapDevice))
      }

      if (!groupsRes.error && groupsRes.data) {
        setGroups(groupsRes.data)
      }

      if (!membershipsRes.error && membershipsRes.data) {
        setMemberships(membershipsRes.data)
      }

      if (teamRes && !teamRes.error && teamRes.data) {
        setHistoricalPlaytimeState(Number(teamRes.data.historical_playtime_seconds) || 0)
      }

      if (!devicesRes.error && devicesRes.data) {
        // Trigger subtle success pulse on grid/table
        setShowSuccessPulse(true)
        setTimeout(() => setShowSuccessPulse(false), 600)
      }
    } catch (err) {
      console.error('[Dashboard] Error during async refresh:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handlePairSuccess = () => { setShowPairModal(false); router.refresh(); }
  const handleAssignSuccess = () => { setAssignModalDevice(null); router.refresh(); }
  const handleDeleteSuccess = () => {
    setDeleteModalDevice(null)
    setSelectedDeviceIds(new Set())
    router.refresh()
  }
  const handleRenameSuccess = (newName: string) => {
    setDevices(prev => prev.map(d => d.id === renameModalDevice?.id ? { ...d, name: newName } : d))
    setRenameModalDevice(null)
  }

  const handleDeleteGroup = (group: any) => {
    if (window.confirm(`Are you sure you want to delete the group "${group.name}"?`)) {
      startTransition(async () => {
        const res = await deleteGroup(teamSlug, group.id)
        if (res.success) {
          toast.success(`Group "${group.name}" deleted successfully`)
          router.refresh()
        } else {
          toast.error(res.error || 'Failed to delete group.')
        }
      })
    }
  }


  const handleToggleSelect = (deviceId: string) => {
    setSelectedDeviceIds(prev => {
      const next = new Set(prev)
      if (next.has(deviceId)) {
        next.delete(deviceId)
      } else {
        next.add(deviceId)
      }
      return next
    })
  }

  const handleGroupBadgeClick = (groupId: string) => {
    const nextIds = [groupId]
    setFilterGroupIds(nextIds)
    localStorage.setItem('filterGroupIds', JSON.stringify(nextIds))
  }

  function getLiveStatus(device: Device): LiveStatus {
    if (device.status === 'pairing') return 'pairing'
    return onlineDeviceIds.has(device.id) ? 'online' : 'offline'
  }

  const filteredDevices = devices.filter(d => {
    const liveStatus = getLiveStatus(d)
    if (filterStatus !== 'all' && liveStatus !== filterStatus) return false
    if (filterOrientation !== 'all' && (d.orientation ?? 0).toString() !== filterOrientation) return false
    if (filterGroupIds.length > 0) {
      const isMember = memberships.some(m => filterGroupIds.includes(m.group_id) && m.device_id === d.id)
      if (!isMember) return false
    }
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

  const sortedDevices = useMemo(() => {
    return [...filteredDevices].sort((a, b) => {
      switch (sortOption) {
        case 'updated_newest':
          // Using last_seen_at or created_at as proxy
          return new Date(b.last_seen_at || b.created_at).getTime() - new Date(a.last_seen_at || a.created_at).getTime()
        case 'updated_oldest':
          return new Date(a.last_seen_at || a.created_at).getTime() - new Date(b.last_seen_at || b.created_at).getTime()
        case 'created_newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'created_oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'name_az':
          return (a.name || '').localeCompare(b.name || '')
        case 'name_za':
          return (b.name || '').localeCompare(a.name || '')
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
  }, [filteredDevices, sortOption])

  const onlineCount = devices.filter(d => getLiveStatus(d) === 'online').length;
  const offlineCount = devices.length - onlineCount;
  const totalPlaytimeSeconds = historicalPlaytimeState + devices.reduce((acc, d) => acc + (Number(d.total_playtime_seconds) || 0), 0);

  const totalPages = Math.ceil(sortedDevices.length / pageSize) || 1
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1
  const startItem = sortedDevices.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, sortedDevices.length)

  // Navigate to a new page — update local state and localStorage
  const navigatePage = (page: number, limit: number) => {
    setPageSize(limit)
    setCurrentPage(page)
    localStorage.setItem('nuexis_screens_per_page', String(limit))
  }

  const paginatedDevices = useMemo(() => {
    const from = (currentPage - 1) * pageSize
    return sortedDevices.slice(from, from + pageSize)
  }, [sortedDevices, currentPage, pageSize])

  const hasActiveFilters = 
    filterStatus !== 'all' ||
    filterOrientation !== 'all' ||
    (filterDatePreset !== 'all' && (filterDatePreset !== 'custom' || filterStartDate !== '' || filterEndDate !== '')) ||
    filterGroupIds.length > 0

  return (
    <>
      <div className={`${styles.topbar} ${isFilterSidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.headerTitleRow}>
          <div className={styles.titleContainer}>
            <h1 className={styles.pageTitle}>Screens</h1>
            <button
              className={styles.headerRefreshBtn}
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh Status"
              title="Refresh Status"
              type="button"
            >
              <RefreshCw size={16} className={isRefreshing ? styles.spin : ''} />
            </button>
          </div>
          <p className={styles.pageSubtitle}>
            Manage and monitor your workspace screens
          </p>
        </div>
        <div className={styles.topbarActions}>
          <button
            type="button"
            className={styles.topbarActionBtn}
            onClick={() => setShowCreateGroupFromSelection(true)}
          >
            <FolderPlus size={16} />
            New Group
          </button>
          <button
            id="add-screen-btn"
            type="button"
            className={`${styles.topbarActionBtn} ${styles.topbarPrimaryBtn}`}
            onClick={() => setShowPairModal(true)}
          >
            <Plus size={16} />
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
              {/* Selection checkbox + dropdown — left side */}
              <div className={styles.selectionDropdownWrapper}>
                <div className={styles.selectionCheckboxGroup}>
                  <input
                    type="checkbox"
                    id="screen-select-all-header"
                    className={styles.selectionCheckboxInput}
                    checked={filteredDevices.length > 0 && filteredDevices.every(d => selectedDeviceIds.has(d.id))}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate = selectedDeviceIds.size > 0 && !filteredDevices.every(d => selectedDeviceIds.has(d.id))
                      }
                    }}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDeviceIds(new Set(filteredDevices.map(d => d.id)))
                      } else {
                        setSelectedDeviceIds(new Set())
                      }
                    }}
                    aria-label="Select all items"
                  />
                  <button
                    type="button"
                    className={styles.selectionDropdownArrow}
                    onClick={() => setShowSelectionDropdown(v => !v)}
                    aria-label="Selection options"
                    aria-expanded={showSelectionDropdown}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
                {showSelectionDropdown && (
                  <>
                    <div
                      className={styles.selectionDropdownBackdrop}
                      onClick={() => setShowSelectionDropdown(false)}
                    />
                    <div className={styles.selectionDropdownMenu}>
                      <button
                        type="button"
                        className={`${styles.selectionDropdownItem} ${filterStatus === 'all' && selectedDeviceIds.size === filteredDevices.length && filteredDevices.length > 0 ? styles.selectionDropdownItemActive : ''}`}
                        onClick={() => {
                          setFilterStatus('all')
                          setSelectedDeviceIds(new Set(filteredDevices.map(d => d.id)))
                          setShowSelectionDropdown(false)
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><polyline points="9 11 12 14 22 4" /></svg>
                        All ({filteredDevices.length})
                      </button>
                      <button
                        type="button"
                        className={`${styles.selectionDropdownItem} ${filterStatus === 'online' ? styles.selectionDropdownItemActive : ''}`}
                        onClick={() => {
                          setFilterStatus('online')
                          setSelectedDeviceIds(new Set())
                          setShowSelectionDropdown(false)
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                        Online Only
                      </button>
                      <button
                        type="button"
                        className={`${styles.selectionDropdownItem} ${filterStatus === 'offline' ? styles.selectionDropdownItemActive : ''}`}
                        onClick={() => {
                          setFilterStatus('offline')
                          setSelectedDeviceIds(new Set())
                          setShowSelectionDropdown(false)
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        Offline Only
                      </button>
                      <div className={styles.selectionDropdownDivider} />
                      <button
                        type="button"
                        className={styles.selectionDropdownItem}
                        onClick={() => {
                          setSelectedDeviceIds(new Set())
                          setFilterStatus('all')
                          setShowSelectionDropdown(false)
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        Deselect All
                      </button>
                    </div>
                  </>
                )}
              </div>

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
                {selectedDeviceIds.size > 0 && (
                  <SelectedActions
                    selectedDeviceIds={selectedDeviceIds}
                    setSelectedDeviceIds={setSelectedDeviceIds}
                    setShowCreateGroupFromSelection={setShowCreateGroupFromSelection}
                    setDeleteModalDevice={setDeleteModalDevice}
                  />
                )}
                <div className={styles.sortDropdownWrapper}>
                  <button 
                    className={styles.sortBtn}
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    type="button"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M6 12h12m-9 6h6" />
                    </svg>
                    Sort By
                  </button>
                  {showSortDropdown && (
                    <>
                      <div className={styles.selectionDropdownBackdrop} onClick={() => setShowSortDropdown(false)} />
                      <div className={styles.sortDropdownMenu}>
                        {[
                          { id: 'updated_newest', label: 'Updated Date (Newest)' },
                          { id: 'updated_oldest', label: 'Updated Date (Oldest)' },
                          { id: 'created_newest', label: 'Created Date (Newest)' },
                          { id: 'created_oldest', label: 'Created Date (Oldest)' },
                          { id: 'name_az', label: 'Name (A-Z)' },
                          { id: 'name_za', label: 'Name (Z-A)' },
                        ].map((option) => (
                          <button
                            key={option.id}
                            className={`${styles.sortDropdownItem} ${sortOption === option.id ? styles.sortDropdownItemActive : ''}`}
                            onClick={() => {
                              setSortOption(option.id)
                              setShowSortDropdown(false)
                            }}
                          >
                            {option.label}
                            {sortOption === option.id && <Check size={14} className={styles.sortCheckIcon} />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button 
                  data-filter-toggle
                  className={`${styles.filterBtn} ${isFilterSidebarOpen || hasActiveFilters ? styles.active : ''}`}
                  onClick={() => setIsFilterSidebarOpen(!isFilterSidebarOpen)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                  </svg>
                  Filters
                  {hasActiveFilters && (
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

            {filteredDevices.length === 0 ? (
              <div key="screens-empty-state-view" className={styles.emptyState}>
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
              <div key="screens-grid-layout-view" className={`${styles.grid} ${showSuccessPulse ? styles.successPulse : ''}`}>
                {paginatedDevices.map((device) => (
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
                    groups={groups}
                    memberships={memberships}
                    selected={selectedDeviceIds.has(device.id)}
                    onToggleSelect={() => handleToggleSelect(device.id)}
                    onGroupClick={handleGroupBadgeClick}
                  />
                ))}
              </div>
            ) : (
              <DeviceTable
                key="screens-table-layout-view"
                filteredDevices={paginatedDevices}
                selectedDeviceIds={selectedDeviceIds}
                setSelectedDeviceIds={setSelectedDeviceIds}
                assets={assets}
                playlists={playlists}
                openMenuId={openMenuId}
                menuPosition={menuPosition}
                setOpenMenuId={setOpenMenuId}
                setMenuPosition={setMenuPosition}
                setAssignModalDevice={setAssignModalDevice}
                setRenameModalDevice={setRenameModalDevice}
                setDeleteModalDevice={setDeleteModalDevice}
                groups={groups}
                memberships={memberships}
                handleToggleSelect={handleToggleSelect}
                handleGroupBadgeClick={handleGroupBadgeClick}
                getLiveStatus={getLiveStatus}
                showSuccessPulse={showSuccessPulse}
              />
            )}
            
            {devices.length > 0 && (
              <div className={styles.tableFooter}>
                <div className={styles.paginationInfo}>
                  {searchQuery 
                    ? `Showing ${filteredDevices.length} filtered screens` 
                    : `Showing ${startItem} to ${endItem} of ${devices.length} screens`
                  }
                </div>
                <div className={styles.footerControls}>
                  <div className={styles.perPageSelector}>
                    <span>Per page:</span>
                    <select
                      value={String(pageSize)}
                      onChange={(e) => {
                        const val = e.target.value
                        navigatePage(1, Number(val))
                      }}
                    >
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                  {!searchQuery && (
                    <div className={styles.pagination}>
                      <span className={styles.pageIndicator}>
                        Page {currentPage} of {totalPages}
                      </span>
                      <button 
                        className={styles.pageBtn} 
                        onClick={() => navigatePage(currentPage - 1, pageSize)}
                        disabled={!hasPrevPage}
                        style={{ cursor: hasPrevPage ? 'pointer' : 'not-allowed' }}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button 
                        className={styles.pageBtn} 
                        onClick={() => navigatePage(currentPage + 1, pageSize)}
                        disabled={!hasNextPage}
                        style={{ cursor: hasNextPage ? 'pointer' : 'not-allowed' }}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
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
          groups={groups}
          filterGroupIds={filterGroupIds}
          setFilterGroupIds={setFilterGroupIds}
          filteredCount={filteredDevices.length}
          totalCount={devices.length}
        />
      </div>

      <ScreensModals
        showPairModal={showPairModal}
        setShowPairModal={setShowPairModal}
        assignModalDevice={assignModalDevice}
        setAssignModalDevice={setAssignModalDevice}
        deleteModalDevice={deleteModalDevice}
        setDeleteModalDevice={setDeleteModalDevice}
        renameModalDevice={renameModalDevice}
        setRenameModalDevice={setRenameModalDevice}
        previewState={previewState}
        setPreviewState={setPreviewState}
        assets={assets}
        playlists={playlists}
        teamSlug={teamSlug}
        teamId={teamId}
        handlePairSuccess={handlePairSuccess}
        handleAssignSuccess={handleAssignSuccess}
        handleDeleteSuccess={handleDeleteSuccess}
        handleRenameSuccess={handleRenameSuccess}
        
        // Group properties and modals
        showCreateGroupFromSelection={showCreateGroupFromSelection}
        setShowCreateGroupFromSelection={setShowCreateGroupFromSelection}
        editGroup={editGroup}
        setEditGroup={setEditGroup}
        devices={devices}
        memberships={memberships}
        selectedDeviceIds={selectedDeviceIds}
        setSelectedDeviceIds={setSelectedDeviceIds}
        router={router}
      />
    </>

  )
}
