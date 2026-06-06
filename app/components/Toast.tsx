'use client'

import React, { useState, useEffect, useRef } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import styles from './toast.module.css'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration: number
  isExiting?: boolean
}

type ToastCallback = (toast: ToastItem) => void
const listeners = new Set<ToastCallback>()
const dismissListeners = new Set<(id: string) => void>()

/**
 * Friendly Error Parser to translate technical error messages into clear, 
 * user-friendly descriptions.
 */
export function getFriendlyErrorMessage(message: string, type: ToastType): string {
  if (type !== 'error') return message

  const msg = message.toLowerCase()

  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'Incorrect email or password. Please verify your details and try again.'
  }
  if (msg.includes('user already exists') || msg.includes('already registered')) {
    return 'An account with this email address already exists.'
  }
  if (msg.includes('unique constraint') || msg.includes('already exists')) {
    return 'This item already exists. Please choose a distinct name.'
  }
  if (msg.includes('jwt expired') || msg.includes('token expired') || msg.includes('session expired')) {
    return 'Your session has expired. Please sign in again to continue.'
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('offline') || msg.includes('networkerror')) {
    return 'Connection problem. Please check your internet connection and try again.'
  }
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429')) {
    return 'Too many attempts in a short time. Please wait a moment and try again.'
  }
  if (msg.includes('empty') || msg.includes('cannot be empty')) {
    return 'Required field cannot be empty. Please enter a value.'
  }
  if (msg.includes('unauthorized') || msg.includes('permission denied')) {
    return 'Access denied. You do not have permission to perform this action.'
  }

  // Capitalize first letter if it isn't already
  return message.charAt(0).toUpperCase() + message.slice(1)
}

/**
 * Global toast emitter singleton. Call these functions from anywhere
 * in client-side code to trigger professional toast notifications.
 */
export const toast = {
  subscribe(callback: ToastCallback) {
    listeners.add(callback)
    return () => {
      listeners.delete(callback)
    }
  },
  subscribeDismiss(callback: (id: string) => void) {
    dismissListeners.add(callback)
    return () => {
      dismissListeners.delete(callback)
    }
  },
  show(message: string, type: ToastType = 'info', duration = 5000) {
    const id = Math.random().toString(36).substring(2, 9)
    const friendlyMessage = getFriendlyErrorMessage(message, type)
    const toastItem: ToastItem = { id, message: friendlyMessage, type, duration }
    listeners.forEach((cb) => cb(toastItem))
    return id
  },
  success(message: string, duration?: number) {
    return this.show(message, 'success', duration)
  },
  error(message: string, duration?: number) {
    return this.show(message, 'error', duration)
  },
  warning(message: string, duration?: number) {
    return this.show(message, 'warning', duration)
  },
  info(message: string, duration?: number) {
    return this.show(message, 'info', duration)
  },
  dismiss(id: string) {
    dismissListeners.forEach((cb) => cb(id))
  }
}

/**
 * Individual Toast Component. Handles self-contained timers, pause-on-hover,
 * accessibility attributes, and matching visual styling.
 */
function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: (id: string) => void }) {
  const { id, message, type, duration, isExiting } = toast
  const [remaining, setRemaining] = useState(duration)
  const [isHovered, setIsHovered] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isHovered) {
      if (timerRef.current) clearInterval(timerRef.current)
    } else {
      timerRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 50) {
            if (timerRef.current) clearInterval(timerRef.current)
            return 0
          }
          return prev - 50
        })
      }, 50)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isHovered])

  useEffect(() => {
    if (remaining <= 0) {
      onClose(id)
    }
  }, [remaining, id, onClose])

  const progress = (remaining / duration) * 100

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className={styles.iconSuccess} size={20} />
      case 'error':
        return <AlertCircle className={styles.iconError} size={20} />
      case 'warning':
        return <AlertTriangle className={styles.iconWarning} size={20} />
      case 'info':
      default:
        return <Info className={styles.iconInfo} size={20} />
    }
  }

  return (
    <div
      className={`${styles.toastCard} ${styles[type]} ${isExiting ? styles.exiting : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="status"
      aria-live="polite"
    >
      <div className={styles.toastBody}>
        <div className={styles.iconContainer}>{getIcon()}</div>
        <div className={styles.message}>{message}</div>
        <button
          className={styles.closeButton}
          onClick={() => onClose(id)}
          aria-label="Dismiss notification"
          type="button"
        >
          <X size={16} />
        </button>
      </div>
      <div className={styles.progressBarContainer}>
        <div
          className={`${styles.progressBar} ${styles[`progress_${type}`]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Toast Container Component. Renders stacks of active alerts in the layout.
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const handleAdd = (newToast: ToastItem) => {
      setToasts((prev) => [...prev, newToast])
    }

    const handleDismiss = (id: string) => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
      )
      // Wait for exit transition to complete before deleting from DOM
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 300)
    }

    const unsubscribeAdd = toast.subscribe(handleAdd)
    const unsubscribeDismiss = toast.subscribeDismiss(handleDismiss)

    return () => {
      unsubscribeAdd()
      unsubscribeDismiss()
    }
  }, [])

  return (
    <div className={styles.toastContainer}>
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={toast.dismiss} />
      ))}
    </div>
  )
}
