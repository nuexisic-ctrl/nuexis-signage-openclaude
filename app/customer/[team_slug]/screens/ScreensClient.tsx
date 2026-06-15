'use client'

import { useState, useRef, useEffect, useTransition, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Plus, RefreshCw, ChevronLeft, ChevronRight, FolderPlus, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { GroupFilterDropdown } from './GroupFilterDropdown'
import styles from './screens.module.css'

import { Device, Asset, Playlist, LiveStatus } from './types'
import { DeviceCard } from './DeviceCard'
import { DeviceTableRow } from './DeviceTableRow'
import { PairModal } from './PairModal'
import { AssignModal } from './AssignModal'
import { DeleteModal } from './DeleteModal'
import { RenameModal } from './RenameModal'
import { FilterSidebar } from './FilterSidebar'
import { ScreenPreviewModal } from './ScreenPreviewModal'
import { DeviceTable } from './DeviceTable'
import { ScreensModals } from './ScreensModals'
import { useDevicePresence } from './useDevicePresence'
import { deleteGroup } from '../groups/actions'
import { SelectedActions } from './SelectedActions'
import { GroupsSection } from './GroupsSection'
import { toast } from '@/app/components/Toast'


// Tick relative timestamps every 60s — "5 mins ago" accuracy doesn't need faster updates
// (was 15s which caused 4 full re-renders/min of the device list for no user-visible benefit)
const RELATIVE_TIME_TICK_MS = 60 * 1000
const DEVICE_SELECT_FIELDS =
  'id, name, status, created_at, content_type, asset_id, playlist_id, orientation, last_seen_at, total_playtime_seconds, scale_mode, app_version, os_version'

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
  app_version: d.app_version || null,
  os_version: d.os_version || null,
  scale_mode: d.scale_mode || null,
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
  initialViewMode?: 'grid' | 'table'
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
  initialViewMode = 'table',
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
  
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(initialViewMode)
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
    if (saved && (saved === 'grid' || saved === 'table')) {
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
  
  // Sort States
  const [sortBy, setSortBy] = useState<string>('created-desc')
  const [isSortOpen, setIsSortOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterStatus, filterOrientation, filterDatePreset, filterGroupIds, sortBy])

  useEffect(() => {
    if (!isSortOpen) return
    const handleOutsideClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setIsSortOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isSortOpen])

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode)
    localStorage.setItem('screensViewMode', mode)
    document.cookie = `screens_view_mode=${mode}; path=/; max-age=31536000; SameSite=Lax`
  }

  const supabase = createClient()



  useEffect(() => {
    const handleClick = () => {
      setOpenMenuId(null)
      setMenuPosition(null)
    }
    if (openMenuId) document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openMenuId])

  // Click away to clear selected devices
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (selectedDeviceIds.size === 0) return

      const target = e.target as HTMLElement

      // If clicking interactive elements, do not clear
      if (
        target.closest('button') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('a') ||
        target.closest('[role="button"]') ||
        target.closest('[role="dialog"]') ||
        target.closest('[class*="dropdown"]') ||
        target.closest('[class*="menu"]') ||
        target.closest('[class*="modal"]') ||
        target.closest('[class*="select"]') ||
        target.closest('[class*="deviceCard"]') ||
        target.closest('[class*="card"]') ||
        target.closest('tr')
      ) {
        return
      }

      setSelectedDeviceIds(new Set())
    }

    document.addEventListener('click', handleGlobalClick)
    return () => document.removeEventListener('click', handleGlobalClick)
  }, [selectedDeviceIds])

  async function handleRefresh() {
    if (isRefreshing) return
    setIsRefreshing(true)

    try {
      // Do not increment presenceRefreshKey on every manual refresh - it's disruptive 
      // as it tears down the presence channel and re-subscribes.
      // setPresenceRefreshKey(prev => prev + 1)

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

  const filteredDevices = useMemo(() => {
    const filtered = devices.filter(d => {
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

    // Sort based on selected sortBy option
    return filtered.sort((a, b) => {
      if (sortBy === 'name-asc') {
        const nameA = a.name || ''
        const nameB = b.name || ''
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
      }
      if (sortBy === 'name-desc') {
        const nameA = a.name || ''
        const nameB = b.name || ''
        return nameB.localeCompare(nameA, undefined, { sensitivity: 'base' })
      }
      if (sortBy === 'created-asc' || sortBy === 'updated-asc') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      // Default: created-desc or updated-desc (Newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [devices, filterStatus, filterOrientation, filterGroupIds, filterDatePreset, filterStartDate, filterEndDate, searchQuery, sortBy, memberships, onlineDeviceIds])
  const totalPages = Math.ceil(filteredDevices.length / pageSize) || 1
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1
  const startItem = filteredDevices.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, filteredDevices.length)

  // Navigate to a new page — update local state and localStorage
  const navigatePage = (page: number, limit: number) => {
    setPageSize(limit)
    setCurrentPage(page)
    localStorage.setItem('nuexis_screens_per_page', String(limit))
  }

  const paginatedDevices = useMemo(() => {
    const from = (currentPage - 1) * pageSize
    return filteredDevices.slice(from, from + pageSize)
  }, [filteredDevices, currentPage, pageSize])

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

          {groups && groups.length > 0 && (
            <GroupsSection
              groups={groups}
              devices={devices}
              memberships={memberships}
              assets={assets}
              playlists={playlists}
              teamSlug={teamSlug}
              onlineDeviceIds={onlineDeviceIds}
              onSelectGroup={(g) => setEditGroup(g)}
              onDeleteGroup={handleDeleteGroup}
              isRefreshing={isRefreshing}
              showSuccessPulse={showSuccessPulse}
            />
          )}

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
                {selectedDeviceIds.size > 0 && (
                  <SelectedActions
                    selectedDeviceIds={selectedDeviceIds}
                    setSelectedDeviceIds={setSelectedDeviceIds}
                    setShowCreateGroupFromSelection={setShowCreateGroupFromSelection}
                    setDeleteModalDevice={setDeleteModalDevice}
                  />
                )}
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
                <div className={styles.sortContainer} ref={sortRef}>
                  <button 
                    className={`${styles.sortBtn} ${isSortOpen ? styles.sortBtnActive : ''}`}
                    onClick={() => setIsSortOpen(!isSortOpen)}
                    title="Sort"
                    aria-label="Sort"
                    type="button"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="3" y1="6" x2="14" y2="6" />
                      <line x1="3" y1="12" x2="11" y2="12" />
                      <line x1="3" y1="18" x2="13" y2="18" />
                      <path d="M19 6v12M16 15l3 3 3-3" />
                    </svg>
                  </button>
                  {isSortOpen && (
                    <div className={styles.sortDropdownMenu} role="menu">
                      {[
                        { value: 'updated-desc', label: 'Updated Date (Newest)' },
                        { value: 'updated-asc', label: 'Updated Date (Oldest)' },
                        { value: 'created-desc', label: 'Created Date (Newest)' },
                        { value: 'created-asc', label: 'Created Date (Oldest)' },
                        { value: 'name-asc', label: 'Name (A-Z)' },
                        { value: 'name-desc', label: 'Name (Z-A)' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          className={`${styles.sortDropdownItem} ${sortBy === option.value ? styles.sortDropdownItemActive : ''}`}
                          onClick={() => {
                            setSortBy(option.value)
                            setIsSortOpen(false)
                          }}
                          role="menuitem"
                          type="button"
                        >
                          {option.label}
                          {sortBy === option.value && (
                            <Check className={styles.sortCheckIcon} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
              </div>
            </div>

            <div className={`${styles.progressBarWrapper} ${isRefreshing ? styles.active : ''}`}>
              <div className={styles.progressBarLine} />
            </div>

            {!isMounted ? (
              <div style={{ padding: '0 16px' }}>
                {[1, 2, 3, 4, 5].map((row) => (
                  <div key={row} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '18px 0',
                    borderBottom: '1px solid var(--outline-variant)',
                    gap: '16px'
                  }}>
                    <div className="skeleton" style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 2 }}>
                      <div className="skeleton" style={{ width: '160px', height: '16px' }} />
                      <div className="skeleton" style={{ width: '80px', height: '10px' }} />
                    </div>
                    <div className="skeleton" style={{ width: '80px', height: '16px', flex: 1 }} />
                    <div className="skeleton" style={{ width: '100px', height: '16px', flex: 1 }} />
                    <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '8px', marginLeft: 'auto' }} />
                  </div>
                ))}
              </div>
            ) : filteredDevices.length === 0 ? (
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
