import { useState, useEffect, useCallback } from 'react'
import { YStack, XStack, Text, Card, Separator, Spinner } from '@my/ui'
import { Button } from '../Button'
import { Bell, BellOff, Plus, Trash, RefreshCw, Church } from '@tamagui/lucide-icons'

interface Subscription {
  publisherEcclesia: string
  notificationPref: 'all' | 'major' | 'none'
  subscribedBy: string
  createdAt: string
}

interface EcclesiaOption {
  name: string
  city?: string
}

interface SubscriptionManagerProps {
  ecclesiaName: string
  canManage: boolean
}

const NOTIFICATION_OPTIONS: { value: 'all' | 'major' | 'none'; label: string; description: string }[] = [
  { value: 'all', label: 'All events', description: 'Every event from this ecclesia' },
  { value: 'major', label: 'Major only', description: 'Study weekends, funerals, baptisms, weddings' },
  { value: 'none', label: 'Silent', description: 'Subscribed but no notifications' },
]

export function SubscriptionManager({ ecclesiaName, canManage }: SubscriptionManagerProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [availableEcclesias, setAvailableEcclesias] = useState<EcclesiaOption[]>([])
  const [loadingEcclesias, setLoadingEcclesias] = useState(false)

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ecclesia/${encodeURIComponent(ecclesiaName)}/subscriptions`)
      if (res.ok) {
        const data = await res.json()
        setSubscriptions(data.subscriptions || [])
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to load subscriptions')
      }
    } catch {
      setError('Failed to load subscriptions')
    } finally {
      setLoading(false)
    }
  }, [ecclesiaName])

  useEffect(() => {
    fetchSubscriptions()
  }, [fetchSubscriptions])

  const fetchAvailableEcclesias = async () => {
    setLoadingEcclesias(true)
    try {
      const res = await fetch('/api/admin/ecclesias')
      if (res.ok) {
        const data = await res.json()
        const all: EcclesiaOption[] = (data.ecclesias || []).map((e: any) => ({
          name: e.name,
          city: e.city,
        }))
        // Filter out self and already subscribed
        const subscribedNames = new Set(subscriptions.map((s) => s.publisherEcclesia))
        setAvailableEcclesias(all.filter((e) => e.name !== ecclesiaName && !subscribedNames.has(e.name)))
      }
    } catch {
      // ignore
    } finally {
      setLoadingEcclesias(false)
    }
  }

  const handleSubscribe = async (publisherEcclesia: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/ecclesia/${encodeURIComponent(ecclesiaName)}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publisherEcclesia }),
      })
      if (res.ok) {
        setShowAddForm(false)
        await fetchSubscriptions()
      } else {
        const data = await res.json()
        setError(data.error || 'Subscribe failed')
      }
    } catch {
      setError('Subscribe failed')
    } finally {
      setSaving(false)
    }
  }

  const handleUnsubscribe = async (publisherEcclesia: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/ecclesia/${encodeURIComponent(ecclesiaName)}/subscriptions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publisherEcclesia }),
      })
      if (res.ok) {
        await fetchSubscriptions()
      } else {
        const data = await res.json()
        setError(data.error || 'Unsubscribe failed')
      }
    } catch {
      setError('Unsubscribe failed')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePref = async (publisherEcclesia: string, notificationPref: 'all' | 'major' | 'none') => {
    setSaving(true)
    try {
      const res = await fetch(`/api/ecclesia/${encodeURIComponent(ecclesiaName)}/subscriptions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publisherEcclesia, notificationPref }),
      })
      if (res.ok) {
        await fetchSubscriptions()
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card padding="$4" borderWidth={1} borderColor="$borderColor">
        <XStack justifyContent="center" padding="$4" gap="$2">
          <Spinner size="small" width={20} height={20} />
          <Text fontSize="$3" theme="alt2">Loading subscriptions...</Text>
        </XStack>
      </Card>
    )
  }

  return (
    <Card padding="$4" borderWidth={1} borderColor="$borderColor">
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <XStack gap="$2" alignItems="center">
            <Bell size={16} color="$blue10" />
            <Text fontSize="$5" fontWeight="600">Event Subscriptions</Text>
          </XStack>
          <XStack gap="$2">
            <Button size="$2" icon={RefreshCw} variant="outlined" onPress={fetchSubscriptions} disabled={saving}>
              Refresh
            </Button>
            {canManage ? (
              <Button
                size="$2"
                icon={Plus}
                theme="blue"
                onPress={() => {
                  fetchAvailableEcclesias()
                  setShowAddForm(true)
                }}
                disabled={saving}
              >
                Subscribe
              </Button>
            ) : null}
          </XStack>
        </XStack>

        <Text fontSize="$2" theme="alt2">
          Subscribe to other ecclesias to see their events in your feed and newsletter.
        </Text>

        {error ? (
          <XStack backgroundColor="$red2" padding="$2" borderRadius="$2" gap="$2" alignItems="center">
            <Text fontSize="$3" color="$red10">{error}</Text>
            <Button size="$2" variant="outlined" onPress={() => setError(null)} marginLeft="auto">
              Dismiss
            </Button>
          </XStack>
        ) : null}

        {/* Add subscription form */}
        {showAddForm ? (
          <Card padding="$3" borderWidth={2} borderColor="$blue8" backgroundColor="$blue1">
            <YStack gap="$2">
              <Text fontSize="$4" fontWeight="600">Subscribe to Ecclesia</Text>
              {loadingEcclesias ? (
                <XStack justifyContent="center" padding="$3" gap="$2">
                  <Spinner size="small" width={20} height={20} />
                  <Text fontSize="$3" theme="alt2">Loading...</Text>
                </XStack>
              ) : availableEcclesias.length === 0 ? (
                <Text fontSize="$3" theme="alt2">No other ecclesias available to subscribe to.</Text>
              ) : (
                <YStack gap="$1">
                  {availableEcclesias.map((e) => (
                    <XStack key={e.name} gap="$2" alignItems="center" padding="$2" borderRadius="$2" hoverStyle={{ backgroundColor: '$blue2' }}>
                      <Church size={14} color="$gray10" />
                      <YStack flex={1}>
                        <Text fontSize="$3" fontWeight="600">{e.name}</Text>
                        {e.city ? <Text fontSize="$2" theme="alt2">{e.city}</Text> : null}
                      </YStack>
                      <Button size="$2" theme="blue" onPress={() => handleSubscribe(e.name)} disabled={saving}>
                        Subscribe
                      </Button>
                    </XStack>
                  ))}
                </YStack>
              )}
              <Button size="$2" variant="outlined" onPress={() => setShowAddForm(false)} alignSelf="flex-end">
                Cancel
              </Button>
            </YStack>
          </Card>
        ) : null}

        {/* Subscription list */}
        {subscriptions.length === 0 ? (
          <Text fontSize="$3" theme="alt2" textAlign="center" padding="$3">
            No subscriptions yet. Subscribe to other ecclesias to see their events.
          </Text>
        ) : null}

        {subscriptions.map((sub) => (
          <Card key={sub.publisherEcclesia} padding="$3" borderWidth={1} borderColor="$borderColor">
            <YStack gap="$2">
              <XStack justifyContent="space-between" alignItems="center">
                <XStack gap="$2" alignItems="center">
                  <Church size={16} color="$blue10" />
                  <Text fontSize="$4" fontWeight="600">{sub.publisherEcclesia}</Text>
                </XStack>
                {canManage ? (
                  <Button
                    size="$2"
                    icon={Trash}
                    theme="red"
                    variant="outlined"
                    onPress={() => handleUnsubscribe(sub.publisherEcclesia)}
                    disabled={saving}
                  >
                    Unsubscribe
                  </Button>
                ) : null}
              </XStack>

              {canManage ? (
                <>
                  <Separator />
                  <XStack gap="$2" flexWrap="wrap">
                    {NOTIFICATION_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        size="$2"
                        variant={sub.notificationPref === opt.value ? undefined : 'outlined'}
                        theme={sub.notificationPref === opt.value ? 'blue' : undefined}
                        icon={opt.value === 'none' ? BellOff : Bell}
                        onPress={() => handleUpdatePref(sub.publisherEcclesia, opt.value)}
                        disabled={saving}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </XStack>
                </>
              ) : (
                <NotificationBadge pref={sub.notificationPref} />
              )}
            </YStack>
          </Card>
        ))}
      </YStack>
    </Card>
  )
}

function NotificationBadge({ pref }: { pref: string }) {
  const labels: Record<string, { label: string; bg: string; text: string }> = {
    all: { label: 'All events', bg: '$green2', text: '$green11' },
    major: { label: 'Major only', bg: '$orange2', text: '$orange11' },
    none: { label: 'Silent', bg: '$gray3', text: '$gray11' },
  }
  const info = labels[pref] || labels.all
  return (
    <XStack backgroundColor={info.bg} paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2" alignSelf="flex-start">
      <Text fontSize="$2" fontWeight="600" color={info.text}>{info.label}</Text>
    </XStack>
  )
}
