'use client'

import { useState, useEffect } from 'react'
import { translations, type LocaleType } from './i18n/locales'
export type { LocaleType }

// Supported locales list
export const SUPPORTED_LOCALES: { code: LocaleType; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano' },
  { code: 'nl', label: 'Dutch', nativeLabel: 'Nederlands' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português' },
  { code: 'sv', label: 'Swedish', nativeLabel: 'Svenska' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語' }
]

// Determine initial locale safely on server vs client
let currentLocale: LocaleType = 'en'

if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('nuexis_locale')
    if (saved && saved in translations) {
      currentLocale = saved as LocaleType
    } else {
      // Check cookies as fallback
      const cookies = document.cookie.split(';')
      const localeCookie = cookies.find(c => c.trim().startsWith('nuexis_locale='))
      if (localeCookie) {
        const val = localeCookie.split('=')[1]?.trim()
        if (val && val in translations) {
          currentLocale = val as LocaleType
        }
      }
    }
  } catch (_) {
    // ignore
  }
}

const listeners = new Set<() => void>()

export function getLocale(): LocaleType {
  return currentLocale
}

export function setLocale(locale: LocaleType) {
  if (locale !== currentLocale && locale in translations) {
    currentLocale = locale
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nuexis_locale', locale)
        document.cookie = `nuexis_locale=${locale}; path=/; max-age=31536000; SameSite=Lax`
      } catch (_) {
        // ignore
      }
    }
    listeners.forEach(listener => {
      try {
        listener()
      } catch (_) {
        // ignore
      }
    })
  }
}

// Reactive hook to subscribe components to language updates
export function useTranslation() {
  const [mounted, setMounted] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    setMounted(true)
    const handleUpdate = () => {
      setTick(t => t + 1)
    }
    listeners.add(handleUpdate)
    return () => {
      listeners.delete(handleUpdate)
    }
  }, [])

  // Mount-aware translate helper
  const tLocal = (key: string, replacements?: Record<string, string | number>): string => {
    if (!mounted) {
      // Return English during server-rendering and client hydration to avoid mismatch
      const localeTranslations = translations['en']
      let text = localeTranslations?.[key] ?? key
      if (replacements) {
        Object.entries(replacements).forEach(([k, v]) => {
          text = text.replace(new RegExp(`{${k}}`, 'g'), String(v))
        })
      }
      return text
    }
    return t(key, replacements)
  }

  // Mount-aware date helper
  const formatDateLocal = (
    date: Date | string | number,
    options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  ): string => {
    if (!mounted) {
      try {
        const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
        if (isNaN(d.getTime())) return String(date)
        return new Intl.DateTimeFormat('en', options).format(d)
      } catch (_) {
        return String(date)
      }
    }
    return formatDate(date, options)
  }

  // Mount-aware time helper
  const formatTimeLocal = (
    date: Date | string | number,
    options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
  ): string => {
    if (!mounted) {
      try {
        const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
        if (isNaN(d.getTime())) return String(date)
        return new Intl.DateTimeFormat('en', options).format(d)
      } catch (_) {
        return String(date)
      }
    }
    return formatTime(date, options)
  }

  // Mount-aware number helper
  const formatNumberLocal = (num: number, options?: Intl.NumberFormatOptions): string => {
    if (!mounted) {
      try {
        return new Intl.NumberFormat('en', options).format(num)
      } catch (_) {
        return String(num)
      }
    }
    return formatNumber(num, options)
  }

  // Mount-aware currency helper
  const formatCurrencyLocal = (
    num: number,
    currency = 'USD',
    options: Intl.NumberFormatOptions = {}
  ): string => {
    if (!mounted) {
      try {
        return new Intl.NumberFormat('en', {
          style: 'currency',
          currency,
          ...options
        }).format(num)
      } catch (_) {
        return `${currency} ${num}`
      }
    }
    return formatCurrency(num, currency, options)
  }

  return {
    t: tLocal,
    locale: mounted ? currentLocale : 'en',
    setLocale,
    formatDate: formatDateLocal,
    formatTime: formatTimeLocal,
    formatNumber: formatNumberLocal,
    formatCurrency: formatCurrencyLocal
  }
}

// Global translate function (supports replacements e.g. t('Hello {name}', { name: 'John' }))
export function t(key: string, replacements?: Record<string, string | number>): string {
  const localeTranslations = translations[currentLocale] || translations['en']
  let text = localeTranslations?.[key] ?? translations['en']?.[key] ?? key

  if (replacements) {
    Object.entries(replacements).forEach(([k, v]) => {
      text = text.replace(new RegExp(`{${k}}`, 'g'), String(v))
    })
  }

  return text
}

// Native formatting helpers using the active locale
export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
    if (isNaN(d.getTime())) return String(date)
    return new Intl.DateTimeFormat(currentLocale, options).format(d)
  } catch (_) {
    return String(date)
  }
}

export function formatTime(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
): string {
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
    if (isNaN(d.getTime())) return String(date)
    return new Intl.DateTimeFormat(currentLocale, options).format(d)
  } catch (_) {
    return String(date)
  }
}

export function formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(currentLocale, options).format(num)
  } catch (_) {
    return String(num)
  }
}

export function formatCurrency(
  num: number,
  currency = 'USD',
  options: Intl.NumberFormatOptions = {}
): string {
  try {
    return new Intl.NumberFormat(currentLocale, {
      style: 'currency',
      currency,
      ...options
    }).format(num)
  } catch (_) {
    return `${currency} ${num}`
  }
}
