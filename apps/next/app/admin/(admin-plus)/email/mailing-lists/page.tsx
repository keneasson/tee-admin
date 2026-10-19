'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAdminAccess } from '@/hooks/use-admin-access'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { YStack, XStack, Text, Heading, Spinner, Card, Input, Paragraph, Checkbox } from 'tamagui'
import { Button } from '@my/ui'
import { Check } from '@tamagui/lucide-icons'

type Owner = { ownerType: 'ecclesia' | 'organization'; ownerId: string; name: string }
type Option = { id: string; label: string }
type ListRow = {
  listId: string
  displayName: string
  description: string
  category: string
  scope: string
  scopeValue: string
  defaultOptIn: boolean
  status: string
  sesTopic: string | null
  sendFromRegistry: boolean
  subscribers: number
}
type Data = { lists: ListRow[]; owners: Owner[]; regions: Option[]; continents: Option[] }

const SELECT_STYLE: React.CSSProperties = {
  padding: 8,
  borderRadius: 6,
  border: '2px solid var(--primary, #1e3a8a)',
  background: 'transparent',
  color: 'inherit',
  fontSize: 15,
  width: '100%',
}

function scopeLabel(row: ListRow, data: Data): string {
  switch (row.scope) {
    case 'ecclesia':
      return 'Its own members'
    case 'region':
      return data.regions.find((r) => r.id === row.scopeValue)?.label ?? row.scopeValue
    case 'continent':
      return data.continents.find((c) => c.id === row.scopeValue)?.label ?? row.scopeValue
    default:
      return 'Everyone'
  }
}

/**
 * Mailing lists (R5, flag-gated). Shows every list with its derived name
 * ("Toronto East Newsletter"), who it is offered to, how its sends are sourced,
 * and its subscriber count; owners/admins can create a list for any ecclesia
 * or organization. Sending to a new list is not part of this page.
 */
export default function MailingListsAdminPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading } = useAdminAccess()
  const [data, setData] = useState<Data | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [ownerKey, setOwnerKey] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<'newsletters' | 'reminders'>('newsletters')
  const [scope, setScope] = useState<'ecclesia' | 'region' | 'continent' | 'global'>('ecclesia')
  const [scopeValue, setScopeValue] = useState('')
  const [defaultOptIn, setDefaultOptIn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    const res = await fetch('/api/admin/mailing-lists', { cache: 'no-store' })
    if (res.status === 404) {
      setLoadError('Mailing lists are not turned on for your account (feature flag mailing_list_registry).')
      return
    }
    if (!res.ok) {
      setLoadError('Could not load the lists.')
      return
    }
    setData(await res.json())
  }, [])

  useEffect(() => {
    if (isHydrated && hasAccess) load()
  }, [isHydrated, hasAccess, load])

  if (!isHydrated || isLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" />
      </YStack>
    )
  }
  if (!hasAccess) {
    return (
      <YStack flex={1} padding="$4">
        <Text>Access denied. Admin access required.</Text>
      </YStack>
    )
  }

  const owner = data?.owners.find((o) => `${o.ownerType}#${o.ownerId}` === ownerKey)
  const scopeOptions: Array<{ id: typeof scope; label: string }> = [
    ...(owner?.ownerType !== 'organization' ? [{ id: 'ecclesia' as const, label: 'Its own members' }] : []),
    { id: 'region', label: 'A region' },
    { id: 'continent', label: 'A continent' },
    { id: 'global', label: 'Everyone' },
  ]

  const create = async () => {
    if (!owner) {
      setFormError('Choose an owner.')
      return
    }
    setSaving(true)
    setFormError(null)
    setCreated(null)
    try {
      const res = await fetch('/api/admin/mailing-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          name,
          description,
          category,
          scope,
          scopeValue,
          defaultOptIn,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFormError(j.error || 'Could not create the list.')
        return
      }
      setCreated(`${owner.name.replace(/\s+ecclesia$/i, '')} ${name.trim()}`)
      setName('')
      setDescription('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <YStack flex={1} padding="$4" gap="$4" maxWidth={900}>
      <YStack gap="$2">
        <Heading size="$8">Mailing lists</Heading>
        <Text color="$colorSecondary">
          Every list belongs to an ecclesia or an organization. People choose their lists on the
          Email preferences page.
        </Text>
      </YStack>

      {loadError ? <Paragraph color="$error">{loadError}</Paragraph> : null}
      {!data && !loadError ? <Spinner /> : null}

      {data ? (
        <>
          <YStack gap="$2">
            {data.lists.length === 0 ? (
              <Paragraph color="$textSecondary">No lists yet. Run the backfill to add Toronto East’s lists.</Paragraph>
            ) : null}
            {data.lists.map((l) => (
              <Card key={l.listId} bordered padding="$3" gap="$1">
                <XStack justifyContent="space-between" flexWrap="wrap" gap="$2">
                  <Text fontWeight="700">{l.displayName}</Text>
                  <Text color="$textSecondary">{l.subscribers} subscribed</Text>
                </XStack>
                {l.description ? <Text fontSize="$2" color="$textSecondary">{l.description}</Text> : null}
                <Text fontSize="$2" color="$textSecondary">
                  Offered to: {scopeLabel(l, data)} · {l.category}
                  {l.defaultOptIn ? ' · default on' : ''}
                  {l.status !== 'active' ? ` · ${l.status}` : ''}
                </Text>
                <Text fontSize="$2" color="$textSecondary">
                  Sends from:{' '}
                  {l.sesTopic
                    ? l.sendFromRegistry
                      ? `the registry (SES topic “${l.sesTopic}” is the safety net)`
                      : `SES topic “${l.sesTopic}” (not cut over)`
                    : 'the registry'}
                </Text>
              </Card>
            ))}
          </YStack>

          <Card bordered padding="$4" gap="$3">
            <Text fontSize="$5" fontWeight="700">New list</Text>
            <YStack gap="$1">
              <Text fontSize="$2">Owner</Text>
              <select
                style={SELECT_STYLE}
                value={ownerKey}
                onChange={(e) => {
                  setOwnerKey(e.target.value)
                  const next = data.owners.find((o) => `${o.ownerType}#${o.ownerId}` === e.target.value)
                  if (next?.ownerType === 'organization' && scope === 'ecclesia') setScope('region')
                }}
              >
                <option value="">Choose an ecclesia or organization…</option>
                {data.owners.map((o) => (
                  <option key={`${o.ownerType}#${o.ownerId}`} value={`${o.ownerType}#${o.ownerId}`}>
                    {o.name}
                    {o.ownerType === 'organization' ? ' (organization)' : ''}
                  </option>
                ))}
              </select>
            </YStack>
            <YStack gap="$1">
              <Text fontSize="$2">List name (without the owner, e.g. “Memorial Recap”)</Text>
              <Input value={name} onChangeText={setName} maxLength={80} />
            </YStack>
            <YStack gap="$1">
              <Text fontSize="$2">Description</Text>
              <Input value={description} onChangeText={setDescription} maxLength={300} />
            </YStack>
            <YStack gap="$1">
              <Text fontSize="$2">Kind</Text>
              <select style={SELECT_STYLE} value={category} onChange={(e) => setCategory(e.target.value as any)}>
                <option value="newsletters">Newsletter / recap</option>
                <option value="reminders">Reminder</option>
              </select>
            </YStack>
            <YStack gap="$1">
              <Text fontSize="$2">Offered to</Text>
              <select
                style={SELECT_STYLE}
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value as any)
                  setScopeValue('')
                }}
              >
                {scopeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </YStack>
            {scope === 'region' || scope === 'continent' ? (
              <select style={SELECT_STYLE} value={scopeValue} onChange={(e) => setScopeValue(e.target.value)}>
                <option value="">Choose…</option>
                {(scope === 'region' ? data.regions : data.continents).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : null}
            <XStack gap="$3" alignItems="center">
              <Checkbox id="defaultOptIn" checked={defaultOptIn} onCheckedChange={(v) => setDefaultOptIn(!!v)}>
                <Checkbox.Indicator>
                  <Check />
                </Checkbox.Indicator>
              </Checkbox>
              <Text onPress={() => setDefaultOptIn((v) => !v)}>
                Default opt-in (recorded only: nobody is subscribed automatically yet)
              </Text>
            </XStack>
            {formError ? <Paragraph color="$error">{formError}</Paragraph> : null}
            {created ? <Paragraph color="$green10">Created “{created}”.</Paragraph> : null}
            <Button
              backgroundColor="$primary"
              color="white"
              hoverStyle={{ backgroundColor: '$primaryHover' }}
              disabled={saving}
              icon={saving ? <Spinner size="small" color="white" /> : undefined}
              onPress={create}
            >
              {saving ? 'Creating…' : 'Create list'}
            </Button>
          </Card>
        </>
      ) : null}
    </YStack>
  )
}
