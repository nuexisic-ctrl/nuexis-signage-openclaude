import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import PlaylistsClient from './PlaylistsClient'
import styles from './playlists.module.css'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'

interface Props {
  params: Promise<{ team_slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team_slug } = await params
  return {
    title: `Playlists — ${team_slug} | NuExis`,
    description: 'Manage playlists for your digital signage displays.',
  }
}

export default async function PlaylistsPage({ params, searchParams }: Props) {
  const { team_slug } = await params

  if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/customer/${team_slug}/login`)

  // Get the user's team_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id, role, teams(slug)')
    .eq('id', user.id)
    .single()

  const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) ? profile.teams.slug : undefined
  if (userTeamSlug && userTeamSlug !== team_slug) {
    redirect(`/customer/${userTeamSlug}/playlists`)
  }

  const fullName = user.user_metadata?.full_name as string | undefined
  const userRole = profile?.role || 'Owner'

  // Fetch playlists
  const { data: playlistsData } = await supabase
    .from('playlists')
    .select('id, name, created_at, updated_at, playlist_items(duration_seconds)')
    .eq('team_id', profile?.team_id as string)
    .order('created_at', { ascending: false })
    .limit(100)
    
  const playlists = playlistsData || []

  // Fetch available assets for adding to playlists
  const { data: assetsData } = await supabase
    .from('assets')
    .select('id, file_name, file_path, mime_type, size_bytes')
    .eq('team_id', profile?.team_id as string)
    .order('created_at', { ascending: false })
    .limit(100)
    
  const assets = assetsData || []

  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get('nuexis_sidebar_collapsed')?.value === 'true';

  return (
    <div className={styles.shell}>
      <Sidebar teamSlug={team_slug} fullName={fullName} email={user.email} role={userRole} initialCollapsed={initialCollapsed} />

      {/* Main */}
      <main className={styles.main}>
        <Header fullName={fullName} email={user.email} />
        
        <PlaylistsClient
          initialPlaylists={playlists}
          assets={assets}
          teamSlug={team_slug}
          teamId={profile?.team_id as string}
        />
      </main>
    </div>
  )
}
