// Shared types and utilities for the player module

export type PlayerState = 'loading' | 'pairing' | 'paired' | 'expired'

export const PAIRING_DURATION_MS = 15 * 60 * 1000 // 15 minutes

export function formatTime(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000))
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const array = new Uint32Array(6)
  window.crypto.getRandomValues(array)
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[array[i] % chars.length]
  }
  return code
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RealtimeChannel = any

export interface DeviceState {
  id: string
  team_id: string | null
  name: string | null
  pairing_code: string
  expires_at: string
  status: string
  content_type: string | null
  asset_id: string | null
  playlist_id: string | null
  orientation: number | null
  scale_mode: string | null
  created_at: string
  last_seen_at: string | null
  updated_at?: string | null
}

declare global {
  interface Window {
    Android?: {
      getNativeHardwareId: () => string;
      getNativeSecret: () => string | null;
      setNativeSecret: (secret: string) => void;
      clearNativeSecret: () => void;
    };
  }
}
