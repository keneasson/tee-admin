'use client'

/**
 * Recording Brothers — owner/admin quick assignment.
 *
 * Owners and admins set each ecclesia's Recording Brother directly (no
 * nomination, no email). Everyone else uses the nomination flow on the
 * ecclesia page. Candidates are the ecclesia's inter-ecclesia contacts plus
 * whoever holds the RB email still on the ecclesia record.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'solito/navigation'
import { AuthSession, AuthStatus } from '@my/app/types'
import { Button, Card, ErrorState, Heading, LoadingState, Paragraph, Text, XStack, YStack } from '@my/ui'
import { Check } from '@tamagui/lucide-icons'
import { Wrapper } from '@my/app/provider/wrapper'
import { Section } from '@my/app/features/newsletter/Section'
import { LogInUser } from '@my/app/provider/auth/log-in-user'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import type { RecordingBrotherRow, RecordingBrotherRows } from '@my/app/utils/recording-brother-rows'

export interface RecordingBrothersProps {
  session: AuthSession | null
  status?: AuthStatus
}

type Filter = 'needs' | 'all'

export const RecordingBrothers: React.FC<RecordingBrothersProps> = ({ session }) => {
  const router = useRouter()
  const role = session?.user?.role
  const allowed = role === ROLES.OWNER || role === ROLES.ADMIN

  const [data, setData] = useState<RecordingBrotherRows | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<Filter>('needs')
  // Chosen candidate per ecclesia (defaults to the suggestion).
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [rowError, setRowError] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/recording-brothers')
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (allowed) load()
  }, [allowed, load])

  const chosen = (row: RecordingBrotherRow) => choice[row.ecclesiaName] ?? row.suggestedPersonId ?? null

  const visible = useMemo(
    () => (data?.rows || []).filter((r) => filter === 'all' || !r.current),
    [data, filter]
  )
  const suggestedRows = useMemo(
    () => (data?.rows || []).filter((r) => !r.current && r.suggestedPersonId),
    [data]
  )
  const withRb = (data?.rows || []).filter((r) => r.current).length

  const setRb = async (ecclesiaName: string, personId: string): Promise<boolean> => {
    setRowError((e) => ({ ...e, [ecclesiaName]: '' }))
    const res = await fetch('/api/admin/recording-brothers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ecclesiaName, personId }),
    })
    if (res.ok) return true
    const msg = (await res.json().catch(() => ({}))).error || 'Could not set'
    setRowError((e) => ({ ...e, [ecclesiaName]: msg }))
    return false
  }

  const saveRow = async (row: RecordingBrotherRow) => {
    const personId = chosen(row)
    if (!personId) return
    setSaving(row.ecclesiaName)
    await setRb(row.ecclesiaName, personId)
    setSaving(null)
    await load()
  }

  // One at a time: each set also clears that ecclesia's previous RB.
  const saveAllSuggested = async () => {
    setSaving('__all__')
    for (const row of suggestedRows) {
      await setRb(row.ecclesiaName, chosen(row) as string)
    }
    setSaving(null)
    await load()
  }

  if (!(session && session.user)) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Recording Brothers</Heading>
          <Paragraph>To access this section of our site, please sign in.</Paragraph>
          <LogInUser />
        </Section>
      </Wrapper>
    )
  }
  if (!allowed) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Access Denied</Heading>
          <Paragraph>
            Recording Brothers is for owners and admins. To set a Recording Brother, use Nominate on the
            ecclesia&apos;s page.
          </Paragraph>
        </Section>
      </Wrapper>
    )
  }

  return (
    <Wrapper subHeader="Recording Brothers">
      <Section gap={'$4'}>
        <YStack gap="$2">
          <Heading size={5}>Recording Brothers</Heading>
          <Paragraph theme="alt2">
            Set each ecclesia&apos;s Recording Brother directly. Nobody is emailed. Everyone else uses the
            nomination flow on the ecclesia page.
          </Paragraph>
        </YStack>

        {loading && !data ? <LoadingState label="Recording Brothers" inline /> : null}
        {error ? <ErrorState title="Recording Brothers" message={error} actionLabel="Try again" onAction={load} /> : null}

        {data ? (
          <YStack gap="$3">
            <Text fontSize="$3">
              {`${withRb} of ${data.rows.length} ecclesias have a Recording Brother. ${suggestedRows.length} more have an obvious choice.`}
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              <Button
                size="$3"
                theme="blue"
                icon={Check}
                disabled={suggestedRows.length === 0 || saving !== null}
                onPress={saveAllSuggested}
              >
                {saving === '__all__' ? 'Setting…' : `Set all suggested (${suggestedRows.length})`}
              </Button>
              <Button size="$3" theme={filter === 'needs' ? 'blue' : undefined} onPress={() => setFilter('needs')}>
                Needs one
              </Button>
              <Button size="$3" theme={filter === 'all' ? 'blue' : undefined} onPress={() => setFilter('all')}>
                All
              </Button>
            </XStack>

            {visible.map((row) => {
              const pick = chosen(row)
              return (
                <Card key={row.ecclesiaName} padding="$3" backgroundColor="$backgroundHover">
                  <YStack gap="$2">
                    <YStack>
                      <Text fontSize="$4" fontWeight="600">{row.ecclesiaName}</Text>
                      {row.place ? <Text fontSize="$2" theme="alt2">{row.place}</Text> : null}
                    </YStack>
                    <Text fontSize="$3" color={row.current ? '$green10' : '$orange10'}>
                      {row.current ? `Recording Brother: ${row.current.name}` : 'No Recording Brother'}
                    </Text>

                    {row.candidates.filter((c) => c.personId !== row.current?.personId).length > 0 ? (
                      <YStack gap="$2">
                        <XStack gap="$2" flexWrap="wrap">
                          {row.candidates
                            .filter((c) => c.personId !== row.current?.personId)
                            .map((c) => (
                              <Button
                                key={c.personId}
                                size="$2"
                                theme={pick === c.personId ? 'blue' : undefined}
                                icon={pick === c.personId ? Check : undefined}
                                onPress={() => setChoice((m) => ({ ...m, [row.ecclesiaName]: c.personId }))}
                              >
                                {`${c.name} · ${c.source}`}
                              </Button>
                            ))}
                        </XStack>
                        <XStack>
                          <Button
                            size="$3"
                            theme="blue"
                            disabled={!pick || pick === row.current?.personId || saving !== null}
                            onPress={() => saveRow(row)}
                          >
                            {saving === row.ecclesiaName ? 'Setting…' : row.current ? 'Change Recording Brother' : 'Set Recording Brother'}
                          </Button>
                        </XStack>
                      </YStack>
                    ) : row.current ? null : (
                      <Text fontSize="$2" theme="alt2">
                        No inter-ecclesia contact on file. Open the ecclesia page to nominate someone.
                      </Text>
                    )}
                    {rowError[row.ecclesiaName] ? (
                      <Text fontSize="$2" color="$red10">{rowError[row.ecclesiaName]}</Text>
                    ) : null}
                  </YStack>
                </Card>
              )
            })}

            {data.unmatched.length > 0 ? (
              <YStack gap="$2" marginTop="$3">
                <Heading size={4}>Contacts with no matching ecclesia</Heading>
                <Paragraph theme="alt2">
                  These inter-ecclesia contacts&apos; ecclesia doesn&apos;t match any ecclesia, so they
                  can&apos;t be offered above. Correct their ecclesia on their page, then come back.
                </Paragraph>
                {data.unmatched.map((p) => (
                  <Button
                    key={p.personId}
                    size="$3"
                    justifyContent="flex-start"
                    onPress={() => router.push(`/people/${encodeURIComponent(p.personId)}`)}
                  >
                    {`${p.name} · ${p.ecclesia || 'no ecclesia'}`}
                  </Button>
                ))}
              </YStack>
            ) : null}
          </YStack>
        ) : null}
      </Section>
    </Wrapper>
  )
}
