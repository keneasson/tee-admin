'use client'

import React, { useEffect, useState } from 'react'
import { useAdminAccess } from '@/hooks/use-admin-access'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Button, H1, Paragraph, Spinner, Text, XStack, YStack } from '@my/ui'
import { Plus } from '@tamagui/lucide-icons'
import { NewsCard } from '@my/ui/src/news/news-card'
import {
  NewsItemForm,
  type NewsFormValues,
} from '@my/ui/src/news/news-item-form'
import type { NewsItem } from '@my/app/types/news'
import { isNewsActive } from '@my/app/types/news'
import { getContactsList } from '@my/app/provider/get-data'

type Audience = { key: string; label: string }

/**
 * Audiences this item has been blasted to live. Mirrors the server's
 * `blastedAudiences` helper, treating a legacy `emailBlastSentAt` as a
 * newsletter send so the per-audience "already sent" state stays correct.
 */
const sentAudiencesOf = (item: NewsItem): string[] =>
  item.emailBlastAudiences ?? (item.emailBlastSentAt ? ['newsletter'] : [])

type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'edit'; item: NewsItem }

export default function AdminNewsPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading } = useAdminAccess()
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [ecclesiaOptions, setEcclesiaOptions] = useState<string[]>([])
  const [audiences, setAudiences] = useState<Audience[]>([])

  useEffect(() => {
    if (!hasAccess) return
    loadItems()
    fetch('/api/admin/manageable-ecclesias')
      .then((r) => (r.ok ? r.json() : { ecclesias: [] }))
      .then((d) => setEcclesiaOptions(Array.isArray(d.ecclesias) ? d.ecclesias : []))
      .catch(() => setEcclesiaOptions([]))
    // Email audiences for the alert sender — same source as the Email Sender.
    // The test list is excluded (the "Send test alert" button covers it).
    getContactsList()
      .then((d) =>
        setAudiences(
          (d.lists ?? [])
            .filter((l) => l.key !== 'testList')
            .map((l) => ({ key: l.key, label: l.displayName }))
        )
      )
      .catch(() => setAudiences([]))
  }, [hasAccess])

  const loadItems = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/news')
      if (!res.ok) throw new Error('Failed to fetch news')
      const data = await res.json()
      setItems(data)
    } catch (e) {
      console.error(e)
      setErrorMessage('Could not load news items.')
    } finally {
      setLoading(false)
    }
  }

  if (!isHydrated || isLoading || !hasAccess) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" width={36} height={36} />
        <Text marginTop="$4">Loading…</Text>
      </YStack>
    )
  }

  const handleSave = async (values: NewsFormValues) => {
    setSaving(true)
    setErrorMessage(null)
    try {
      const payload = {
        title: values.title,
        body: values.body,
        category: values.category || undefined,
        durationWeeks: Number(values.durationWeeks),
        sharingScope: values.sharingScope,
        documents: values.documents ?? [],
        // Only sent when the picker was shown; server validates + falls back to home.
        ecclesiaId: values.ecclesiaId || undefined,
      }

      let res: Response
      if (mode.kind === 'edit') {
        res = await fetch(`/api/admin/news/${mode.item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/admin/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to save')
      }

      await loadItems()
      setMode({ kind: 'list' })
    } catch (e) {
      console.error(e)
      setErrorMessage(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (mode.kind !== 'edit') return
    if (!confirm('Delete this news item? This cannot be undone.')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/news/${mode.item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      await loadItems()
      setMode({ kind: 'list' })
    } catch (e) {
      console.error(e)
      setErrorMessage(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const handleSendAlert = async (test: boolean, audience: string) => {
    if (mode.kind !== 'edit') return
    const audienceLabel = audiences.find((a) => a.key === audience)?.label ?? audience
    const confirmMsg = test
      ? `Send a TEST alert to the test list? (Live target would be: ${audienceLabel})`
      : `Send this alert to "${audienceLabel}"? This can only be done once for this audience.`
    if (!confirm(confirmMsg)) return

    setSaving(true)
    try {
      const params = new URLSearchParams({ list: audience })
      if (test) params.set('test', 'true')
      const url = `/api/admin/news/${mode.item.id}/send-alert?${params.toString()}`
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Alert send failed')
      alert(
        `Alert sent. ${data.sentCount} delivered, ${data.skippedCount} skipped.${
          test ? ' (Test list)' : ` (${audienceLabel})`
        }`
      )
      if (!test) {
        await loadItems()
        const refreshed = await fetch(`/api/admin/news/${mode.item.id}`).then((r) => r.json())
        setMode({ kind: 'edit', item: refreshed })
      }
    } catch (e) {
      console.error(e)
      setErrorMessage(e instanceof Error ? e.message : 'Alert send failed')
    } finally {
      setSaving(false)
    }
  }

  if (mode.kind === 'new' || mode.kind === 'edit') {
    const initial =
      mode.kind === 'edit'
        ? {
            title: mode.item.title,
            body: mode.item.body,
            category: mode.item.category || ('' as const),
            durationWeeks: String(mode.item.durationWeeks) as '1' | '2' | '3',
            sharingScope: mode.item.sharingScope,
            documents: mode.item.documents || [],
            ecclesiaId: mode.item.ecclesiaId,
          }
        : undefined

    return (
      <YStack padding="$4" gap="$4" maxWidth={800} alignSelf="center" width="100%">
        <H1>{mode.kind === 'edit' ? 'Edit News' : 'New News'}</H1>
        {errorMessage ? <Paragraph color="$error">{errorMessage}</Paragraph> : null}
        <NewsItemForm
          initialValues={initial}
          isSaving={saving}
          isExisting={mode.kind === 'edit'}
          sentAudiences={mode.kind === 'edit' ? sentAudiencesOf(mode.item) : []}
          audiences={audiences}
          ecclesiaOptions={ecclesiaOptions}
          onSave={handleSave}
          onCancel={() => setMode({ kind: 'list' })}
          onDelete={handleDelete}
          onSendAlert={mode.kind === 'edit' ? handleSendAlert : undefined}
        />
      </YStack>
    )
  }

  const active = items.filter((i) => isNewsActive(i))
  const expired = items.filter((i) => !isNewsActive(i))

  return (
    <YStack padding="$4" gap="$4" maxWidth={900} alignSelf="center" width="100%">
      <XStack justifyContent="space-between" alignItems="center" gap="$3">
        <H1>News Manager</H1>
        <Button
          icon={<Plus size={16} />}
          backgroundColor="$primary"
          color="white"
          hoverStyle={{ backgroundColor: '$primaryHover' }}
          onPress={() => setMode({ kind: 'new' })}
        >
          New News
        </Button>
      </XStack>

      {errorMessage ? <Paragraph color="$error">{errorMessage}</Paragraph> : null}

      {loading ? (
        <YStack alignItems="center" padding="$4">
          <Spinner size="small" width={20} height={20} />
        </YStack>
      ) : (
        <>
          <YStack gap="$2">
            <Text fontSize="$5" fontWeight="600">
              Active ({active.length})
            </Text>
            {active.length === 0 ? (
              <Paragraph color="$textSecondary">No active news items.</Paragraph>
            ) : (
              active.map((item) => (
                <NewsCard
                  key={item.id}
                  title={item.title}
                  body={item.body}
                  category={item.category}
                  publishedAt={item.publishedAt}
                  expiresAt={item.expiresAt}
                  emailBlastSentAt={item.emailBlastSentAt}
                  onPress={() => setMode({ kind: 'edit', item })}
                />
              ))
            )}
          </YStack>

          {expired.length > 0 ? (
            <YStack gap="$2" marginTop="$4">
              <Text fontSize="$5" fontWeight="600" color="$textSecondary">
                Expired ({expired.length})
              </Text>
              {expired.map((item) => (
                <NewsCard
                  key={item.id}
                  title={item.title}
                  body={item.body}
                  category={item.category}
                  publishedAt={item.publishedAt}
                  expiresAt={item.expiresAt}
                  expired
                  emailBlastSentAt={item.emailBlastSentAt}
                  onPress={() => setMode({ kind: 'edit', item })}
                />
              ))}
            </YStack>
          ) : null}
        </>
      )}
    </YStack>
  )
}
