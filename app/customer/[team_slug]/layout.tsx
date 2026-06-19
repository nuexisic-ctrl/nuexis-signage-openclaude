import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { cookies, headers } from 'next/headers'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import ErrorBoundary from '@/app/components/ErrorBoundary'
import styles from './layout.module.css'
import { Search } from 'lucide-react'
import headerStyles from './components/header.module.css'

import { ThemeProvider } from '@/app/components/ThemeProvider'

interface LayoutProps {
  children: ReactNode
  params: Promise<{ team_slug: string }>
}

function HeaderSkeleton() {
  return (
    <header className={headerStyles.header}>
      <div className={headerStyles.left}>
        <div className={headerStyles.searchContainer}>
          <Search className={headerStyles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search..." 
            className={headerStyles.searchInput}
            disabled
          />
        </div>
      </div>
      <div className={headerStyles.right}>
        <div className="skeleton" style={{ width: '38px', height: '38px', borderRadius: '50%' }} />
        <div className="skeleton" style={{ width: '100px', height: '18px', borderRadius: '4px', marginLeft: '8px' }} />
      </div>
    </header>
  )
}

async function HeaderWrapper({ teamSlug }: { teamSlug: string }) {
  const user = await getCachedUser()
  if (!user) {
    redirect(`/customer/${teamSlug}/login`)
  }

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, team_id, teams(slug)')
    .eq('id', user.id)
    .single()

  const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) ? profile.teams.slug : undefined
  if (!profile || !profile.team_id || !userTeamSlug || userTeamSlug !== teamSlug) {
    notFound()
  }

  const fullName = user.user_metadata?.full_name as string | undefined

  return <Header fullName={fullName} email={user.email} />
}

export default async function CustomerLayout({ children, params }: LayoutProps) {
  const { team_slug } = await params

  if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()

  // Read current pathname from the custom header set by middleware.
  // Bypass auth checks and layout shell on the login page to avoid redirect loops and sidebar rendering.
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''
  if (pathname.endsWith('/login')) {
    return <>{children}</>
  }

  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get('nuexis_sidebar_collapsed')?.value === 'true';

  return (
    <ErrorBoundary boundaryId="customer-dashboard">
      <ThemeProvider>
        <div className={styles.shell}>
          <Sidebar 
            teamSlug={team_slug} 
            initialCollapsed={initialCollapsed} 
          />
          
          {/* Main Panel */}
          <main className={styles.main}>
            <Suspense fallback={<HeaderSkeleton />}>
              <HeaderWrapper teamSlug={team_slug} />
            </Suspense>
            {children}
          </main>
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
