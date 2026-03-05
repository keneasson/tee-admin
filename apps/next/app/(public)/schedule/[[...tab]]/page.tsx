import { auth } from '@/utils/auth'
import { getScheduleData } from '@/utils/schedule-data'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { ScheduleClient } from './schedule-client'

// URL slug → internal tab ID
const SLUG_TO_TAB: Record<string, string> = {
  'bible-class': 'bibleClass',
  'sunday-school': 'sundaySchool',
  'cyc': 'cyc',
}

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ tab?: string[] }>
}) {
  const { tab: tabSegments } = await params
  const slug = tabSegments?.[0] || ''
  const activeTab = SLUG_TO_TAB[slug] || 'memorial'

  // Fetch data on the server (cached via unstable_cache + revalidateTag)
  const { events, hasOlder, lastUpdated } = await getScheduleData(activeTab)

  // Auth check for admin features (optional — page works without auth)
  let isAdmin = false
  try {
    const session = await auth()
    const role = (session?.user as any)?.role
    isAdmin = role === ROLES.ADMIN || role === ROLES.OWNER
  } catch {
    // Public page — auth failures are fine
  }

  return (
    <ScheduleClient
      activeTab={activeTab}
      initialEvents={events}
      initialHasOlder={hasOlder}
      lastUpdated={lastUpdated}
      isAdmin={isAdmin}
    />
  )
}
