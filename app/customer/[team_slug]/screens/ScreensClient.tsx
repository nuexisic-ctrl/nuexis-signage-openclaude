'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
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
import { GroupsSection } from './GroupsSection'


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
}

export default function ScreensClient({
  devices: initialDevices,
  assets,
  playlists = [],
  groups: initialGroups = [],
  memberships: initialMemberships = [],
  teamSlug,
  teamId,
  totalScreens = 0,
  currentPage = 1,
  pageSize = 30
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
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
  
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set())
  const [filterGroupIds, setFilterGroupIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('filterGroupIds')
      try {
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    }
    return []
  })
  const [showCreateGroupFromSelection, setShowCreateGroupFromSelection] = useState(false)

  const [groups, setGroups] = useState<any[]>(initialGroups)
  const [memberships, setMemberships] = useState<any[]>(initialMemberships)
  const [editGroup, setEditGroup] = useState<any | null>(null)


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
    currentPage,
    pageSize,
    isRefreshing,
    router
  )

  useEffect(() => {
    const saved = localStorage.getItem('screensViewMode')
    if (saved === 'grid' || saved === 'table') {
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
  const [filterDatePreset, setFilterDatePreset] = useState<string>('all')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode)
    localStorage.setItem('screensViewMode', mode)
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

  async function handleRefresh() {
    if (isRefreshing) return
    setIsRefreshing(true)

    try {
      setPresenceRefreshKey(prev => prev + 1)

      const from = (currentPage - 1) * pageSize
      const to = from + pageSize - 1

      const [devicesRes, groupsRes, membershipsRes] = await Promise.all([
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
          .eq('team_id', teamId)
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
          router.refresh()
        } else {
          alert(res.error || 'Failed to delete group.')
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
      <div className={`${styles.topbar} ${isFilterSidebarOpen ? styles.sidebarOpen : ''}`}>
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
            className={styles.addBtn}
            onClick={() => setShowCreateGroupFromSelection(true)}
            style={{ 
              background: 'var(--surface-low)', 
              color: 'var(--on-surface)', 
              border: '1px solid var(--outline-variant)' 
            }}
          >
            New Group
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

          <GroupsSection
            groups={groups}
            devices={devices}
            memberships={memberships}
            assets={assets}
            playlists={playlists}
            teamSlug={teamSlug}
            onSelectGroup={(g) => setEditGroup(g)}
            onDeleteGroup={handleDeleteGroup}
            isRefreshing={isRefreshing}
            showSuccessPulse={showSuccessPulse}
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
                {selectedDeviceIds.size > 0 && (
                  <SelectedActions
                    selectedDeviceIds={selectedDeviceIds}
                    setSelectedDeviceIds={setSelectedDeviceIds}
                    setShowCreateGroupFromSelection={setShowCreateGroupFromSelection}
                    setDeleteModalDevice={setDeleteModalDevice}
                    setAssignModalDevice={setAssignModalDevice}
                  />
                )}
                <button 
                  className={`${styles.filterBtn} ${isFilterSidebarOpen || filterStatus !== 'all' || filterOrientation !== 'all' || filterDatePreset !== 'all' || filterGroupIds.length > 0 ? styles.active : ''}`}
                  onClick={() => setIsFilterSidebarOpen(!isFilterSidebarOpen)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                  </svg>
                  Filters
                  {(filterStatus !== 'all' || filterOrientation !== 'all' || filterDatePreset !== 'all' || filterGroupIds.length > 0) && (
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
                filteredDevices={filteredDevices}
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
                    : `Showing ${startItem} to ${endItem} of ${totalScreens} screens`
                  }
                </div>
                {!searchQuery && (
                  <div className={styles.pagination}>
                    <span className={styles.pageIndicator}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button 
                      className={styles.pageBtn} 
                      onClick={() => router.push(`?page=${currentPage - 1}`)}
                      disabled={!hasPrevPage}
                      style={{ opacity: hasPrevPage ? 1 : 0.5, cursor: hasPrevPage ? 'pointer' : 'not-allowed' }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button 
                      className={styles.pageBtn} 
                      onClick={() => router.push(`?page=${currentPage + 1}`)}
                      disabled={!hasNextPage}
                      style={{ opacity: hasNextPage ? 1 : 0.5, cursor: hasNextPage ? 'pointer' : 'not-allowed' }}
                    >
                      <ChevronRight size={16} />
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
          groups={groups}
          filterGroupIds={filterGroupIds}
          setFilterGroupIds={setFilterGroupIds}
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
