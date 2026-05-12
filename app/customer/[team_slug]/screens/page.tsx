import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ScreensClient from './ScreensClient'
import styles from './screens.module.css'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'

interface Props {
  params: Promise<{ team_slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team_slug } = await params
  return {
    title: `Screens — ${team_slug} | NuExis`,
    description: 'Manage and pair digital displays for your workspace.',
  }
}

export default async function ScreensPage({ params }: Props) {
  const { team_slug } = await params

  if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/customer/${team_slug}/login`)

  const userTeamSlug = user.user_metadata?.team_slug as string | undefined
  if (userTeamSlug && userTeamSlug !== team_slug) {
    redirect(`/customer/${userTeamSlug}/screens`)
  }

  const fullName = user.user_metadata?.full_name as string | undefined

  // Get the user's team_id and role from their profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id, role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role || 'Owner'

  const query = supabase
    .from('devices')
    .select('id, name, status, created_at, content_type, asset_id, scale_mode, orientation, device_heartbeats(last_seen_at)')
    .eq('team_id', profile?.team_id as string)
    .order('created_at', { ascending: false })

  const devicesData = profile?.team_id
    ? ((await query).data ?? [])
    : []

  const devices = devicesData.map((d) => {
    const hb = Array.isArray(d.device_heartbeats) ? d.device_heartbeats[0] : d.device_heartbeats
    const { device_heartbeats, ...rest } = d
    return {
      ...rest,
      status: rest.status as 'online' | 'offline' | 'pairing',
      last_seen_at: hb?.last_seen_at || null,
      device_heartbeats: undefined
    }
  })

  // Fetch all assets for this team
  const assets = profile?.team_id
    ? (await supabase
        .from('assets')
        .select('id, file_name, file_path, mime_type, size_bytes')
        .eq('team_id', profile.team_id)
        .order('created_at', { ascending: false })
      ).data ?? []
    : []

  return (
    <div className={styles.shell}>
      <Sidebar teamSlug={team_slug} fullName={fullName} email={user.email} role={userRole} />

      {/* Main */}
      <main className={styles.main}>
        <Header fullName={fullName} email={user.email} />
        
        <ScreensClient
          devices={devices}
          assets={assets}
          teamSlug={team_slug}
          teamId={profile?.team_id as string}
        />
      </main>
    </div>
  )
}
