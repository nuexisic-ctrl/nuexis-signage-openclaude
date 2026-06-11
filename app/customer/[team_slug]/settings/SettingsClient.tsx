'use client'

import React, { useState } from 'react'
import { User, Shield, Layout, Sun, Moon, Monitor, X, Globe } from 'lucide-react'
import { toast } from '@/app/components/Toast'
import styles from './settings.module.css'
import { useTheme } from '@/app/components/ThemeProvider'
import { updateTeamAllowedDomains } from './actions'

interface SettingsClientProps {
  teamSlug: string
  teamName: string
  userRole: string
  userEmail: string
  fullName: string
  allowedDomains: string[]
}

export default function SettingsClient({
  teamSlug,
  teamName,
  userRole,
  userEmail,
  fullName,
  allowedDomains,
}: SettingsClientProps) {
  const { theme: activeTheme, setTheme: setActiveTheme } = useTheme()
  const [profileName, setProfileName] = useState(fullName)
  const [allowedDomainsList, setAllowedDomainsList] = useState<string[]>(allowedDomains)
  const [newDomain, setNewDomain] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSetTheme = (theme: 'light' | 'dark' | 'system') => {
    setActiveTheme(theme)
    toast.success(`Theme preference updated to ${theme}`)
  }

  const handleAddDomain = () => {
    const trimmed = newDomain.trim().toLowerCase()
    if (!trimmed) return
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/
    if (!domainRegex.test(trimmed)) {
      toast.error('Invalid domain format (e.g. example.com)')
      return
    }
    if (allowedDomainsList.includes(trimmed)) {
      toast.error('Domain already in the list')
      return
    }
    setAllowedDomainsList([...allowedDomainsList, trimmed])
    setNewDomain('')
  }

  const handleRemoveDomain = (domain: string) => {
    setAllowedDomainsList(allowedDomainsList.filter(d => d !== domain))
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      if (userRole === 'Owner' || userRole === 'Admin') {
        const res = await updateTeamAllowedDomains(teamSlug, allowedDomainsList)
        if (res.success) {
          toast.success('Workspace settings saved successfully')
        } else {
          toast.error(res.error || 'Failed to save settings')
        }
      } else {
        toast.success('Profile settings updated (Demonstration)')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while saving')
    } finally {
      setIsSaving(false)
    }
  }

  const isEditable = userRole === 'Owner' || userRole === 'Admin'

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

          {/* Section 2.5: Allowed Domains for Remote URLs */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Globe size={18} className={styles.cardHeaderIcon} />
              <h2 className={styles.cardTitle}>Remote URL Domain Allowlist</h2>
            </div>
            
            <div className={styles.cardBody}>
              <p className={styles.sectionDesc}>
                Restrict remote iframe/website widget URLs to allowlisted domains for security against SSRF and XSS attacks.
              </p>

              <div className={styles.formGroup}>
                <label htmlFor="settings-new-domain">Add Allowed Domain</label>
                <div className={styles.domainInputGroup}>
                  <input
                    id="settings-new-domain"
                    type="text"
                    className={styles.formInput}
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="e.g. dashboard.example.com"
                    disabled={!isEditable}
                  />
                  <button
                    type="button"
                    onClick={handleAddDomain}
                    className={styles.addDomainBtn}
                    disabled={!isEditable}
                  >
                    Add
                  </button>
                </div>
                {!isEditable && (
                  <span className={styles.fieldHint}>Only workspace Owners or Admins can modify the domain allowlist.</span>
                )}
              </div>

              <div className={styles.formGroup}>
                <label>Currently Allowed Domains</label>
                {allowedDomainsList.length === 0 ? (
                  <span className={styles.fieldHint}>No domains allowlisted yet. Remote URL widgets will be blocked until a domain is added.</span>
                ) : (
                  <div className={styles.domainList}>
                    {allowedDomainsList.map((domain) => (
                      <span key={domain} className={styles.domainTag}>
                        {domain}
                        {isEditable && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDomain(domain)}
                            className={styles.removeDomainBtn}
                            title={`Remove ${domain}`}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
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
            <button type="submit" className={styles.saveBtn} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
