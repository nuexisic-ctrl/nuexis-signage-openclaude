import React from 'react'
import { X } from 'lucide-react'
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
}: FilterSidebarProps) {
  if (!isFilterSidebarOpen) return null

  return (
    <>
      <div className={styles.sidebarOverlay} onClick={() => setIsFilterSidebarOpen(false)} />
      <aside className={styles.filterSidebar}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>Advanced Filters</h3>
          <button className={styles.closeSidebarBtn} onClick={() => setIsFilterSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.sidebarBody}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Screen Status</label>
            <select className={styles.filterSelect} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="pairing">Pairing Mode</option>
            </select>
          </div>
          
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Orientation</label>
            <select className={styles.filterSelect} value={filterOrientation} onChange={e => setFilterOrientation(e.target.value)}>
              <option value="all">All Orientations</option>
              <option value="0">0° (Landscape)</option>
              <option value="90">90° (Portrait)</option>
              <option value="180">180° (Landscape Flipped)</option>
              <option value="270">270° (Portrait Flipped)</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Date Added</label>
            <select className={styles.filterSelect} value={filterDatePreset} onChange={e => setFilterDatePreset(e.target.value)}>
              <option value="all">Any time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
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
            }}
          >
            Reset All Filters
          </button>
        </div>
      </aside>
    </>
  )
}
