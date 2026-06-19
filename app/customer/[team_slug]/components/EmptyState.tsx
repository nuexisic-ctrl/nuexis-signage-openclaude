'use client'

import React from 'react'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  title: string
  description: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export default function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`${styles.emptyStateContainer} ${className}`}>
      {icon && (
        <div className={styles.emptyIconWrapper}>
          {icon}
        </div>
      )}
      <h3 className={styles.emptyTitle}>{title}</h3>
      <p className={styles.emptyDescription}>{description}</p>
      {action && (
        <div className={styles.emptyActionArea}>
          {action}
        </div>
      )}
    </div>
  )
}
