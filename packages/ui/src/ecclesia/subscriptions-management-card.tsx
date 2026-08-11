import { useMemo, useState } from 'react'
import {
  YStack,
  XStack,
  Text,
  Card,
  Separator,
  Select,
  Adapt,
  Sheet,
  Spinner,
} from '@my/ui'
import { Button } from '../Button'
import { Bell, BellRing, BellOff, X, Plus, Users } from '@tamagui/lucide-icons'

export type NotificationPref = 'all' | 'major' | 'none'

export interface SubscriptionSummary {
  publisherEcclesia: string
  publisherDisplayName?: string
  notificationPref: NotificationPref
  createdAt: string
}

export interface EcclesiaOption {
  name: string
  displayName?: string
}

export interface SubscriptionsManagementCardProps {
  ecclesiaName: string
  subscriptions: SubscriptionSummary[]
  availableEcclesias: EcclesiaOption[]
  canEdit: boolean
  loading?: boolean
  onSubscribe: (publisher: string, pref: NotificationPref) => Promise<void>
  onUnsubscribe: (publisher: string) => Promise<void>
  onUpdatePref: (publisher: string, pref: NotificationPref) => Promise<void>
}

interface PrefOption {
  value: NotificationPref
  label: string
  description: string
  Icon: typeof Bell
  iconColor: string
}

const PREF_OPTIONS: PrefOption[] = [
  {
    value: 'all',
    label: 'All events',
    description: 'Every event from this ecclesia',
    Icon: BellRing,
    iconColor: '$green10',
  },
  {
    value: 'major',
    label: 'Major only',
    description: 'Study weekends, funerals, baptisms, weddings',
    Icon: Bell,
    iconColor: '$orange10',
  },
  {
    value: 'none',
    label: 'Silent',
    description: 'Subscribed but no notifications',
    Icon: BellOff,
    iconColor: '$gray10',
  },
]

function prefMeta(pref: NotificationPref): PrefOption {
  return PREF_OPTIONS.find((o) => o.value === pref) ?? PREF_OPTIONS[0]
}

export function SubscriptionsManagementCard({
  ecclesiaName,
  subscriptions,
  availableEcclesias,
  canEdit,
  loading = false,
  onSubscribe,
  onUnsubscribe,
  onUpdatePref,
}: SubscriptionsManagementCardProps) {
  // Per-row saving state (keyed by publisher name)
  const [rowSaving, setRowSaving] = useState<Record<string, boolean>>({})

  // Add-subscription form state
  const [newPublisher, setNewPublisher] = useState<string>('')
  const [newPref, setNewPref] = useState<NotificationPref>('all')
  const [adding, setAdding] = useState(false)

  const subscribedNames = useMemo(
    () => new Set(subscriptions.map((s) => s.publisherEcclesia)),
    [subscriptions]
  )

  const addableEcclesias = useMemo(
    () =>
      availableEcclesias.filter(
        (e) => e.name !== ecclesiaName && !subscribedNames.has(e.name)
      ),
    [availableEcclesias, ecclesiaName, subscribedNames]
  )

  const setRowBusy = (publisher: string, busy: boolean) => {
    setRowSaving((prev) => ({ ...prev, [publisher]: busy }))
  }

  const handlePrefChange = async (publisher: string, pref: NotificationPref) => {
    setRowBusy(publisher, true)
    try {
      await onUpdatePref(publisher, pref)
    } finally {
      setRowBusy(publisher, false)
    }
  }

  const handleUnsubscribe = async (publisher: string) => {
    setRowBusy(publisher, true)
    try {
      await onUnsubscribe(publisher)
    } finally {
      setRowBusy(publisher, false)
    }
  }

  const handleAdd = async () => {
    if (!newPublisher) return
    setAdding(true)
    try {
      await onSubscribe(newPublisher, newPref)
      setNewPublisher('')
      setNewPref('all')
    } finally {
      setAdding(false)
    }
  }

  return (
    <Card padding="$4" borderWidth={1} borderColor="$borderColor">
      <YStack gap="$3">
        {/* Header */}
        <XStack justifyContent="space-between" alignItems="center">
          <XStack gap="$2" alignItems="center">
            <Users size={20} color="$blue10" />
            <Text fontSize="$5" fontWeight="600">
              Event Subscriptions
            </Text>
            <XStack
              backgroundColor="$blue3"
              paddingHorizontal="$2"
              paddingVertical="$1"
              borderRadius="$10"
              minWidth={24}
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize="$2" fontWeight="700" color="$blue11">
                {subscriptions.length}
              </Text>
            </XStack>
          </XStack>
        </XStack>

        <Text fontSize="$2" theme="alt2">
          Subscribe to other ecclesias to include their events in your feed and newsletter.
        </Text>

        {loading ? (
          <XStack justifyContent="center" padding="$4" gap="$2" alignItems="center">
            <Spinner size="small" width={20} height={20} />
            <Text fontSize="$3" theme="alt2">
              Loading subscriptions...
            </Text>
          </XStack>
        ) : null}

        {/* Existing subscriptions list */}
        {!loading && subscriptions.length === 0 ? (
          <Card padding="$3" backgroundColor="$gray2" borderWidth={0}>
            <Text fontSize="$3" theme="alt2" textAlign="center">
              Not subscribed to any ecclesias yet.
            </Text>
          </Card>
        ) : null}

        {!loading && subscriptions.length > 0 ? (
          <YStack gap="$2">
            {subscriptions.map((sub) => {
              const meta = prefMeta(sub.notificationPref)
              const PrefIcon = meta.Icon
              const busy = !!rowSaving[sub.publisherEcclesia]
              const displayName = sub.publisherDisplayName || sub.publisherEcclesia

              return (
                <Card
                  key={sub.publisherEcclesia}
                  padding="$3"
                  borderWidth={1}
                  borderColor="$borderColor"
                >
                  <XStack gap="$3" alignItems="center" flexWrap="wrap">
                    <XStack gap="$2" alignItems="center" flex={1} minWidth={160}>
                      <PrefIcon size={16} color={meta.iconColor} />
                      <YStack flex={1}>
                        <Text fontSize="$4" fontWeight="600">
                          {displayName}
                        </Text>
                        <Text fontSize="$1" theme="alt2">
                          {meta.description}
                        </Text>
                      </YStack>
                    </XStack>

                    {canEdit ? (
                      <XStack gap="$2" alignItems="center">
                        <Select
                          value={sub.notificationPref}
                          onValueChange={(val) =>
                            handlePrefChange(
                              sub.publisherEcclesia,
                              val as NotificationPref
                            )
                          }
                          disabled={busy}
                        >
                          <Select.Trigger width={150} disabled={busy}>
                            <Select.Value />
                          </Select.Trigger>
                          <Adapt when="sm" platform="touch">
                            <Sheet modal dismissOnSnapToBottom snapPointsMode="fit">
                              <Sheet.Frame>
                                <Sheet.ScrollView>
                                  <Adapt.Contents />
                                </Sheet.ScrollView>
                              </Sheet.Frame>
                              <Sheet.Overlay />
                            </Sheet>
                          </Adapt>
                          <Select.Content>
                            <Select.Viewport>
                              {PREF_OPTIONS.map((opt, i) => (
                                <Select.Item key={opt.value} index={i} value={opt.value}>
                                  <Select.ItemText>{opt.label}</Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.Viewport>
                          </Select.Content>
                        </Select>

                        <Button
                          size="$2"
                          icon={
                            busy ? (
                              <Spinner size="small" width={16} height={16} />
                            ) : (
                              X
                            )
                          }
                          backgroundColor="$red4"
                          color="$red11"
                          borderColor="$red8"
                          borderWidth={1}
                          hoverStyle={{ backgroundColor: '$red5', borderColor: '$red9' }}
                          pressStyle={{ backgroundColor: '$red6' }}
                          onPress={() => handleUnsubscribe(sub.publisherEcclesia)}
                          disabled={busy}
                          aria-label={`Unsubscribe from ${displayName}`}
                        >
                          Unsubscribe
                        </Button>
                      </XStack>
                    ) : (
                      <Text fontSize="$3" theme="alt2">
                        {meta.label}
                      </Text>
                    )}
                  </XStack>
                </Card>
              )
            })}
          </YStack>
        ) : null}

        {/* Add-subscription form */}
        {canEdit ? (
          <>
            <Separator />
            <YStack gap="$2">
              <XStack gap="$2" alignItems="center">
                <Plus size={16} color="$blue10" />
                <Text fontSize="$4" fontWeight="600">
                  Add Subscription
                </Text>
              </XStack>

              {addableEcclesias.length === 0 ? (
                <Text fontSize="$3" theme="alt2">
                  No other ecclesias available to subscribe to.
                </Text>
              ) : (
                <YStack gap="$2">
                  <XStack gap="$2" alignItems="center" flexWrap="wrap">
                    <YStack flex={1} minWidth={200} gap="$1">
                      <Text fontSize="$2" theme="alt2">
                        Ecclesia
                      </Text>
                      <Select
                        value={newPublisher}
                        onValueChange={(val) => setNewPublisher(val)}
                        disabled={adding}
                      >
                        <Select.Trigger disabled={adding}>
                          <Select.Value placeholder="Select an ecclesia..." />
                        </Select.Trigger>
                        <Adapt when="sm" platform="touch">
                          <Sheet modal dismissOnSnapToBottom snapPointsMode="fit">
                            <Sheet.Frame>
                              <Sheet.ScrollView>
                                <Adapt.Contents />
                              </Sheet.ScrollView>
                            </Sheet.Frame>
                            <Sheet.Overlay />
                          </Sheet>
                        </Adapt>
                        <Select.Content>
                          <Select.Viewport>
                            {addableEcclesias.map((e, i) => (
                              <Select.Item key={e.name} index={i} value={e.name}>
                                <Select.ItemText>
                                  {e.displayName || e.name}
                                </Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select>
                    </YStack>

                    <YStack minWidth={160} gap="$1">
                      <Text fontSize="$2" theme="alt2">
                        Notifications
                      </Text>
                      <Select
                        value={newPref}
                        onValueChange={(val) => setNewPref(val as NotificationPref)}
                        disabled={adding}
                      >
                        <Select.Trigger disabled={adding}>
                          <Select.Value />
                        </Select.Trigger>
                        <Adapt when="sm" platform="touch">
                          <Sheet modal dismissOnSnapToBottom snapPointsMode="fit">
                            <Sheet.Frame>
                              <Sheet.ScrollView>
                                <Adapt.Contents />
                              </Sheet.ScrollView>
                            </Sheet.Frame>
                            <Sheet.Overlay />
                          </Sheet>
                        </Adapt>
                        <Select.Content>
                          <Select.Viewport>
                            {PREF_OPTIONS.map((opt, i) => (
                              <Select.Item key={opt.value} index={i} value={opt.value}>
                                <Select.ItemText>{opt.label}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select>
                    </YStack>
                  </XStack>

                  <XStack justifyContent="flex-end">
                    <Button
                      size="$3"
                      icon={
                        adding ? (
                          <Spinner size="small" width={16} height={16} />
                        ) : (
                          Plus
                        )
                      }
                      variant="action"
                      onPress={handleAdd}
                      disabled={adding || !newPublisher}
                    >
                      {adding ? 'Subscribing...' : 'Add'}
                    </Button>
                  </XStack>
                </YStack>
              )}
            </YStack>
          </>
        ) : null}
      </YStack>
    </Card>
  )
}
