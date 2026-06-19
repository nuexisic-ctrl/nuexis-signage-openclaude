import React from 'react'
import { Info } from 'lucide-react'
import { GroupFilterDropdown } from './GroupFilterDropdown'
import CustomSelect from '../components/CustomSelect'
import { useTranslation } from '@/lib/i18n'
import SharedFilterSidebar from '../components/FilterSidebar'
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
  filteredCount: number
  totalCount: number
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
  filteredCount,
  totalCount,
}: FilterSidebarProps) {
  const { t } = useTranslation()
  const isFilterActive = filterStatus !== 'all' || filterOrientation !== 'all' || filterDatePreset !== 'all' || filterGroupIds.length > 0

  const handleReset = () => {
    setFilterStatus('all')
    setFilterOrientation('all')
    setFilterDatePreset('all')
    setFilterStartDate('')
    setFilterEndDate('')
    setFilterGroupIds([])
    localStorage.setItem('filterGroupIds', JSON.stringify([]))
  }

  const subtitle = isFilterActive ? (
    <>{t('Showing {filtered} of {total} screens', { filtered: String(filteredCount), total: String(totalCount) })}</>
  ) : (
    <>{t('Showing all {total} screens', { total: String(totalCount) })}</>
  )

  return (
    <SharedFilterSidebar
      isOpen={isFilterSidebarOpen}
      onClose={() => setIsFilterSidebarOpen(false)}
      title="Advanced Filters"
      subtitle={subtitle}
      onReset={handleReset}
    >
      {groups && groups.length >= 1 && (
        <div key="filter-disclaimer-banner" className={styles.infoBanner}>
          <div className={styles.infoDisclaimer}>
            <Info size={16} className={styles.infoIcon} />
            <p className={styles.infoText}>
              {t('Filters apply to screens only and do not affect groups.')}
            </p>
          </div>
        </div>
      )}

      {groups && groups.length > 0 && (
        <div key="group-filter-container" className={styles.filterGroup}>
          <label className={styles.filterLabel}>{t('Filter by Group')}</label>
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

      <div key="status-filter-container" className={styles.filterGroup}>
        <label className={styles.filterLabel}>{t('Screen Status')}</label>
        <CustomSelect
          id="filter-status"
          value={filterStatus}
          onChange={(val) => setFilterStatus(val)}
          options={[
            { value: 'all', label: t('All Statuses') },
            { value: 'online', label: t('Online') },
            { value: 'offline', label: t('Offline') },
            { value: 'pairing', label: t('Pairing Mode') }
          ]}
        />
      </div>
      
      <div key="orientation-filter-container" className={styles.filterGroup}>
        <label className={styles.filterLabel}>{t('Orientation')}</label>
        <CustomSelect
          id="filter-orientation"
          value={filterOrientation}
          onChange={(val) => setFilterOrientation(val)}
          options={[
            { value: 'all', label: t('All Orientations') },
            { value: '0', label: t('0° (Landscape)') },
            { value: '90', label: t('Rotate 90°') },
            { value: '180', label: t('Rotate 180°') },
            { value: '270', label: t('Rotate 270°') }
          ]}
        />
      </div>

      <div key="date-preset-filter-container" className={styles.filterGroup}>
        <label className={styles.filterLabel}>{t('Date Added')}</label>
        <CustomSelect
          id="filter-date-preset"
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
        <React.Fragment key="custom-date-inputs">
          <div key="custom-date-start-container" className={styles.filterGroup}>
            <label className={styles.filterLabel}>{t('Added After')}</label>
            <input type="date" className={styles.filterInput} value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
          </div>
          
          <div key="custom-date-end-container" className={styles.filterGroup}>
            <label className={styles.filterLabel}>{t('Added Before')}</label>
            <input type="date" className={styles.filterInput} value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
          </div>
        </React.Fragment>
      )}
    </SharedFilterSidebar>
  )
}
