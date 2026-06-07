import type { Metadata } from 'next'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import PlaylistsClient from './PlaylistsClient'
import styles from './playlists.module.css'

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
  const user = await getCachedUser()

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

  // Fetch playlists and available assets concurrently to eliminate waterfall delays
  const [playlistsRes, assetsRes] = await Promise.all([
    supabase
      .from('playlists')
      .select('id, name, created_at, updated_at, playlist_items(duration_seconds)')
      .eq('team_id', profile?.team_id as string)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('assets')
      .select('id, file_name, file_path, mime_type, size_bytes')
      .eq('team_id', profile?.team_id as string)
      .neq('mime_type', 'application/x-folder')
      .order('created_at', { ascending: false })
      .limit(100)
  ])
    
  const playlists = playlistsRes.data || []
  const assets = assetsRes.data || []

  return (
    <PlaylistsClient
      key={team_slug}
      initialPlaylists={playlists}
      assets={assets}
      teamSlug={team_slug}
      teamId={profile?.team_id as string}
    />
  )
}
