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

  const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) ? (profile.teams as any).slug : undefined

  if (!profile || !profile.team_id || !userTeamSlug || userTeamSlug !== team_slug) {
    notFound()
  }

  const fullName = user.user_metadata?.full_name as string | undefined
  const userRole = profile.role || 'Owner'

  // Fetch playlists (assets are now fetched in the workspace route's asset picker)
  const { data: playlists } = await supabase
    .from('playlists')
    .select('id, name, created_at, updated_at, playlist_items(duration_seconds)')
    .eq('team_id', profile.team_id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <PlaylistsClient
      key={team_slug}
      initialPlaylists={playlists || []}
      teamSlug={team_slug}
      teamId={profile?.team_id as string}
    />
  )
}
