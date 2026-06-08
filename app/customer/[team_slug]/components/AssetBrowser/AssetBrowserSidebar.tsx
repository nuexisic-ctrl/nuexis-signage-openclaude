'use client'

import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { useAssetBrowser } from './AssetBrowserContext'
import CustomSelect from '../CustomSelect'
import styles from './AssetBrowser.module.css'

interface AssetBrowserSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function AssetBrowserSidebar({ isOpen, onClose }: AssetBrowserSidebarProps) {
  const {
    allowedMimeTypes,
    selectedType,
    setSelectedType,
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
    clearFilters,
    setCurrentPage
  } = useAssetBrowser()

  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const sidebar = document.querySelector(`.${styles.filterSidebar}`)
      const toggleBtn = document.querySelector(`.${styles.filterToggleBtn}`)

      if (sidebar?.contains(target)) return
      if (toggleBtn?.contains(target)) return

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
  }, [isOpen, onClose])

  const showTypeFilter = !allowedMimeTypes || allowedMimeTypes.length === 0

  return (
    <>
      <div 
        className={`${styles.sidebarOverlay} ${isOpen ? styles.overlayOpen : ''}`} 
        onClick={onClose} 
      />
      <aside
        className={`${styles.filterSidebar} ${isOpen ? styles.isOpen : ''}`}
        aria-hidden={!isOpen}
        aria-labelledby="browser-filter-sidebar-title"
      >
        <div className={styles.sidebarHeader}>
          <h3 id="browser-filter-sidebar-title" className={styles.sidebarTitle}>Advanced Filters</h3>
          <button className={styles.closeSidebarBtn} onClick={onClose} type="button" aria-label="Close filters">
            <X size={20} />
          </button>
        </div>
        <div className={styles.sidebarBody}>
          {showTypeFilter && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel} htmlFor="browser-filter-file-type">File Type</label>
              <CustomSelect
                id="browser-filter-file-type"
                value={selectedType}
                onChange={(val) => { setSelectedType(val); setCurrentPage(1) }}
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'image', label: 'Images' },
                  { value: 'video', label: 'Videos' },
                  { value: 'audio', label: 'Audios' },
                  { value: 'pdf', label: 'PDFs' },
                  { value: 'document', label: 'Documents' },
                  { value: 'widget', label: 'Widgets' },
                  { value: 'folder', label: 'Folders' }
                ]}
              />
            </div>
          )}
          
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="browser-filter-date-pre">Date Added</label>
            <CustomSelect
              id="browser-filter-date-pre"
              value={filterDatePreset}
              onChange={(val) => { setFilterDatePreset(val); setCurrentPage(1) }}
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
                <label className={styles.filterLabel} htmlFor="browser-filter-start-date">Added After</label>
                <input id="browser-filter-start-date" type="date" className={styles.filterInput} value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
              </div>
              
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} htmlFor="browser-filter-end-date">Added Before</label>
                <input id="browser-filter-end-date" type="date" className={styles.filterInput} value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
              </div>
            </>
          )}

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="browser-filter-size-pre">Storage Size</label>
            <CustomSelect
              id="browser-filter-size-pre"
              value={filterSizePreset}
              onChange={(val) => { setFilterSizePreset(val); setCurrentPage(1) }}
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
                <label className={styles.filterLabel} htmlFor="browser-filter-min-size">Min Size (MB)</label>
                <input id="browser-filter-min-size" type="number" step="any" min="0" placeholder="e.g. 0.5" className={styles.filterInput} value={filterMinSize} onChange={e => setFilterMinSize(e.target.value)} />
              </div>
              
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} htmlFor="browser-filter-max-size">Max Size (MB)</label>
                <input id="browser-filter-max-size" type="number" step="any" min="0" placeholder="e.g. 15" className={styles.filterInput} value={filterMaxSize} onChange={e => setFilterMaxSize(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div className={styles.sidebarFooter}>
          <button 
            className={styles.resetFiltersBtn} 
            onClick={() => {
              clearFilters()
              setCurrentPage(1)
            }}
            type="button"
          >
            Reset All Filters
          </button>
        </div>
      </aside>
    </>
  )
}
