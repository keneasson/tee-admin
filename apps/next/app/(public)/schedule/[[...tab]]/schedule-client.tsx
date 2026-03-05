'use client'

import { useCallback, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { YStack, XStack, Text, useThemeName, Spinner } from '@my/ui'
import { Button } from '@my/ui/src/Button'
import { EnhancedScheduleResponsive } from '@my/ui/src/data-table/enhanced-schedule-responsive'
import type { EnhancedScheduleEvent } from '@my/ui/src/data-table/enhanced-schedule-responsive'
import type { ScheduleTab } from '@my/ui/src/data-table/schedule-tabs'
import { brandColors } from '@my/ui/src/branding/brand-colors'
import { Wrapper } from '@my/app/provider/wrapper'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'

// Tab ID → URL slug
const TAB_TO_SLUG: Record<string, string> = {
  bibleClass: 'bible-class',
  sundaySchool: 'sunday-school',
  cyc: 'cyc',
}

const ALL_TABS: ScheduleTab[] = [
  { id: 'memorial', name: 'Memorial Service', key: 'memorial' },
  { id: 'bibleClass', name: 'Bible Class', key: 'bibleClass' },
  { id: 'sundaySchool', name: 'Sunday School', key: 'sundaySchool' },
  { id: 'cyc', name: 'CYC', key: 'cyc' },
]

interface ScheduleClientProps {
  activeTab: string
  initialEvents: EnhancedScheduleEvent[]
  initialHasOlder: boolean
  lastUpdated: string
  isAdmin: boolean
}

export function ScheduleClient({
  activeTab,
  initialEvents,
  initialHasOlder,
  lastUpdated,
  isAdmin,
}: ScheduleClientProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const isHydrated = useHydrated()
  const currentUser = session?.user?.email || null

  const themeName = useThemeName()
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]

  // Client-side state for "load older"
  const [olderEvents, setOlderEvents] = useState<EnhancedScheduleEvent[]>([])
  const [hasOlder, setHasOlder] = useState(initialHasOlder)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)

  // Apply user highlighting on the client (so server data stays cacheable)
  const events = useMemo(() => {
    const allEvents = [...olderEvents, ...initialEvents]
    // Deduplicate by id
    const seen = new Set<string>()
    const unique = allEvents.filter((e) => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
    unique.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    if (!currentUser) return unique

    const userPrefix = currentUser.split('@')[0].toLowerCase()
    return unique.map((event) => {
      const personValues = Object.values(event).filter(
        (v): v is string => typeof v === 'string' && v.length > 1
      )
      const userHighlight = personValues.some((v) =>
        v.toLowerCase().includes(userPrefix)
      )
      return { ...event, userHighlight }
    })
  }, [initialEvents, olderEvents, currentUser])

  const data = useMemo(() => ({ [activeTab]: events }), [activeTab, events])

  const handleTabChange = useCallback(
    (tabId: string) => {
      const slug = TAB_TO_SLUG[tabId]
      router.push(slug ? `/schedule/${slug}` : '/schedule')
    },
    [router]
  )

  const handleLoadOlder = useCallback(async () => {
    if (loadingOlder) return
    const allEvents = [...olderEvents, ...initialEvents]
    if (allEvents.length === 0) return

    const earliestDate = allEvents.reduce(
      (min, e) => (e.date < min ? e.date : min),
      allEvents[0].date
    )

    setLoadingOlder(true)
    try {
      const params = new URLSearchParams({
        types: activeTab,
        fromDate: '2020-01-01',
        toDate: earliestDate,
        limit: '10',
        sortOrder: 'desc',
        offset: '0',
      })
      const res = await fetch(`/api/enhanced-schedule?${params}`)
      if (res.ok) {
        const result = await res.json()
        const older = (result.data[activeTab] || []) as EnhancedScheduleEvent[]
        setOlderEvents((prev) => [...older, ...prev])
        setHasOlder(result.hasOlder || false)
      }
    } finally {
      setLoadingOlder(false)
    }
  }, [activeTab, initialEvents, olderEvents, loadingOlder])

  const handleClearCache = useCallback(async () => {
    setClearingCache(true)
    try {
      await fetch('/api/cache/invalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'all' }),
      })
      router.refresh()
    } finally {
      setClearingCache(false)
    }
  }, [router])

  if (!isHydrated) {
    return (
      <Wrapper subHeader="Ecclesial Programs">
        <Loading />
      </Wrapper>
    )
  }

  return (
    <Wrapper subHeader="Ecclesial Programs">
      <YStack flex={1} gap="$4">
        {/* Admin bar */}
        {isAdmin ? (
          <XStack
            justifyContent="space-between"
            alignItems="center"
            paddingHorizontal="$4"
            paddingVertical="$2"
            backgroundColor={colors.backgroundSecondary}
            borderRadius="$4"
          >
            <Text fontSize="$2" color={colors.textSecondary}>
              {events.length} events • Updated{' '}
              {new Date(lastUpdated).toLocaleTimeString()}
            </Text>
            <XStack gap="$2">
              <Button
                size="$2"
                variant="outlined"
                onPress={handleClearCache}
                disabled={clearingCache}
                borderColor={colors.warning}
              >
                {clearingCache ? 'Clearing...' : 'Clear Cache'}
              </Button>
              <Button
                size="$2"
                variant="outlined"
                onPress={() => router.refresh()}
              >
                Refresh
              </Button>
            </XStack>
          </XStack>
        ) : null}

        {/* Schedule table */}
        <EnhancedScheduleResponsive
          tabs={ALL_TABS}
          data={data}
          currentUser={currentUser || undefined}
          onTabChange={handleTabChange}
          activeTab={activeTab}
          hasOlder={hasOlder}
          onLoadOlder={handleLoadOlder}
          loading={loadingOlder}
        />
      </YStack>
    </Wrapper>
  )
}
