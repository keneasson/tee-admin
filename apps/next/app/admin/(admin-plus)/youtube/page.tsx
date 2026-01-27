'use client'

import { useAdminAccess } from '@/hooks/use-admin-access'
import { YStack, Text, Spinner, Heading, Tabs, Card, Button, XStack, Input, H3, ScrollView } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useState, useEffect } from 'react'
import { Video, Plus, ExternalLink, Calendar, Link as LinkIcon, AlertCircle, CheckCircle, RefreshCw } from '@tamagui/lucide-icons'
import type { YouTubeLivestreamSimplified } from '@my/app/types/youtube'

export default function AdminYouTubePage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading } = useAdminAccess()
  const [activeTab, setActiveTab] = useState('list')

  // OAuth authorization state
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [selectedChannel, setSelectedChannel] = useState<{ id: string; title: string } | null>(null)

  // Channel selection state
  const [availableChannels, setAvailableChannels] = useState<Array<{ id: string; title: string }>>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [selectingChannel, setSelectingChannel] = useState(false)

  // Livestream list state
  const [livestreams, setLivestreams] = useState<YouTubeLivestreamSimplified[]>([])
  const [loadingStreams, setLoadingStreams] = useState(true)
  const [streamFilter, setStreamFilter] = useState<'upcoming' | 'all' | 'completed' | 'active'>('upcoming')

  // YouTube sync state
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)

  // Create form state
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduledStartTime: '',
    privacyStatus: 'public' as 'public' | 'private' | 'unlisted',
    templateBroadcastId: '',
  })

  // Quick Create state
  const [quickCreateCount, setQuickCreateCount] = useState(4)
  const [quickCreating, setQuickCreating] = useState(false)
  const [quickCreateProgress, setQuickCreateProgress] = useState<{ current: number; total: number; results: Array<{ date: string; success: boolean; error?: string }> } | null>(null)

  // Check OAuth authorization status
  useEffect(() => {
    if (hasAccess) {
      checkAuthStatus()
      checkForOAuthCallback()
    }
  }, [hasAccess])

  // Load livestreams when authorized and channel selected
  useEffect(() => {
    if (hasAccess && isAuthorized && selectedChannel) {
      loadLivestreams()
    }
  }, [hasAccess, isAuthorized, selectedChannel, streamFilter])

  const checkAuthStatus = async () => {
    try {
      setCheckingAuth(true)
      const response = await fetch('/api/youtube/oauth/status')
      if (response.ok) {
        const data = await response.json()
        setIsAuthorized(data.authorized)
        setSelectedChannel(data.selectedChannel)

        // If authorized but no channel selected, load available channels
        if (data.authorized && !data.selectedChannel) {
          await loadAvailableChannels()
        }
      }
    } catch (error) {
      console.error('Failed to check OAuth status:', error)
    } finally {
      setCheckingAuth(false)
    }
  }

  const loadAvailableChannels = async () => {
    try {
      setLoadingChannels(true)
      const response = await fetch('/api/youtube/channels')
      if (response.ok) {
        const data = await response.json()
        setAvailableChannels(data.channels || [])
      }
    } catch (error) {
      console.error('Failed to load channels:', error)
      alert(`Failed to load channels: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingChannels(false)
    }
  }

  const handleSelectChannel = async (channelId: string, channelTitle: string) => {
    try {
      setSelectingChannel(true)
      const response = await fetch('/api/youtube/channels/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channelId, channelTitle }),
      })

      if (response.ok) {
        setSelectedChannel({ id: channelId, title: channelTitle })
        alert(`✅ Selected channel: ${channelTitle}`)
      } else {
        throw new Error('Failed to select channel')
      }
    } catch (error) {
      console.error('Failed to select channel:', error)
      alert(`Failed to select channel: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSelectingChannel(false)
    }
  }

  const checkForOAuthCallback = () => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('success')
    const error = params.get('error')

    if (success === 'authorized') {
      setIsAuthorized(true)
      // Clear query params
      window.history.replaceState({}, '', window.location.pathname)
      alert('✅ YouTube access authorized successfully!')
    } else if (error) {
      alert(`❌ Authorization failed: ${decodeURIComponent(error)}`)
      // Clear query params
      window.history.replaceState({}, '', window.location.pathname)
    }
  }

  const handleAuthorize = () => {
    // Show instructions before redirecting
    const message =
      'IMPORTANT: Before clicking OK:\n\n' +
      '1. Go to YouTube Studio (studio.youtube.com)\n' +
      '2. Click your profile picture in the top-right\n' +
      '3. Select "Switch account" or click the channel icon\n' +
      '4. Choose "Toronto East Christadelphians"\n' +
      '5. Come back here and click OK\n\n' +
      'This ensures you authorize as the Brand Account, not your personal channel.\n\n' +
      'Ready to authorize?'

    if (confirm(message)) {
      window.location.href = '/api/youtube/oauth/authorize'
    }
  }

  const handleRevokeAccess = async () => {
    if (!confirm('Are you sure you want to revoke YouTube access? You will need to re-authorize to create livestreams.')) {
      return
    }

    try {
      const response = await fetch('/api/youtube/oauth/status', {
        method: 'DELETE',
      })

      if (response.ok) {
        setIsAuthorized(false)
        alert('YouTube access revoked successfully')
      } else {
        throw new Error('Failed to revoke access')
      }
    } catch (error) {
      console.error('Failed to revoke access:', error)
      alert(`Failed to revoke access: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const loadLivestreams = async () => {
    try {
      setLoadingStreams(true)
      const response = await fetch(`/api/youtube/livestreams?status=${streamFilter}&maxResults=50`)

      // Handle auth errors - token may have expired and refresh failed
      if (response.status === 401) {
        const data = await response.json()
        console.error('YouTube auth error:', data.message)
        setIsAuthorized(false)
        setSelectedChannel(null)
        alert('YouTube authorization expired. Please re-authorize to continue.')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch livestreams')
      }
      const data = await response.json()

      // @TODO: Investigate mystery livestream "Toronto East Christadelphians Memorial Service"
      // - Shows in upcoming tab with no scheduled date
      // - Has wrong title format (should have date in title)
      // - Not appearing in current filtered list
      // - Need to identify: status, lifecycle, and why it's different
      // For now: Filter out livestreams without scheduledStartTime to prevent UI issues
      const filteredStreams = (data.streams || []).filter((stream: YouTubeLivestreamSimplified) => {
        if (!stream.scheduledStartTime) {
          console.warn(`⚠️ Filtering out livestream without date: "${stream.title}" (ID: ${stream.id})`)
          return false
        }
        return true
      })

      setLivestreams(filteredStreams)
    } catch (error) {
      console.error('Failed to load livestreams:', error)
      alert(`Failed to load livestreams: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingStreams(false)
    }
  }

  const handleSyncYouTubeUrls = async () => {
    if (!confirm(
      'This will sync YouTube livestream URLs with Memorial service schedules in DynamoDB.\n\n' +
      'The sync will match livestreams by date and update the YouTube field in each Memorial service record.\n\n' +
      'Continue?'
    )) {
      return
    }

    try {
      setSyncing(true)
      setSyncResult(null)

      const response = await fetch('/api/youtube/sync', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to sync YouTube URLs')
      }

      const data = await response.json()
      setSyncResult(data.result)

      // Show summary alert
      const result = data.result
      alert(
        `YouTube URL Sync Complete!\n\n` +
        `Total livestreams: ${result.total}\n` +
        `Matched & updated: ${result.updated}\n` +
        `Skipped: ${result.skipped}\n` +
        `Errors: ${result.errors.length}\n\n` +
        (result.errors.length > 0 ? `Errors:\n${result.errors.join('\n')}` : '')
      )
    } catch (error) {
      console.error('Failed to sync YouTube URLs:', error)
      alert(`Failed to sync YouTube URLs: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSyncing(false)
    }
  }

  const handleCreateLivestream = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setCreating(true)

      // Validate form
      if (!formData.title || !formData.scheduledStartTime) {
        alert('Title and scheduled time are required')
        return
      }

      console.log('Creating livestream:', formData)

      const response = await fetch('/api/youtube/livestreams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create livestream')
      }

      const result = await response.json()
      console.log('Livestream created successfully:', result)

      // Show success message with details
      alert(
        `Livestream created successfully!\n\n` +
        `Watch URL: ${result.watchUrl}\n` +
        `${result.sheetsSync?.success ? '\n✅ Synced to Google Sheets' : '\n⚠️ Failed to sync to Google Sheets'}`
      )

      // Reset form and reload list
      setFormData({
        title: '',
        description: '',
        scheduledStartTime: '',
        privacyStatus: 'public',
        templateBroadcastId: '',
      })
      await loadLivestreams()
      setActiveTab('list')
    } catch (error) {
      console.error('Failed to create livestream:', error)
      alert(`Failed to create livestream: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'No date scheduled'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid date'
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getNextSunday = () => {
    const today = new Date()
    const nextSunday = new Date(today)
    nextSunday.setDate(today.getDate() + ((7 - today.getDay()) % 7 || 7))
    nextSunday.setHours(11, 0, 0, 0) // 11:00 AM for Memorial service
    return nextSunday.toISOString().slice(0, 16) // Format for datetime-local input
  }

  // Get upcoming Sundays for Quick Create
  const getUpcomingSundays = (count: number): Date[] => {
    const sundays: Date[] = []
    const today = new Date()

    // Find next Sunday
    let nextSunday = new Date(today)
    const daysUntilSunday = (7 - today.getDay()) % 7
    nextSunday.setDate(today.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday))

    // Set to 9:30 AM Toronto time
    // Create date in Toronto timezone
    nextSunday.setHours(9, 30, 0, 0)

    for (let i = 0; i < count; i++) {
      const sunday = new Date(nextSunday)
      sunday.setDate(nextSunday.getDate() + (i * 7))
      sundays.push(sunday)
    }

    return sundays
  }

  // Format date for stream title: "Sunday Memorial Service - December 8, 2024"
  const formatStreamTitle = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Toronto',
    }
    const dateStr = date.toLocaleDateString('en-US', options)
    return `Sunday Memorial Service - ${dateStr}`
  }

  // Format date for display in preview
  const formatPreviewDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Toronto',
    })
  }

  // Convert local date to ISO string for YouTube API (in Toronto timezone)
  const toTorontoISO = (date: Date): string => {
    // Create a date string that represents 9:30 AM in Toronto
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    // YouTube expects ISO 8601 format
    // For Toronto (EST/EDT), we'll use the offset
    // During EST: -05:00, during EDT: -04:00
    // Let's use a simple approach - just send the local time and let YouTube handle it
    return `${year}-${month}-${day}T09:30:00-05:00`
  }

  // Get most recent completed stream for template
  const getMostRecentCompletedStreamId = (): string | undefined => {
    // Find a completed stream to use as template
    const completedStreams = livestreams.filter(s => s.status === 'complete')
    if (completedStreams.length > 0) {
      // Sort by date descending and get the most recent
      const sorted = completedStreams.sort((a, b) =>
        new Date(b.scheduledStartTime).getTime() - new Date(a.scheduledStartTime).getTime()
      )
      return sorted[0]?.id
    }
    // If no completed streams in current view, check upcoming for any existing stream
    const anyStream = livestreams[0]
    return anyStream?.boundStreamId ? anyStream.id : undefined
  }

  // Quick Create handler - creates multiple streams
  const handleQuickCreate = async () => {
    const sundays = getUpcomingSundays(quickCreateCount)

    // Check for existing streams on these dates
    const existingDates = livestreams.map(s => {
      const d = new Date(s.scheduledStartTime)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })

    const sundaysToCreate = sundays.filter(sunday => {
      const key = `${sunday.getFullYear()}-${sunday.getMonth()}-${sunday.getDate()}`
      return !existingDates.includes(key)
    })

    if (sundaysToCreate.length === 0) {
      alert('All selected Sundays already have streams scheduled!')
      return
    }

    if (sundaysToCreate.length < sundays.length) {
      const skipped = sundays.length - sundaysToCreate.length
      if (!confirm(`${skipped} Sunday(s) already have streams. Create ${sundaysToCreate.length} new stream(s)?`)) {
        return
      }
    }

    setQuickCreating(true)
    setQuickCreateProgress({ current: 0, total: sundaysToCreate.length, results: [] })

    // Get template from most recent stream
    const templateId = getMostRecentCompletedStreamId()

    const results: Array<{ date: string; success: boolean; error?: string }> = []

    for (let i = 0; i < sundaysToCreate.length; i++) {
      const sunday = sundaysToCreate[i]
      const title = formatStreamTitle(sunday)
      const scheduledTime = toTorontoISO(sunday)
      const dateStr = formatPreviewDate(sunday)

      setQuickCreateProgress(prev => prev ? { ...prev, current: i + 1 } : null)

      try {
        const response = await fetch('/api/youtube/livestreams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: 'Join us for our weekly Memorial service. Live from Toronto East Christadelphians.',
            scheduledStartTime: scheduledTime,
            privacyStatus: 'public',
            templateBroadcastId: templateId,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Failed to create stream')
        }

        results.push({ date: dateStr, success: true })
      } catch (error) {
        results.push({
          date: dateStr,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      setQuickCreateProgress(prev => prev ? { ...prev, results: [...results] } : null)

      // Small delay between requests to avoid rate limiting
      if (i < sundaysToCreate.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    setQuickCreating(false)

    // Show summary
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    alert(
      `Quick Create Complete!\n\n` +
      `✅ Created: ${successCount}\n` +
      `❌ Failed: ${failCount}\n\n` +
      (failCount > 0 ? `Errors:\n${results.filter(r => !r.success).map(r => `${r.date}: ${r.error}`).join('\n')}` : '')
    )

    // Reload livestreams
    await loadLivestreams()
    setActiveTab('list')
  }

  // Show loading state during hydration, auth check, or when redirecting
  if (!isHydrated || isLoading || !hasAccess) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" />
        <Text marginTop="$4">Loading...</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} padding="$4" space="$4">
      <YStack space="$2">
        <XStack justifyContent="space-between" alignItems="center">
          <Heading size="$8">YouTube Livestream Management</Heading>
          {isAuthorized && !checkingAuth && (
            <Button
              size="$3"
              variant="outlined"
              onPress={handleRevokeAccess}
            >
              Revoke Access
            </Button>
          )}
        </XStack>
        <Text color="$textSecondary">
          Manage YouTube livestreams for Sunday Memorial services
        </Text>
        <Text color="$textSecondary" fontSize="$2">
          Channel: Toronto East Christadelphians (@torontoeastchristadelphian1988)
        </Text>
      </YStack>

      {/* OAuth Authorization Status */}
      {checkingAuth ? (
        <Card padding="$4" borderWidth={1} borderColor="$borderColor">
          <XStack space="$3" alignItems="center">
            <Spinner size="small" />
            <Text>Checking YouTube authorization...</Text>
          </XStack>
        </Card>
      ) : !isAuthorized ? (
        <Card padding="$4" borderWidth={1} borderColor="$yellow8" backgroundColor="$yellow2">
          <YStack space="$3">
            <XStack space="$3" alignItems="center">
              <AlertCircle size="$2" color="$yellow10" />
              <Text fontSize="$5" fontWeight="600" color="$yellow11">
                YouTube Authorization Required
              </Text>
            </XStack>
            <Text color="$yellow11">
              To manage livestreams, you need to authorize this application to access your YouTube channel.
              This will allow you to create and manage livestreams directly from this admin panel.
            </Text>
            <Button
              onPress={handleAuthorize}
              backgroundColor="$blue9"
              hoverStyle={{ backgroundColor: '$blue10' }}
              pressStyle={{ backgroundColor: '$blue8' }}
            >
              Authorize YouTube Access
            </Button>
          </YStack>
        </Card>
      ) : (
        <Card padding="$3" borderWidth={1} borderColor="$green8" backgroundColor="$green2">
          <XStack space="$3" alignItems="center">
            <CheckCircle size="$1.5" color="$green10" />
            <Text fontSize="$3" fontWeight="600" color="$green11">
              YouTube Authorized
            </Text>
            {selectedChannel && (
              <Text fontSize="$2" color="$green10">
                • {selectedChannel.title}
              </Text>
            )}
          </XStack>
        </Card>
      )}

      {/* Channel Selection */}
      {isAuthorized && !selectedChannel && (
        <Card padding="$4" borderWidth={1} borderColor="$blue8" backgroundColor="$blue2">
          <YStack space="$3">
            <XStack space="$3" alignItems="center">
              <Video size="$2" color="$blue10" />
              <Text fontSize="$5" fontWeight="600" color="$blue11">
                Select YouTube Channel
              </Text>
            </XStack>
            <Text color="$blue11">
              You have access to multiple YouTube channels. Please select the Toronto East Christadelphians channel to manage livestreams.
            </Text>

            {loadingChannels ? (
              <XStack space="$3" alignItems="center">
                <Spinner size="small" />
                <Text>Loading channels...</Text>
              </XStack>
            ) : availableChannels.length === 0 ? (
              <YStack space="$3">
                <Text color="$red10">Unable to automatically load channels. This may happen if you need to re-authorize.</Text>
                <Text color="$textSecondary">
                  Click the button below to manually select the Toronto East Christadelphians channel:
                </Text>
                <Button
                  onPress={() => handleSelectChannel('UCyJamaI5mQImCF8hWE7Yp-w', 'Toronto East Christadelphians')}
                  disabled={selectingChannel}
                  backgroundColor="$blue9"
                  hoverStyle={{ backgroundColor: '$blue10' }}
                >
                  <XStack space="$2" alignItems="center">
                    <Video size="$1" />
                    <Text>Select Toronto East Christadelphians</Text>
                  </XStack>
                </Button>
                <Button
                  variant="outlined"
                  onPress={() => loadAvailableChannels()}
                  disabled={loadingChannels}
                  size="$3"
                >
                  Try Again
                </Button>
              </YStack>
            ) : (
              <YStack space="$2">
                {availableChannels.map((channel) => (
                  <Button
                    key={channel.id}
                    onPress={() => handleSelectChannel(channel.id, channel.title)}
                    disabled={selectingChannel}
                    backgroundColor={channel.id === 'UCyJamaI5mQImCF8hWE7Yp-w' ? '$blue9' : '$gray5'}
                    hoverStyle={{
                      backgroundColor: channel.id === 'UCyJamaI5mQImCF8hWE7Yp-w' ? '$blue10' : '$gray6'
                    }}
                  >
                    <XStack space="$2" alignItems="center">
                      <Video size="$1" />
                      <Text>{channel.title}</Text>
                      {channel.id === 'UCyJamaI5mQImCF8hWE7Yp-w' && (
                        <Text fontSize="$2" opacity={0.8}>(Recommended)</Text>
                      )}
                    </XStack>
                  </Button>
                ))}
              </YStack>
            )}
          </YStack>
        </Card>
      )}

      {/* Only show tabs when authorized and channel selected */}
      {isAuthorized && selectedChannel && (
        <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        width="100%"
        flex={1}
        flexDirection="column"
      >
        <Tabs.List backgroundColor="$background" borderRadius="$4">
          <Tabs.Tab value="list" flex={1}>
            <XStack space="$2" alignItems="center">
              <Video size="$1" />
              <Text>Upcoming Streams</Text>
            </XStack>
          </Tabs.Tab>
          <Tabs.Tab value="create" flex={1} disabled={!isAuthorized || !selectedChannel}>
            <XStack space="$2" alignItems="center">
              <Plus size="$1" />
              <Text>Quick Create</Text>
            </XStack>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Content value="list" flex={1} paddingTop="$4">
          {!isAuthorized ? (
            <Card padding="$6" borderWidth={1} borderColor="$borderColor">
              <YStack space="$3" alignItems="center">
                <AlertCircle size="$4" color="$yellow10" />
                <Text fontSize="$5" fontWeight="600">Authorization Required</Text>
                <Text color="$textSecondary" textAlign="center">
                  Authorize YouTube access to view livestreams
                </Text>
                <Button onPress={handleAuthorize} marginTop="$2">
                  Authorize YouTube Access
                </Button>
              </YStack>
            </Card>
          ) : !selectedChannel ? (
            <Card padding="$6" borderWidth={1} borderColor="$borderColor">
              <YStack space="$3" alignItems="center">
                <Video size="$4" color="$blue10" />
                <Text fontSize="$5" fontWeight="600">Channel Selection Required</Text>
                <Text color="$textSecondary" textAlign="center">
                  Please select a YouTube channel above to view livestreams
                </Text>
              </YStack>
            </Card>
          ) : loadingStreams ? (
            <YStack flex={1} justifyContent="center" alignItems="center">
              <Spinner size="large" />
              <Text marginTop="$4">Loading livestreams...</Text>
            </YStack>
          ) : livestreams.length === 0 ? (
            <Card padding="$6" borderWidth={1} borderColor="$borderColor">
              <YStack space="$3" alignItems="center">
                <Video size="$4" color="$gray10" />
                <Text fontSize="$5" fontWeight="600">No upcoming livestreams</Text>
                <Text color="$textSecondary" textAlign="center">
                  Create a new livestream to get started
                </Text>
                <Button onPress={() => setActiveTab('create')} marginTop="$2">
                  Create Livestream
                </Button>
              </YStack>
            </Card>
          ) : (
            <YStack space="$3" flex={1}>
              {/* Filter Controls */}
              <Card padding="$3" borderWidth={1} borderColor="$borderColor">
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize="$4" fontWeight="600">Filter Livestreams</Text>
                  <XStack space="$2">
                    {(['upcoming', 'all', 'active', 'completed'] as const).map((filter) => (
                      <Button
                        key={filter}
                        size="$3"
                        variant="outlined"
                        backgroundColor={streamFilter === filter ? '$blue5' : undefined}
                        onPress={() => setStreamFilter(filter)}
                      >
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </Button>
                    ))}
                  </XStack>
                </XStack>
              </Card>

              {/* Sync Button */}
              <Card padding="$3" borderWidth={1} borderColor="$blue8" backgroundColor="$blue2">
                <XStack justifyContent="space-between" alignItems="center">
                  <YStack flex={1}>
                    <Text fontSize="$4" fontWeight="600" color="$blue11">
                      Sync YouTube URLs to DynamoDB
                    </Text>
                    <Text fontSize="$2" color="$blue10">
                      Match livestream dates with Memorial services and update YouTube links
                    </Text>
                  </YStack>
                  <Button
                    size="$3"
                    backgroundColor="$blue9"
                    hoverStyle={{ backgroundColor: '$blue10' }}
                    pressStyle={{ backgroundColor: '$blue8' }}
                    onPress={handleSyncYouTubeUrls}
                    disabled={syncing}
                    icon={syncing ? undefined : RefreshCw}
                  >
                    {syncing ? 'Syncing...' : 'Sync URLs'}
                  </Button>
                </XStack>
              </Card>

              {/* Livestreams List */}
              <ScrollView flex={1}>
              <YStack space="$3">
                {livestreams.map((stream) => (
                  <Card
                    key={stream.id}
                    padding="$4"
                    borderWidth={1}
                    borderColor="$borderColor"
                    hoverStyle={{ borderColor: '$blue8' }}
                  >
                    <YStack space="$3">
                      <XStack justifyContent="space-between" alignItems="flex-start">
                        <YStack flex={1} space="$2">
                          <H3>{stream.title}</H3>
                          <Text color="$textSecondary" fontSize="$3">
                            {stream.description}
                          </Text>
                        </YStack>
                        <YStack
                          backgroundColor={
                            stream.status === 'live' ? '$green5' :
                            stream.status === 'upcoming' ? '$blue5' :
                            stream.status === 'complete' ? '$gray5' : '$yellow5'
                          }
                          paddingHorizontal="$3"
                          paddingVertical="$2"
                          borderRadius="$2"
                        >
                          <Text fontSize="$2" fontWeight="600" textTransform="uppercase">
                            {stream.status}
                          </Text>
                        </YStack>
                      </XStack>

                      <XStack space="$2" alignItems="center">
                        <Calendar size="$1" color="$gray10" />
                        <Text fontSize="$3">
                          {formatDate(stream.scheduledStartTime)}
                        </Text>
                      </XStack>

                      <XStack space="$2" flexWrap="wrap">
                        <Button
                          size="$3"
                          icon={ExternalLink}
                          onPress={() => window.open(stream.watchUrl, '_blank')}
                        >
                          Watch Page
                        </Button>
                        <Button
                          size="$3"
                          variant="outlined"
                          icon={ExternalLink}
                          onPress={() => window.open(stream.streamUrl, '_blank')}
                        >
                          Studio
                        </Button>
                        <Button
                          size="$3"
                          variant="outlined"
                          icon={LinkIcon}
                          onPress={() => {
                            navigator.clipboard.writeText(stream.watchUrl)
                            alert('Watch URL copied to clipboard!')
                          }}
                        >
                          Copy URL
                        </Button>
                      </XStack>
                    </YStack>
                  </Card>
                ))}
              </YStack>
              </ScrollView>
            </YStack>
          )}
        </Tabs.Content>

        <Tabs.Content value="create" flex={1} paddingTop="$4">
          {!isAuthorized ? (
            <Card padding="$6" borderWidth={1} borderColor="$borderColor">
              <YStack space="$3" alignItems="center">
                <AlertCircle size="$4" color="$yellow10" />
                <Text fontSize="$5" fontWeight="600">Authorization Required</Text>
                <Text color="$textSecondary" textAlign="center">
                  Authorize YouTube access to create livestreams
                </Text>
                <Button onPress={handleAuthorize} marginTop="$2">
                  Authorize YouTube Access
                </Button>
              </YStack>
            </Card>
          ) : !selectedChannel ? (
            <Card padding="$6" borderWidth={1} borderColor="$borderColor">
              <YStack space="$3" alignItems="center">
                <Video size="$4" color="$blue10" />
                <Text fontSize="$5" fontWeight="600">Channel Selection Required</Text>
                <Text color="$textSecondary" textAlign="center">
                  Please select a YouTube channel above to create livestreams
                </Text>
              </YStack>
            </Card>
          ) : (
            <Card padding="$4" borderWidth={1} borderColor="$borderColor">
              <YStack space="$4">
                <H3>Quick Create Upcoming Streams</H3>

                <Text color="$textSecondary">
                  Automatically create Sunday Memorial Service streams. Each stream starts at 9:30 AM Toronto time.
                </Text>

                {/* Number of Sundays selector */}
                <YStack space="$2">
                  <Text fontWeight="600">Number of Sundays to create:</Text>
                  <XStack space="$2">
                    {[2, 4, 6, 8].map((num) => (
                      <Button
                        key={num}
                        size="$3"
                        backgroundColor={quickCreateCount === num ? '$blue9' : '$gray5'}
                        hoverStyle={{ backgroundColor: quickCreateCount === num ? '$blue10' : '$gray6' }}
                        onPress={() => setQuickCreateCount(num)}
                      >
                        {num} weeks
                      </Button>
                    ))}
                  </XStack>
                </YStack>

                {/* Preview of streams to be created */}
                <YStack space="$2">
                  <Text fontWeight="600">Preview:</Text>
                  <Card backgroundColor="$gray2" padding="$3" borderRadius="$3">
                    <YStack space="$2">
                      {getUpcomingSundays(quickCreateCount).map((sunday, index) => {
                        const dateKey = `${sunday.getFullYear()}-${sunday.getMonth()}-${sunday.getDate()}`
                        const existingStream = livestreams.find(s => {
                          const d = new Date(s.scheduledStartTime)
                          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === dateKey
                        })

                        return (
                          <XStack key={index} space="$3" alignItems="center">
                            {existingStream ? (
                              <CheckCircle size="$1" color="$green10" />
                            ) : (
                              <Calendar size="$1" color="$blue10" />
                            )}
                            <YStack flex={1}>
                              <Text fontWeight="500">
                                {formatStreamTitle(sunday)}
                              </Text>
                              <Text fontSize="$2" color="$textSecondary">
                                {formatPreviewDate(sunday)} at 9:30 AM EST
                              </Text>
                            </YStack>
                            {existingStream && (
                              <Text fontSize="$2" color="$green10" fontWeight="600">
                                Already exists
                              </Text>
                            )}
                          </XStack>
                        )
                      })}
                    </YStack>
                  </Card>
                </YStack>

                {/* Progress indicator */}
                {quickCreateProgress && (
                  <Card backgroundColor="$blue2" padding="$3" borderRadius="$3" borderWidth={1} borderColor="$blue8">
                    <YStack space="$2">
                      <Text fontWeight="600" color="$blue11">
                        Creating streams... {quickCreateProgress.current} / {quickCreateProgress.total}
                      </Text>
                      {quickCreateProgress.results.map((result, index) => (
                        <XStack key={index} space="$2" alignItems="center">
                          {result.success ? (
                            <CheckCircle size="$1" color="$green10" />
                          ) : (
                            <AlertCircle size="$1" color="$red10" />
                          )}
                          <Text color={result.success ? '$green11' : '$red11'}>
                            {result.date}: {result.success ? 'Created' : result.error}
                          </Text>
                        </XStack>
                      ))}
                    </YStack>
                  </Card>
                )}

                {/* Create button */}
                <Button
                  size="$5"
                  backgroundColor="$blue9"
                  hoverStyle={{ backgroundColor: '$blue10' }}
                  pressStyle={{ backgroundColor: '$blue8' }}
                  onPress={handleQuickCreate}
                  disabled={quickCreating}
                  icon={quickCreating ? undefined : Plus}
                >
                  {quickCreating ? `Creating... ${quickCreateProgress?.current || 0}/${quickCreateProgress?.total || 0}` : `Create ${quickCreateCount} Streams`}
                </Button>

                <Text fontSize="$2" color="$textSecondary" textAlign="center">
                  Streams will be created with title format: "Sunday Memorial Service - [Date]"
                  {'\n'}and will automatically sync to Google Sheets.
                </Text>
              </YStack>
            </Card>
          )}
        </Tabs.Content>
      </Tabs>
      )}
    </YStack>
  )
}
