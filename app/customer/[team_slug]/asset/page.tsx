import type { Metadata } from 'next'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import AssetClient from './AssetClient'
import styles from './asset.module.css'

interface Props {
  params: Promise<{ team_slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team_slug } = await params
  return {
    title: `Assets — ${team_slug} | NuExis`,
    description: 'Upload and manage media assets for your digital displays.',
  }
}

export default async function AssetPage({ params, searchParams }: Props) {
  try {
    const { team_slug } = await params

    if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()

    const supabase = await createClient()
    // Use getCachedUser() — deduplicates the auth/v1/user call shared with middleware
    const user = await getCachedUser()

    if (!user) redirect(`/customer/${team_slug}/login`)

    // Get user's team_id, role, and team slug securely from their profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('team_id, role, teams(slug)')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[AssetPage] Profile fetch error:', profileError)
    }

    const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) ? profile.teams.slug : undefined
    if (userTeamSlug && userTeamSlug !== team_slug) {
      redirect(`/customer/${userTeamSlug}/asset`)
    }

    const fullName = user.user_metadata?.full_name as string | undefined

    const userRole = profile?.role || 'Owner'

    // 1. Fetch all folders for the team to build breadcrumbs and folder structures
    const { data: foldersData, error: foldersError } = profile?.team_id
      ? await supabase
          .from('assets')
          .select('id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color')
          .eq('team_id', profile.team_id as string)
          .eq('mime_type', 'application/x-folder')
      : { data: [], error: null }

    if (foldersError) {
      console.error('[AssetPage] Folders fetch error:', foldersError)
    }

    const folders = foldersData || []

    // 2. Resolve active folder from path query parameter
    const resolvedSearchParams = await searchParams
    const pathParam = typeof resolvedSearchParams?.path === 'string' ? resolvedSearchParams.path : '/'

    let activeFolder = null
    if (pathParam && pathParam !== '/') {
      const segments = pathParam.split('/').filter(Boolean)
      let currentParentId: string | null = null
      for (const segment of segments) {
        const decodedSegment = decodeURIComponent(segment)
        const found = folders.find(f => 
          (f.folder_id || null) === currentParentId &&
          f.file_name.toLowerCase() === decodedSegment.toLowerCase()
        )
        if (!found) {
          activeFolder = null
          break
        }
        activeFolder = found
        currentParentId = found.id
      }
    }

    // 3. Fetch files inside the active folder (and screens) concurrently
    const filesQuery = supabase
      .from('assets')
      .select('id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color', { count: 'exact' })
      .eq('team_id', profile?.team_id as string)
      .neq('mime_type', 'application/x-folder')
      .order('created_at', { ascending: false })
      .limit(1000)

    const [filesRes, screensRes] = await Promise.all([
      profile?.team_id ? filesQuery : Promise.resolve({ data: [], count: 0, error: null }),
      profile?.team_id
        ? supabase
            .from('devices')
            .select('id, name, status, content_type, asset_id, playlist_id, content')
            .eq('team_id', profile.team_id as string)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null })
    ])

    if (filesRes.error) {
      console.error('[AssetPage] Files query error:', filesRes.error)
    }
    if (screensRes.error) {
      console.error('[AssetPage] Screens query error:', screensRes.error)
    }

    const files = filesRes.data ?? []
    const screens = screensRes.data ?? []

    return (
      <AssetClient
        initialFolders={folders as any}
        initialFiles={files as any}
        teamId={profile?.team_id ?? ''}
        teamSlug={team_slug}
        screens={(screens ?? []) as any}
        folder={activeFolder || undefined}
      />
    )
  } catch (err: any) {
    console.error('[AssetPage] Runtime 500 error details:', err)
    return (
      <div style={{ padding: '24px', color: '#ef4444', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '6px', margin: '20px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '8px' }}>Internal Server Error</h2>
        <p style={{ fontFamily: 'monospace', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
          {err instanceof Error ? err.stack || err.message : String(err)}
        </p>
      </div>
    )
  }
}
