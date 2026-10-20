'use client'

/**
 * Recording Brothers — owner/admin assignment.
 *
 * Owners and admins set each ecclesia's Recording Brother directly (no
 * nomination, no email). Everyone else uses the nomination flow on the
 * ecclesia page. Nothing is pre-selected: the owner picks the person (or adds
 * one, email optional) and where ecclesia mail goes.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'solito/navigation'
import { AuthSession, AuthStatus } from '@my/app/types'
import { Button, Card, ErrorState, Heading, Input, LoadingState, Paragraph, Text, XStack, YStack } from '@my/ui'
import { Check, UserPlus } from '@tamagui/lucide-icons'
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
const NEW = '__new__'
/** Above this many people, filter by name instead of showing every one. */
const PEOPLE_SHOWN = 12

/** Default mail destination: keep the current one, else the only address on file. */
function defaultMailTo(row: RecordingBrotherRow): string {
  if (row.mailTo && row.addresses.some((a) => a.email === row.mailTo)) return row.mailTo
  if (!row.current && row.addresses.length === 1) return row.addresses[0].email
  return 'own'
}

const RowEditor: React.FC<{
  row: RecordingBrotherRow
  onDone: () => void
  onCancel: () => void
}> = ({ row, onDone, onCancel }) => {
  const [pick, setPick] = useState<string | null>(null)
  const [mailTo, setMailTo] = useState(defaultMailTo(row))
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const others = row.people.filter((p) => p.personId !== row.current?.personId)
  const q = query.trim().toLowerCase()
  const people = (q ? others.filter((p) => p.name.toLowerCase().includes(q)) : others).slice(0, PEOPLE_SHOWN)
  const picked = row.people.find((p) => p.personId === pick)
  const ownEmail = pick === NEW ? email.trim().toLowerCase() : picked?.email || ''
  const ready = pick === NEW ? !!first.trim() && !!last.trim() : !!pick

  const save = async () => {
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/recording-brothers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ecclesiaName: row.ecclesiaName,
        mailTo,
        ...(pick === NEW
          ? { newPerson: { firstName: first, lastName: last, email } }
          : { personId: pick }),
      }),
    })
    setSaving(false)
    if (res.ok) return onDone()
    setError((await res.json().catch(() => ({}))).error || 'Could not set')
  }

  return (
    <YStack gap="$3" paddingTop="$2">
      <YStack gap="$2">
        <Text fontSize="$3" fontWeight="600">Who is the Recording Brother?</Text>
        {others.length > PEOPLE_SHOWN ? (
          <Input value={query} onChangeText={setQuery} placeholder={`Filter ${others.length} people by name`} />
        ) : null}
        <XStack gap="$2" flexWrap="wrap">
          {people.map((p) => (
            <Button
              key={p.personId}
              size="$2"
              theme={pick === p.personId ? 'blue' : undefined}
              icon={pick === p.personId ? Check : undefined}
              onPress={() => setPick(p.personId)}
            >
              {p.isContact ? `${p.name} · contact` : p.name}
            </Button>
          ))}
          <Button
            size="$2"
            theme={pick === NEW ? 'blue' : undefined}
            icon={UserPlus}
            onPress={() => setPick(NEW)}
          >
            Someone else
          </Button>
        </XStack>
        {pick === NEW ? (
          <YStack gap="$2">
            <XStack gap="$2" flexWrap="wrap">
              <Input flex={1} minWidth={140} value={first} onChangeText={setFirst} placeholder="First name" />
              <Input flex={1} minWidth={140} value={last} onChangeText={setLast} placeholder="Last name" />
            </XStack>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="Email (optional)"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text fontSize="$2" theme="alt2">{`Adds them as a member of ${row.ecclesiaName}.`}</Text>
          </YStack>
        ) : null}
      </YStack>

      <YStack gap="$2">
        <Text fontSize="$3" fontWeight="600">Ecclesia mail goes to</Text>
        <XStack gap="$2" flexWrap="wrap">
          {row.addresses.map((a) => (
            <Button
              key={a.email}
              size="$2"
              theme={mailTo === a.email ? 'blue' : undefined}
              icon={mailTo === a.email ? Check : undefined}
              onPress={() => setMailTo(a.email)}
            >
              {a.email}
            </Button>
          ))}
          <Button
            size="$2"
            theme={mailTo === 'own' ? 'blue' : undefined}
            icon={mailTo === 'own' ? Check : undefined}
            onPress={() => setMailTo('own')}
          >
            {ownEmail ? `Their own email (${ownEmail})` : 'Their own email'}
          </Button>
        </XStack>
        {mailTo === 'own' && ready && !ownEmail ? (
          <Text fontSize="$2" color="$orange10">
            No email on file for them, so ecclesia mail won&apos;t reach anyone until one is added.
          </Text>
        ) : null}
      </YStack>

      {error ? <Text fontSize="$2" color="$red10">{error}</Text> : null}
      <XStack gap="$2">
        <Button size="$3" theme="blue" disabled={!ready || saving} onPress={save}>
          {saving ? 'Setting…' : 'Set Recording Brother'}
        </Button>
        <Button size="$3" chromeless onPress={onCancel}>Cancel</Button>
      </XStack>
    </YStack>
  )
}

export const RecordingBrothers: React.FC<RecordingBrothersProps> = ({ session }) => {
  const router = useRouter()
  const role = session?.user?.role
  const allowed = role === ROLES.OWNER || role === ROLES.ADMIN

  const [data, setData] = useState<RecordingBrotherRows | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<Filter>('needs')
  const [editing, setEditing] = useState<string | null>(null)

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

  const visible = useMemo(
    () => (data?.rows || []).filter((r) => filter === 'all' || !r.current || r.ecclesiaName === editing),
    [data, filter, editing]
  )
  const withRb = (data?.rows || []).filter((r) => r.current).length

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
            <Text fontSize="$3">{`${withRb} of ${data.rows.length} ecclesias have a Recording Brother.`}</Text>
            <XStack gap="$2" flexWrap="wrap">
              <Button size="$3" theme={filter === 'needs' ? 'blue' : undefined} onPress={() => setFilter('needs')}>
                Needs one
              </Button>
              <Button size="$3" theme={filter === 'all' ? 'blue' : undefined} onPress={() => setFilter('all')}>
                All
              </Button>
            </XStack>

            {visible.map((row) => (
              <Card key={row.ecclesiaName} padding="$3" backgroundColor="$backgroundHover">
                <YStack gap="$2">
                  <YStack>
                    <Text fontSize="$4" fontWeight="600">{row.ecclesiaName}</Text>
                    {row.place ? <Text fontSize="$2" theme="alt2">{row.place}</Text> : null}
                  </YStack>
                  <Text fontSize="$3" color={row.current ? '$green10' : '$orange10'}>
                    {row.current ? `Recording Brother: ${row.current.name}` : 'No Recording Brother'}
                  </Text>
                  <Text fontSize="$2" theme="alt2" style={{ overflowWrap: 'anywhere' }}>
                    {row.mailTo ? `Ecclesia mail goes to ${row.mailTo}` : 'No ecclesia mail address'}
                  </Text>
                  {row.addresses.length > 0 && !row.mailTo ? (
                    <Text fontSize="$2" theme="alt2" style={{ overflowWrap: 'anywhere' }}>
                      {`On file: ${row.addresses.map((a) => a.email).join(', ')}`}
                    </Text>
                  ) : null}

                  {editing === row.ecclesiaName ? (
                    <RowEditor
                      row={row}
                      onCancel={() => setEditing(null)}
                      onDone={async () => {
                        setEditing(null)
                        await load()
                      }}
                    />
                  ) : (
                    <XStack>
                      <Button size="$3" disabled={editing !== null} onPress={() => setEditing(row.ecclesiaName)}>
                        {row.current ? 'Change Recording Brother' : 'Set Recording Brother'}
                      </Button>
                    </XStack>
                  )}
                </YStack>
              </Card>
            ))}

            {data.unmatched.length > 0 ? (
              <YStack gap="$2" marginTop="$3">
                <Heading size={4}>Contacts with no matching ecclesia</Heading>
                <Paragraph theme="alt2">
                  These inter-ecclesia contacts&apos; ecclesia doesn&apos;t match any ecclesia, so they
                  can&apos;t be shown above. Correct their ecclesia on their page, then come back.
                </Paragraph>
                {data.unmatched.map((p) => (
                  <Button
                    key={p.personId}
                    size="$3"
                    justifyContent="flex-start"
                    onPress={() => router.push(`/people/${encodeURIComponent(p.personId)}`)}
                  >
                    {`${p.name || p.email} · ${p.ecclesia || 'no ecclesia'}`}
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
