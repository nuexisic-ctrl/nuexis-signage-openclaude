import type { Metadata } from 'next'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import AssetClient from './AssetClient'
import type { Asset, ScreenDevice } from './types'

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
  let team_slug = ''
  let teamId = ''
  let folders: Asset[] = []
  let files: Asset[] = []
  let screens: ScreenDevice[] = []
  let activeFolder: Asset | null = null
  let hasError = false
  let errorMsg = ''

  try {
    const { team_slug: resolvedSlug } = await params
    team_slug = resolvedSlug

    if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()

    const supabase = await createClient()
    const user = await getCachedUser()

    if (!user) redirect(`/customer/${team_slug}/login`)

    // Get user's team_id, role, and team slug securely from their profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('team_id, role, teams(slug)')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[AssetPage] Profile fetch error:', { message: profileError.message, details: profileError.details, hint: profileError.hint, code: profileError.code })
    }

    const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) ? profile.teams.slug : undefined
    if (userTeamSlug && userTeamSlug !== team_slug) {
      redirect(`/customer/${userTeamSlug}/asset`)
    }

    teamId = profile?.team_id ?? ''

    // 1. Fetch all folders for the team to build breadcrumbs and folder structures
    const { data: foldersData, error: foldersError } = teamId
      ? await supabase
          .from('assets')
          .select('id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color')
          .eq('team_id', teamId)
          .eq('mime_type', 'application/x-folder')
      : { data: [], error: null }

    if (foldersError) {
      console.error('[AssetPage] Folders fetch error:', { message: foldersError.message, details: foldersError.details, hint: foldersError.hint, code: foldersError.code })
    }

    folders = (foldersData || []) as Asset[]

    // 2. Resolve active folder from path query parameter
    const resolvedSearchParams = await searchParams
    const pathParam = typeof resolvedSearchParams?.path === 'string' ? resolvedSearchParams.path : '/'

    let isValidPath = true
    const validPathSegments: string[] = []
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
          isValidPath = false
          break
        }
        activeFolder = found
        currentParentId = found.id
        validPathSegments.push(segment)
      }
    }

    if (!isValidPath) {
      const correctedPath = validPathSegments.length > 0 
        ? '/' + validPathSegments.join('/') 
        : '/'
      const redirectUrl = correctedPath === '/' 
        ? `/customer/${team_slug}/asset` 
        : `/customer/${team_slug}/asset?path=${correctedPath}`
      redirect(redirectUrl)
    }

    // 3. Fetch files inside the active folder (and screens) concurrently
    const filesQuery = supabase
      .from('assets')
      .select('id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color', { count: 'exact' })
      .eq('team_id', teamId)
      .neq('mime_type', 'application/x-folder')
      .order('created_at', { ascending: false })
      .limit(1000)

    const [filesRes, screensRes] = await Promise.all([
      teamId ? filesQuery : Promise.resolve({ data: [], count: 0, error: null }),
      teamId
        ? supabase
            .from('devices')
            .select('id, name, status, content_type, asset_id, playlist_id, content')
            .eq('team_id', teamId)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null })
    ])

    if (filesRes.error) {
      console.error('[AssetPage] Files query error:', { message: filesRes.error.message, details: filesRes.error.details, hint: filesRes.error.hint, code: filesRes.error.code })
    }
    if (screensRes.error) {
      console.error('[AssetPage] Screens query error:', { message: screensRes.error.message, details: screensRes.error.details, hint: screensRes.error.hint, code: screensRes.error.code })
    }

    files = (filesRes.data || []) as Asset[]
    screens = (screensRes.data || []) as ScreenDevice[]
  } catch (err: unknown) {
    if (isRedirectError(err)) {
      throw err
    }
    console.error('[AssetPage] Runtime 500 error details:', err)
    hasError = true
    errorMsg = err instanceof Error ? err.stack || err.message : String(err)
  }

  if (hasError) {
    return (
      <div style={{ padding: '24px', color: '#ef4444', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '6px', margin: '20px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '8px' }}>Internal Server Error</h2>
        <p style={{ fontFamily: 'monospace', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
          {errorMsg}
        </p>
      </div>
    )
  }

  return (
    <AssetClient
      initialFolders={folders}
      initialFiles={files}
      teamId={teamId}
      teamSlug={team_slug}
      screens={screens}
      folder={activeFolder || undefined}
    />
  )
}
