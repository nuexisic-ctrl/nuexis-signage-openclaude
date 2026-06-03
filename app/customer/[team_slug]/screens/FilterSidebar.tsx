import React from 'react'
import { X } from 'lucide-react'
import { GroupFilterDropdown } from './GroupFilterDropdown'
import CustomSelect from '../components/CustomSelect'
import styles from './FilterSidebar.module.css'

export interface FilterSidebarProps {
  isFilterSidebarOpen: boolean
  setIsFilterSidebarOpen: (open: boolean) => void
  filterStatus: string
  setFilterStatus: (status: string) => void
  filterOrientation: string
  setFilterOrientation: (orientation: string) => void
  filterDatePreset: string
  setFilterDatePreset: (preset: string) => void
  filterStartDate: string
  setFilterStartDate: (date: string) => void
  filterEndDate: string
  setFilterEndDate: (date: string) => void
  groups: any[]
  filterGroupIds: string[]
  setFilterGroupIds: (ids: string[]) => void
}

export function FilterSidebar({
  isFilterSidebarOpen,
  setIsFilterSidebarOpen,
  filterStatus,
  setFilterStatus,
  filterOrientation,
  setFilterOrientation,
  filterDatePreset,
  setFilterDatePreset,
  filterStartDate,
  setFilterStartDate,
  filterEndDate,
  setFilterEndDate,
  groups,
  filterGroupIds,
  setFilterGroupIds,
}: FilterSidebarProps) {
  React.useEffect(() => {
    if (!isFilterSidebarOpen) return

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // Stay open if click is inside the filter sidebar itself
      if (target.closest('[data-filter-sidebar]')) return
      // Stay open if click is on the filter toggle button
      if (target.closest('[data-filter-toggle]')) return
      // Stay open if click is anywhere inside the left nav sidebar
      if (target.closest('[data-sidebar-nav]')) return
      // Stay open if click is inside a modal, dropdown or select
      if (target.closest('[class*="modal"]') || target.closest('[class*="dropdown"]') || target.closest('[class*="select"]')) return

      setIsFilterSidebarOpen(false)
    }

    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick)
    }, 50)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleOutsideClick)
    }
  }, [isFilterSidebarOpen, setIsFilterSidebarOpen])

  return (
    <>
      <div 
        className={`${styles.sidebarOverlay} ${isFilterSidebarOpen ? styles.overlayOpen : ''}`} 
        onClick={() => setIsFilterSidebarOpen(false)} 
      />
      <aside data-filter-sidebar className={`${styles.filterSidebar} ${isFilterSidebarOpen ? styles.isOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>Advanced Filters</h3>
          <button className={styles.closeSidebarBtn} onClick={() => setIsFilterSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.sidebarBody}>
          {groups && groups.length > 0 && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Filter by Group</label>
              <GroupFilterDropdown
                groups={groups}
                selectedGroupIds={filterGroupIds}
                onChange={(ids) => {
                  setFilterGroupIds(ids)
                  localStorage.setItem('filterGroupIds', JSON.stringify(ids))
                }}
              />
            </div>
          )}

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Screen Status</label>
            <CustomSelect
              id="filter-status"
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'online', label: 'Online' },
                { value: 'offline', label: 'Offline' },
                { value: 'pairing', label: 'Pairing Mode' }
              ]}
            />
          </div>
          
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Orientation</label>
            <CustomSelect
              id="filter-orientation"
              value={filterOrientation}
              onChange={(val) => setFilterOrientation(val)}
              options={[
                { value: 'all', label: 'All Orientations' },
                { value: '0', label: '0° (Landscape)' },
                { value: '90', label: '90° (Portrait)' },
                { value: '180', label: '180° (Landscape Flipped)' },
                { value: '270', label: '270° (Portrait Flipped)' }
              ]}
            />
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Date Added</label>
            <CustomSelect
              id="filter-date-preset"
              value={filterDatePreset}
              onChange={(val) => setFilterDatePreset(val)}
              options={[
                { value: 'all', label: 'Any time' },
                { value: 'today', label: 'Today' },
                { value: '7days', label: 'Last 7 Days' },
                { value: '30days', label: 'Last 30 Days' },
                { value: 'custom', label: 'Custom Date Range' }
              ]}
            />
          </div>

          {filterDatePreset === 'custom' && (
            <>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Added After</label>
                <input type="date" className={styles.filterInput} value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
              </div>
              
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Added Before</label>
                <input type="date" className={styles.filterInput} value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div className={styles.sidebarFooter}>
          <button 
            className={styles.resetFiltersBtn} 
            onClick={() => {
              setFilterStatus('all'); 
              setFilterOrientation('all'); 
              setFilterDatePreset('all');
              setFilterStartDate(''); 
              setFilterEndDate('');
              setFilterGroupIds([]);
              localStorage.setItem('filterGroupIds', JSON.stringify([]));
            }}
          >
            Reset All Filters
          </button>
        </div>
      </aside>
    </>
  )
}
