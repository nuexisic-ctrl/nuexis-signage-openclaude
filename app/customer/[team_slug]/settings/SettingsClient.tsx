'use client'

import React, { useState } from 'react'
import { User, Shield, Layout, Sun, Moon, Monitor } from 'lucide-react'
import { toast } from '@/app/components/Toast'
import styles from './settings.module.css'
import { useTheme } from '@/app/components/ThemeProvider'

interface SettingsClientProps {
  teamSlug: string
  teamName: string
  userRole: string
  userEmail: string
  fullName: string
}

export default function SettingsClient({
  teamSlug,
  teamName,
  userRole,
  userEmail,
  fullName,
}: SettingsClientProps) {
  const { theme: activeTheme, setTheme: setActiveTheme } = useTheme()
  const [profileName, setProfileName] = useState(fullName)

  const handleSetTheme = (theme: 'light' | 'dark' | 'system') => {
    setActiveTheme(theme)
    toast.success(`Theme preference updated to ${theme}`)
  }

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success('Settings saved successfully (Demonstration)')
  }

  return (
    <div className={styles.settingsArea}>
      {/* Title */}
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.pageTitle}>Settings</h1>
          <p className={styles.pageSubtitle}>
            Configure your user profile and workspace preferences
          </p>
        </div>
      </div>

      <div className={styles.pageLayout}>
        <form onSubmit={handleSaveProfile} className={styles.settingsForm}>
          {/* Section 1: Profile Details */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <User size={18} className={styles.cardHeaderIcon} />
              <h2 className={styles.cardTitle}>Profile Information</h2>
            </div>
            
            <div className={styles.cardBody}>
              <div className={styles.formGroup}>
                <label htmlFor="settings-fullname">Full Name</label>
                <input
                  id="settings-fullname"
                  type="text"
                  className={styles.formInput}
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="settings-email">Email Address</label>
                <input
                  id="settings-email"
                  type="email"
                  className={styles.formInput}
                  value={userEmail}
                  disabled
                  title="Email cannot be changed directly"
                />
                <span className={styles.fieldHint}>Email address is managed by your provider authentication.</span>
              </div>
            </div>
          </div>

          {/* Section 2: Workspace Details */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Shield size={18} className={styles.cardHeaderIcon} />
              <h2 className={styles.cardTitle}>Workspace Details</h2>
            </div>
            
            <div className={styles.cardBody}>
              <div className={styles.rowGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="settings-workspace-name">Workspace Name</label>
                  <input
                    id="settings-workspace-name"
                    type="text"
                    className={styles.formInput}
                    value={teamName}
                    disabled
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="settings-workspace-slug">Slug Link</label>
                  <input
                    id="settings-workspace-slug"
                    type="text"
                    className={styles.formInput}
                    value={teamSlug}
                    disabled
                  />
                </div>
              </div>

              <div className={styles.roleBadgeContainer}>
                <span className={styles.roleLabel}>Your Role:</span>
                <span className={styles.roleBadge}>
                  {userRole}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Interface Themes */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Layout size={18} className={styles.cardHeaderIcon} />
              <h2 className={styles.cardTitle}>Theme Settings</h2>
            </div>
            
            <div className={styles.cardBody}>
              <p className={styles.sectionDesc}>
                Select how the digital signage console layout appears on this device.
              </p>
              
              <div className={styles.themeGrid}>
                <button
                  type="button"
                  className={`${styles.themeOption} ${activeTheme === 'light' ? styles.themeActive : ''}`}
                  onClick={() => handleSetTheme('light')}
                >
                  <Sun size={20} />
                  <span>Light</span>
                </button>
                
                <button
                  type="button"
                  className={`${styles.themeOption} ${activeTheme === 'dark' ? styles.themeActive : ''}`}
                  onClick={() => handleSetTheme('dark')}
                >
                  <Moon size={20} />
                  <span>Dark</span>
                </button>
                
                <button
                  type="button"
                  className={`${styles.themeOption} ${activeTheme === 'system' ? styles.themeActive : ''}`}
                  onClick={() => handleSetTheme('system')}
                >
                  <Monitor size={20} />
                  <span>System</span>
                </button>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className={styles.submitContainer}>
            <button type="submit" className={styles.saveBtn}>
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
