import React, { useState, useTransition } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { updateGroupMembers } from './actions'
import styles from './groups.module.css'
import { Group, Device, Membership } from './types'

interface ManageMembersProps {
  group: Group
  devices: Device[]
  memberships: Membership[]
  teamSlug: string
  onClose: () => void
  router: any
}

export function ManageMembersModal({
  group,
  devices,
  memberships,
  teamSlug,
  onClose,
  router
}: ManageMembersProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    return memberships.filter(m => m.group_id === group.id).map(m => m.device_id)
  })
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleToggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const res = await updateGroupMembers(teamSlug, group.id, selectedIds)
      if (res.success) {
        onClose()
        router.refresh()
      } else {
        setError(res.error || 'Failed to update members')
      }
    })
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Manage Screens</h2>
            <p className={styles.pageSubtitle} style={{ marginTop: '2px' }}>
              Assign screens to group <strong>{group.name}</strong>
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {devices.length === 0 ? (
            <p style={{ textAlign: 'center', margin: '20px 0', fontSize: '0.875rem', color: 'var(--on-surface-muted)' }}>
              No screens found in this workspace. Add screens first!
            </p>
          ) : (
            <div className={styles.deviceList}>
              {devices.map(device => {
                const checked = selectedIds.includes(device.id)
                return (
                  <label key={device.id} className={styles.deviceItem}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggle(device.id)}
                    />
                    <span className={styles.deviceItemText}>
                      {device.name || 'Unnamed Screen'}
                    </span>
                    <span 
                      className={styles.deviceItemStatus} 
                      style={{ color: device.status === 'online' ? '#10b981' : 'var(--on-surface-subtle)' }}
                    >
                      ● {device.status}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
          {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '12px' }}><AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px' }} />{error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btn} onClick={onClose}>Cancel</button>
          <button type="button" disabled={isPending} className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
