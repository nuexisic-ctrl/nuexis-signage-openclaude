'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextProps {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme') as Theme | null
      return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
    }
    return 'system'
  })

  // Load from local storage on client mount (safely handles any hydration mismatches)
  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      setThemeState(saved)
    }
  }, [])

  // Listen to system pref changes and update data-theme attribute on <html>
  useEffect(() => {
    const applyTheme = (currentTheme: Theme) => {
      if (currentTheme === 'system') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
          const applied = e.matches ? 'dark' : 'light'
          document.documentElement.setAttribute('data-theme', applied)
        }
        updateTheme(mediaQuery)
        mediaQuery.addEventListener('change', updateTheme)
        return () => mediaQuery.removeEventListener('change', updateTheme)
      } else {
        document.documentElement.setAttribute('data-theme', currentTheme)
      }
    }

    const cleanup = applyTheme(theme)
    if (typeof cleanup === 'function') {
      return cleanup
    }
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
