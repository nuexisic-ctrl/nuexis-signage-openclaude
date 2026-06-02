import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import GroupsClient from './GroupsClient'
import styles from './groups.module.css'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'

interface Props {
  params: Promise<{ team_slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team_slug } = await params
  return {
    title: `Groups — ${team_slug} | NuExis`,
    description: 'Bulk manage your screens with Screen Groups.',
  }
}

export default async function GroupsPage({ params }: Props) {
  const { team_slug } = await params

  if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()

  const supabase = await createClient()
  const user = await getCachedUser()

  if (!user) redirect(`/customer/${team_slug}/login`)

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id, role, teams(slug)')
    .eq('id', user.id)
    .single()

  const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) ? profile.teams.slug : undefined
  if (userTeamSlug && userTeamSlug !== team_slug) {
    redirect(`/customer/${userTeamSlug}/groups`)
  }

  const teamId = profile?.team_id as string
  if (!teamId) notFound()

  const fullName = user.user_metadata?.full_name as string | undefined
  const userRole = profile?.role || 'Owner'

  // 1. Fetch screen groups
  const { data: screenGroups } = await supabase
    .from('screen_groups')
    .select('*')
    .eq('team_id', teamId)
    .order('name', { ascending: true })

  // 2. Fetch all devices for group member management
  const { data: devices } = await supabase
    .from('devices')
    .select('id, name, status, last_seen_at')
    .eq('team_id', teamId)
    .order('name', { ascending: true })

  // 3. Fetch all group membership rows
  const { data: memberships } = await supabase
    .from('screen_group_members')
    .select('group_id, device_id, is_primary')
    .eq('team_id', teamId)

  // 4. Fetch all team assets
  const { data: assets } = await supabase
    .from('assets')
    .select('id, file_name, file_path, mime_type, size_bytes, created_at')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  // 5. Fetch all team playlists
  const { data: playlists } = await supabase
    .from('playlists')
    .select('id, name, created_at, playlist_items(duration_seconds, widget_type, assets(mime_type))')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  const cookieStore = await cookies()
  const initialCollapsed = cookieStore.get('nuexis_sidebar_collapsed')?.value === 'true'

  return (
    <div className={styles.shell}>
      <Sidebar
        teamSlug={team_slug}
        fullName={fullName}
        email={user.email}
        role={userRole}
        initialCollapsed={initialCollapsed}
      />

      <main className={styles.main}>
        <Header fullName={fullName} email={user.email} />

        <GroupsClient
          groups={screenGroups || []}
          devices={devices || []}
          memberships={memberships || []}
          assets={assets || []}
          playlists={playlists || []}
          teamSlug={team_slug}
          teamId={teamId}
        />
      </main>
    </div>
  )
}
