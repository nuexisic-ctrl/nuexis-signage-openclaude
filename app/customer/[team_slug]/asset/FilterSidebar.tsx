'use client'

import React from 'react'
import { X } from 'lucide-react'
import CustomSelect from '../components/CustomSelect'
import { t } from '@/lib/i18n'
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
  triggerId?: string
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
  triggerId = 'assets-filter-button',
}: FilterSidebarProps) {
  React.useEffect(() => {
    if (!isOpen || isModal) return

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      const rightSidebar = document.querySelector(`.${styles.filterSidebar}`)
      const leftSidebar = document.querySelector('aside[class*="sidebar"]')
      const filterBtn = document.getElementById(triggerId)

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
  }, [isOpen, onClose, isModal, triggerId])

  return (
    <>
      {!isModal && (
        <div 
          className={`${styles.sidebarOverlay} ${isOpen ? styles.overlayOpen : ''}`} 
          onClick={onClose} 
        />
      )}
      <aside
        className={`${styles.filterSidebar} ${isOpen ? styles.isOpen : ''} ${isModal ? styles.isModal : ''}`}
        aria-hidden={!isOpen}
        aria-labelledby="assets-filter-sidebar-title"
      >
        <div className={styles.sidebarHeader}>
          <h3 id="assets-filter-sidebar-title" className={styles.sidebarTitle}>{t('Advanced Filters')}</h3>
          <button className={styles.closeSidebarBtn} onClick={onClose} type="button" aria-label={t('Close filters')}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.sidebarBody}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="asset-filter-file-type">{t('File Type')}</label>
            <CustomSelect
              id="asset-filter-file-type"
              value={filterType}
              onChange={(val) => setFilterType(val)}
              options={[
                { value: 'all', label: t('All Types') },
                { value: 'image', label: t('Images') },
                { value: 'video', label: t('Videos') },
                { value: 'widget', label: t('Widgets') }
              ]}
            />
          </div>
          
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="asset-filter-date-pre">{t('Date Added')}</label>
            <CustomSelect
              id="asset-filter-date-pre"
              value={filterDatePreset}
              onChange={(val) => setFilterDatePreset(val)}
              options={[
                { value: 'all', label: t('Any time') },
                { value: 'today', label: t('Today') },
                { value: '7days', label: t('Last 7 Days') },
                { value: '30days', label: t('Last 30 Days') },
                { value: 'custom', label: t('Custom Date Range') }
              ]}
            />
          </div>

          {filterDatePreset === 'custom' && (
            <>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} htmlFor="asset-filter-start-date">{t('Added After')}</label>
                <input id="asset-filter-start-date" type="date" className={styles.filterInput} value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
              </div>
              
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} htmlFor="asset-filter-end-date">{t('Added Before')}</label>
                <input id="asset-filter-end-date" type="date" className={styles.filterInput} value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
              </div>
            </>
          )}

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="asset-filter-size-pre">{t('Storage Size')}</label>
            <CustomSelect
              id="asset-filter-size-pre"
              value={filterSizePreset}
              onChange={(val) => setFilterSizePreset(val)}
              options={[
                { value: 'all', label: t('Any size') },
                { value: 'under1', label: t('Under 1 MB') },
                { value: '1to10', label: t('1 MB to 10 MB') },
                { value: '10to50', label: t('10 MB to 50 MB') },
                { value: 'custom', label: t('Custom Size Range') }
              ]}
            />
          </div>

          {filterSizePreset === 'custom' && (
            <>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} htmlFor="asset-filter-min-size">{t('Min Size (MB)')}</label>
                <input id="asset-filter-min-size" type="number" step="any" min="0" placeholder={t('e.g. 0.5')} className={styles.filterInput} value={filterMinSize} onChange={e => setFilterMinSize(e.target.value)} />
              </div>
              
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} htmlFor="asset-filter-max-size">{t('Max Size (MB)')}</label>
                <input id="asset-filter-max-size" type="number" step="any" min="0" placeholder={t('e.g. 15')} className={styles.filterInput} value={filterMaxSize} onChange={e => setFilterMaxSize(e.target.value)} />
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
            type="button"
          >
            {t('Reset All Filters')}
          </button>
        </div>
      </aside>
    </>
  )
}
