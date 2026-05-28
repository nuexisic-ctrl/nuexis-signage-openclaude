'use client'

import { X } from 'lucide-react'
import styles from './FilterSidebar.module.css'

interface FilterSidebarProps {
  filterType: string
  setFilterType: (val: string) => void
  filterDatePreset: string
  setFilterDatePreset: (val: string) => void
  filterStartDate: string
  setFilterStartDate: (val: string) => void
  filterEndDate: string
  setFilterEndDate: (val: string) => void
  filterSizePreset: string
  setFilterSizePreset: (val: string) => void
  filterMinSize: string
  setFilterMinSize: (val: string) => void
  filterMaxSize: string
  setFilterMaxSize: (val: string) => void
  onClose: () => void
}

export function FilterSidebar({
  filterType,
  setFilterType,
  filterDatePreset,
  setFilterDatePreset,
  filterStartDate,
  setFilterStartDate,
  filterEndDate,
  setFilterEndDate,
  filterSizePreset,
  setFilterSizePreset,
  filterMinSize,
  setFilterMinSize,
  filterMaxSize,
  setFilterMaxSize,
  onClose,
}: FilterSidebarProps) {
  return (
    <>
      <div className={styles.sidebarOverlay} onClick={onClose} />
      <aside className={styles.filterSidebar}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>Advanced Filters</h3>
          <button className={styles.closeSidebarBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.sidebarBody}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>File Type</label>
            <select className={styles.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="widget">Widgets</option>
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

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Storage Size</label>
            <select className={styles.filterSelect} value={filterSizePreset} onChange={e => setFilterSizePreset(e.target.value)}>
              <option value="all">Any size</option>
              <option value="under1">Under 1 MB</option>
              <option value="1to10">1 MB to 10 MB</option>
              <option value="10to50">10 MB to 50 MB</option>
              <option value="custom">Custom Size Range</option>
            </select>
          </div>

          {filterSizePreset === 'custom' && (
            <>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Min Size (MB)</label>
                <input type="number" step="any" min="0" placeholder="e.g. 0.5" className={styles.filterInput} value={filterMinSize} onChange={e => setFilterMinSize(e.target.value)} />
              </div>
              
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Max Size (MB)</label>
                <input type="number" step="any" min="0" placeholder="e.g. 15" className={styles.filterInput} value={filterMaxSize} onChange={e => setFilterMaxSize(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div className={styles.sidebarFooter}>
          <button 
            className={styles.resetFiltersBtn} 
            onClick={() => {
              setFilterType('all'); 
              setFilterDatePreset('all');
              setFilterStartDate(''); 
              setFilterEndDate('');
              setFilterSizePreset('all');
              setFilterMinSize('');
              setFilterMaxSize('');
            }}
          >
            Reset All Filters
          </button>
        </div>
      </aside>
    </>
  )
}
