'use client'

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import styles from './Pagination.module.css'

interface PaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number, pageSize: number) => void
  itemLabel?: string // default: 'items'
  extraInfo?: React.ReactNode
}

export default function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  itemLabel = 'items',
  extraInfo,
}: PaginationProps) {
  const { t } = useTranslation()

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const hasPrevPage = currentPage > 1
  const hasNextPage = currentPage < totalPages

  return (
    <div className={styles.tableFooter}>
      <div className={styles.paginationInfo}>
        <span>
          {t('Showing {start} to {end} of {total} {label}', {
            start: String(startItem),
            end: String(endItem),
            total: String(totalItems),
            label: t(itemLabel),
          })}
        </span>
        {extraInfo && <div className={styles.extraInfo}>{extraInfo}</div>}
      </div>
      <div className={styles.footerControls}>
        <div className={styles.perPageSelector}>
          <span>{t('Per page:')}</span>
          <select
            value={String(pageSize)}
            onChange={(e) => {
              const val = Number(e.target.value) || 10
              onPageChange(1, val)
            }}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <span className={styles.pageIndicator}>
              {t('Page {current} of {total}', {
                current: String(currentPage),
                total: String(totalPages),
              })}
            </span>
            <button
              className={styles.pageBtn}
              onClick={() => onPageChange(currentPage - 1, pageSize)}
              disabled={!hasPrevPage}
              type="button"
              aria-label={t('Previous page')}
              style={{ cursor: hasPrevPage ? 'pointer' : 'not-allowed' }}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              className={styles.pageBtn}
              onClick={() => onPageChange(currentPage + 1, pageSize)}
              disabled={!hasNextPage}
              type="button"
              aria-label={t('Next page')}
              style={{ cursor: hasNextPage ? 'pointer' : 'not-allowed' }}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
