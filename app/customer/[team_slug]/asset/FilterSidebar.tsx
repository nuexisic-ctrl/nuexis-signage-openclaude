'use client'

import React from 'react'
import { X } from 'lucide-react'
import CustomSelect from '../components/CustomSelect'
import styles from './FilterSidebar.module.css'

interface FilterSidebarProps {
  isOpen: boolean
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
  isModal?: boolean
}

export function FilterSidebar({
  isOpen,
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
  isModal = false,
}: FilterSidebarProps) {
  React.useEffect(() => {
    if (!isOpen || isModal) return

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      const rightSidebar = document.querySelector(`.${styles.filterSidebar}`)
      const leftSidebar = document.querySelector('aside[class*="sidebar"]')
      const filterBtn = document.querySelector('button[class*="filterBtn"]')

      if (rightSidebar?.contains(target)) return
      if (leftSidebar?.contains(target)) return
      if (filterBtn?.contains(target)) return

      if (target.closest('[class*="modal"]') || target.closest('[class*="dropdown"]') || target.closest('[class*="select"]')) {
        return
      }

      onClose()
    }

    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick)
    }, 50)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleOutsideClick)
    }
  }, [isOpen, onClose, isModal])

  return (
    <>
      {!isModal && (
        <div 
          className={`${styles.sidebarOverlay} ${isOpen ? styles.overlayOpen : ''}`} 
          onClick={onClose} 
        />
      )}
      <aside className={`${styles.filterSidebar} ${isOpen ? styles.isOpen : ''} ${isModal ? styles.isModal : ''}`}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>Advanced Filters</h3>
          <button className={styles.closeSidebarBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.sidebarBody}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>File Type</label>
            <CustomSelect
              id="asset-filter-file-type"
              value={filterType}
              onChange={(val) => setFilterType(val)}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'image', label: 'Images' },
                { value: 'video', label: 'Videos' },
                { value: 'widget', label: 'Widgets' }
              ]}
            />
          </div>
          
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Date Added</label>
            <CustomSelect
              id="asset-filter-date-pre"
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

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Storage Size</label>
            <CustomSelect
              id="asset-filter-size-pre"
              value={filterSizePreset}
              onChange={(val) => setFilterSizePreset(val)}
              options={[
                { value: 'all', label: 'Any size' },
                { value: 'under1', label: 'Under 1 MB' },
                { value: '1to10', label: '1 MB to 10 MB' },
                { value: '10to50', label: '10 MB to 50 MB' },
                { value: 'custom', label: 'Custom Size Range' }
              ]}
            />
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
