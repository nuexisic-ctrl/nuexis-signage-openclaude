'use client'

import { useState, useRef, useEffect, useTransition, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Plus, RefreshCw, ChevronLeft, ChevronRight, FolderPlus, Check, ChevronDown, Clock, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ConfirmDialog from '@/app/components/ConfirmDialog'
import { handleRangeSelection } from '@/lib/utils/selection'
import { GroupFilterDropdown } from './GroupFilterDropdown'
import { useTranslation } from '@/lib/i18n'
import { formatPlaytime } from './DeviceIcon'
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
import ErrorBoundary from '@/app/components/ErrorBoundary'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'


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
  initialFilterGroupIds?: string[]
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
  initialFilterGroupIds = [],
}: Props) {
  const { t } = useTranslation()
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
  const [lastSelectedDeviceId, setLastSelectedDeviceId] = useState<string | null>(null)
  const [filterGroupIds, setFilterGroupIds] = useState<string[]>(initialFilterGroupIds)
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<any | null>(null)

  const handleSetFilterGroupIds = (ids: string[]) => {
    setFilterGroupIds(ids)
    const params = new URLSearchParams(window.location.search)
    if (ids.length > 0) {
      params.set('groups', ids.join(','))
    } else {
      params.delete('groups')
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const [showCreateGroupFromSelection, setShowCreateGroupFromSelection] = useState(false)

  const [groups, setGroups] = useState<any[]>(initialGroups)
  const [memberships, setMemberships] = useState<any[]>(initialMemberships)
  const [editGroup, setEditGroup] = useState<any | null>(null)
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null)
  const [historicalPlaytimeState, setHistoricalPlaytimeState] = useState(historicalPlaytime)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, RELATIVE_TIME_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  // Use Custom Hook for device presence & fallback polling
  const {
    devices,
    setDevices,
    onlineDeviceIds,
    setPresenceRefreshKey,
    hasSyncedPresence,
    channelStatus,
    mapDevice
  } = useDevicePresence(
    initialDevices,
    teamId,
    teamSlug,
    isRefreshing,
    router
  )

  const [showConnectionError, setShowConnectionError] = useState(false)

  useEffect(() => {
    const isErrorStatus = channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT' || channelStatus === 'CLOSED'
    
    if (isErrorStatus) {
      const timer = setTimeout(() => {
        setShowConnectionError(true)
      }, 2000)
      return () => clearTimeout(timer)
    } else {
      setShowConnectionError(false)
    }
  }, [channelStatus])

  useEffect(() => {
    const saved = localStorage.getItem('screensViewMode')
    if (saved && (saved === 'grid' || saved === 'table')) {
      setViewMode(saved)
    }
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

  // Selection Dropdown States
  const [isSelectDropdownOpen, setIsSelectDropdownOpen] = useState(false)
  const selectDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (selectDropdownRef.current && !selectDropdownRef.current.contains(e.target as Node)) {
        setIsSelectDropdownOpen(false)
      }
    }
    if (isSelectDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isSelectDropdownOpen])

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

  const handlePairSuccess = async (deviceId: string) => {
    setShowPairModal(false)
    router.refresh()
    if (!deviceId) return
    try {
      const { data, error } = await supabase
        .from('devices')
        .select(DEVICE_SELECT_FIELDS)
        .eq('id', deviceId)
        .single()
      if (error) {
        console.error('[handlePairSuccess] Error fetching newly paired device:', error)
        return
      }
      if (data) {
        setAssignModalDevice(mapDevice(data))
      }
    } catch (err) {
      console.error('[handlePairSuccess] Error:', err)
    }
  }
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

  const handleCreateGroupSuccess = (groupId: string) => {
    setShowCreateGroupFromSelection(false)
    setSelectedDeviceIds(new Set())
    setHighlightedGroupId(groupId)
    router.refresh()
    setTimeout(() => {
      setHighlightedGroupId(null)
    }, 4000)
  }

  const handleDeleteGroup = (group: any) => {
    setDeleteGroupTarget(group)
  }

  const handleConfirmDeleteGroup = () => {
    if (!deleteGroupTarget) return
    const group = deleteGroupTarget
    startTransition(async () => {
      const res = await deleteGroup(teamSlug, group.id)
      if (res.success) {
        toast.success(`Group "${group.name}" deleted successfully`)
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to delete group.')
      }
      setDeleteGroupTarget(null)
    })
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
    setLastSelectedDeviceId(deviceId)
  }

  const handleDeviceDoubleClick = (device: Device) => {
    setAssignModalDevice(device)
  }

  const handleDeviceClick = (e: React.MouseEvent, deviceId: string) => {
    setSelectedDeviceIds(prev => {
      const { nextSelectedIds, nextLastSelectedId } = handleRangeSelection(
        e,
        deviceId,
        lastSelectedDeviceId,
        paginatedDevices,
        prev
      )
      setLastSelectedDeviceId(nextLastSelectedId)
      return nextSelectedIds
    })
  }

  const handleGroupBadgeClick = (groupId: string) => {
    handleSetFilterGroupIds([groupId])
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

  const onlineCount = devices.filter(d => getLiveStatus(d) === 'online').length;
  const offlineCount = devices.length - onlineCount;
  const totalPlaytimeSeconds = historicalPlaytimeState + devices.reduce((acc, d) => acc + (Number(d.total_playtime_seconds) || 0), 0);

  const filteredOnlineCount = useMemo(() => filteredDevices.filter(d => getLiveStatus(d) === 'online').length, [filteredDevices, onlineDeviceIds])
  const filteredOfflineCount = useMemo(() => filteredDevices.filter(d => getLiveStatus(d) === 'offline').length, [filteredDevices, onlineDeviceIds])

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
            <h1 className={styles.pageTitle}>{t('Screens')}</h1>
            <button
              className={styles.headerRefreshBtn}
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label={t('Refresh Status')}
              title={t('Refresh Status')}
              type="button"
            >
              <RefreshCw size={16} className={isRefreshing ? styles.spin : ''} />
            </button>
          </div>
          {isMounted && (
            <div className={styles.statsContainer}>
              <div className={styles.statBadge}>
                <span className={styles.statDotOnline} />
                <span>{onlineCount} {t('Online')}</span>
              </div>
              <div className={styles.statBadge}>
                <span className={styles.statDotOffline} />
                <span>{offlineCount} {t('Offline')}</span>
              </div>
              <div className={styles.statBadge}>
                <Clock size={12} className={styles.statIcon} />
                <span>{formatPlaytime(totalPlaytimeSeconds)} {t('Total Playtime')}</span>
              </div>
            </div>
          )}
        </div>
        <div className={styles.topbarActions}>
          <button
            type="button"
            className={styles.topbarActionBtn}
            onClick={() => setShowCreateGroupFromSelection(true)}
          >
            <FolderPlus size={16} />
            {t('New Group')}
          </button>
          <button
            id="add-screen-btn"
            type="button"
            className={`${styles.topbarActionBtn} ${styles.topbarPrimaryBtn}`}
            onClick={() => setShowPairModal(true)}
          >
            <Plus size={16} />
            {t('Add Screen')}
          </button>
        </div>
      </div>

      <div className={styles.pageLayout}>
        <div className={`${styles.mainContent} ${isFilterSidebarOpen ? styles.sidebarOpen : ''}`}>

          {groups && (
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
              onCreateGroup={() => setShowCreateGroupFromSelection(true)}
              isRefreshing={isRefreshing}
              showSuccessPulse={showSuccessPulse}
              highlightedGroupId={highlightedGroupId}
            />
          )}

          <div className={styles.mainBlockContainer}>
            <div className={styles.controlsBar}>
              <div className={styles.controlsLeft}>
                <div className={styles.globalSelectContainer} ref={selectDropdownRef}>
                  <input 
                    type="checkbox" 
                    checked={filteredDevices.length > 0 && filteredDevices.every(d => selectedDeviceIds.has(d.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDeviceIds(new Set(filteredDevices.map(d => d.id)))
                      } else {
                        setSelectedDeviceIds(new Set())
                      }
                    }}
                    aria-label={t('Select all screens')}
                    className={styles.globalSelectCheckbox}
                  />
                  <button
                    type="button"
                    onClick={() => setIsSelectDropdownOpen(!isSelectDropdownOpen)}
                    className={styles.globalSelectDropdownBtn}
                    aria-label={t('Open selection menu')}
                  >
                    <ChevronDown size={14} />
                  </button>

                  {isSelectDropdownOpen && (
                    <div className={styles.globalSelectDropdownMenu}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDeviceIds(new Set(filteredDevices.map(d => d.id)))
                          setIsSelectDropdownOpen(false)
                        }}
                        className={styles.globalSelectDropdownItem}
                      >
                        {t('Select All')} ({filteredDevices.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDeviceIds(new Set(filteredDevices.filter(d => getLiveStatus(d) === 'online').map(d => d.id)))
                          setIsSelectDropdownOpen(false)
                        }}
                        className={styles.globalSelectDropdownItem}
                      >
                        {t('Select Online Only')} ({filteredOnlineCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDeviceIds(new Set(filteredDevices.filter(d => getLiveStatus(d) === 'offline').map(d => d.id)))
                          setIsSelectDropdownOpen(false)
                        }}
                        className={styles.globalSelectDropdownItem}
                      >
                        {t('Select Offline Only')} ({filteredOfflineCount})
                      </button>
                      <div className={styles.globalSelectDropdownDivider} />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDeviceIds(new Set())
                          setIsSelectDropdownOpen(false)
                        }}
                        className={`${styles.globalSelectDropdownItem} ${styles.globalSelectDropdownItemDanger}`}
                      >
                        {t('Deselect All')}
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.searchBox}>
                  <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input 
                    type="text" 
                    className={styles.searchInput}
                    placeholder={t('Search by name or status...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label={t('Search screens')}
                  />
                </div>
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
                  {t('Filters')}
                  {hasActiveFilters && (
                    <span className={styles.filterDot} />
                  )}
                </button>
                <div className={styles.sortContainer} ref={sortRef}>
                  <button 
                    className={`${styles.sortBtn} ${isSortOpen ? styles.sortBtnActive : ''}`}
                    onClick={() => setIsSortOpen(!isSortOpen)}
                    title={t('Sort')}
                    aria-label={t('Sort')}
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
                        { value: 'created-desc', label: t('Created Date (Newest)') },
                        { value: 'created-asc', label: t('Created Date (Oldest)') },
                        { value: 'name-asc', label: t('Name (A-Z)') },
                        { value: 'name-desc', label: t('Name (Z-A)') },
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
                      title={t('Table View')}
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
                      title={t('Grid View')}
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

            {showConnectionError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                background: 'var(--error-container)',
                border: '1.5px solid var(--error)',
                borderRadius: '12px',
                color: 'var(--error)',
                fontSize: '0.88rem',
                fontWeight: 600,
                margin: '16px'
              }}>
                <AlertTriangle size={18} />
                <span>{t('Real-time connection lost. Attempting to reconnect...')}</span>
              </div>
            )}

            {!isMounted ? (
              viewMode === 'grid' ? (
                <div className={styles.grid}>
                  {[1, 2, 3, 4, 5, 6].map((idx) => (
                    <div key={idx} style={{
                      background: 'var(--surface-lowest)',
                      border: '1px solid var(--outline-variant)',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="skeleton" style={{ width: '42px', height: '42px', borderRadius: '12px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                          <div className="skeleton" style={{ width: '120px', height: '16px' }} />
                          <div className="skeleton" style={{ width: '60px', height: '10px' }} />
                        </div>
                      </div>
                      <div className="skeleton" style={{ width: '100%', height: '36px', borderRadius: '8px' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', minHeight: '20px' }}>
                        <div className="skeleton" style={{ width: '80px', height: '14px' }} />
                        <div className="skeleton" style={{ width: '50px', height: '14px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
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
              )
            ) : filteredDevices.length === 0 ? (
              <EmptyState
                key="screens-empty-state-view"
                title={t('No screens found')}
                description={
                  devices.length === 0 
                    ? t('Open the NuExis player app on a screen, then click Add Screen to pair it to your workspace.')
                    : t('No screens matched your search criteria.')
                }
                icon={<div className={styles.emptyIcon}>NX</div>}
                action={devices.length === 0 ? (
                  <button
                    type="button"
                    className={`${styles.topbarActionBtn} ${styles.topbarPrimaryBtn}`}
                    onClick={() => setShowPairModal(true)}
                  >
                    <Plus size={16} aria-hidden="true" />
                    {t('Add Screen')}
                  </button>
                ) : undefined}
              />
            ) : viewMode === 'grid' ? (
              <div key="screens-grid-layout-view" className={`${styles.grid} ${showSuccessPulse ? styles.successPulse : ''}`}>
                {paginatedDevices.map((device) => (
                  <ErrorBoundary
                    key={device.id}
                    boundaryId={`device-card-${device.id}`}
                    fallback={
                      <div style={{
                        padding: '16px',
                        border: '1px solid #e57373',
                        borderRadius: '8px',
                        background: 'rgba(229,115,115,0.05)',
                        color: '#e57373',
                        fontSize: '0.875rem',
                        textAlign: 'center'
                      }}>
                        {t('Failed to load screen card')}
                      </div>
                    }
                  >
                    <DeviceCard
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
                      onItemClick={(e) => handleDeviceClick(e, device.id)}
                      onItemDoubleClick={() => handleDeviceDoubleClick(device)}
                      onGroupClick={handleGroupBadgeClick}
                      now={now}
                    />
                  </ErrorBoundary>
                ))}
              </div>
            ) : (
              <ErrorBoundary
                boundaryId="device-table"
                fallback={
                  <div style={{
                    padding: '32px',
                    border: '1px solid #e57373',
                    borderRadius: '8px',
                    background: 'rgba(229,115,115,0.05)',
                    color: '#e57373',
                    fontSize: '0.9rem',
                    textAlign: 'center',
                    margin: '16px 0'
                  }}>
                    {t('Failed to load screens table')}
                  </div>
                }
              >
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
                  onItemClick={handleDeviceClick}
                  onItemDoubleClick={handleDeviceDoubleClick}
                  handleGroupBadgeClick={handleGroupBadgeClick}
                  getLiveStatus={getLiveStatus}
                  showSuccessPulse={showSuccessPulse}
                  now={now}
                />
              </ErrorBoundary>
            )}
            
            {devices.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredDevices.length}
                onPageChange={navigatePage}
                itemLabel="screens"
              />
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
          setFilterGroupIds={handleSetFilterGroupIds}
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
        handleCreateGroupSuccess={handleCreateGroupSuccess}
      />

      {/* Custom Confirmation Dialog for deleting group */}
      <ConfirmDialog
        isOpen={deleteGroupTarget !== null}
        onClose={() => setDeleteGroupTarget(null)}
        onConfirm={handleConfirmDeleteGroup}
        title={t('Delete Group')}
        description={t('Are you sure you want to delete the group "{name}"?', { name: deleteGroupTarget?.name || '' })}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        variant="danger"
      />
    </>

  )
}
