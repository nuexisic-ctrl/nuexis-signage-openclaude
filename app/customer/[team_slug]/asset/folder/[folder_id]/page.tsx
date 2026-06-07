import type { Metadata } from 'next'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import AssetClient from '../../AssetClient'
import { Asset } from '../../types'

interface Props {
  params: Promise<{ team_slug: string; folder_id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team_slug, folder_id } = await params
  return {
    title: `Folder ${folder_id.substring(0, 6)} — ${team_slug} | NuExis`,
    description: 'Manage media assets inside this folder.',
  }
}

export default async function FolderPage({ params }: Props) {
  const { team_slug, folder_id } = await params

  if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()
  
  const isShortId = /^[a-f0-9]{6}$/i.test(folder_id)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(folder_id)
  if (!isShortId && !isUuid) notFound()

  const supabase = await createClient()
  const user = await getCachedUser()

  if (!user) redirect(`/customer/${team_slug}/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id, role, teams(slug)')
    .eq('id', user.id)
    .single()

  const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) ? profile.teams.slug : undefined
  if (userTeamSlug && userTeamSlug !== team_slug) {
    redirect(`/customer/${userTeamSlug}/asset/folder/${folder_id}`)
  }

  let folder
  if (isUuid) {
    // Optimized primary key lookup using UUID index (Scalable and Collision-free)
    const { data, error } = await supabase
      .from('assets')
      .select('id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color')
      .eq('team_id', profile?.team_id as string)
      .eq('id', folder_id)
      .eq('mime_type', 'application/x-folder')
      .single()

    if (error || !data) {
      notFound()
    }
    folder = data
  } else {
    // Fallback lookup using 6-character prefix for backward compatibility
    const { data, error } = await supabase
      .from('assets')
      .select('id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color')
      .eq('team_id', profile?.team_id as string)
      .eq('mime_type', 'application/x-folder')
      .filter('id::text', 'ilike', `${folder_id}%`)
      .single()

    if (error || !data) {
      notFound()
    }

    // Redirect to the scalable, UUID-based folder page
    redirect(`/customer/${team_slug}/asset/folder/${data.id}`)
  }

  // Fetch all assets for the team
  const query = supabase
    .from('assets')
    .select('id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color', { count: 'exact' })
    .eq('team_id', profile?.team_id as string)
    .order('created_at', { ascending: false })
    .limit(1000)

  const response = profile?.team_id
    ? await query
    : { data: [], count: 0 }

  const assets = response.data ?? []
  const totalAssets = assets.filter(a => a.mime_type !== 'application/x-folder').length

  // Fetch all screens for the team
  const { data: screens } = profile?.team_id
    ? await supabase
        .from('devices')
        .select('id, name, status, content_type, asset_id, playlist_id, content')
        .eq('team_id', profile.team_id as string)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <AssetClient
      initialAssets={assets as Parameters<typeof AssetClient>[0]['initialAssets']}
      teamId={profile?.team_id ?? ''}
      teamSlug={team_slug}
      totalAssets={totalAssets}
      screens={(screens ?? []) as Parameters<typeof AssetClient>[0]['screens']}
      folder={folder as Asset}
    />
  )
}
