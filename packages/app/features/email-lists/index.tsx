'use client'

/**
 * Email Lists (#276, ADR-0006): one card per PERSON, read from PersonRecords.
 *
 * SES is shown, never edited: each address carries its SES topic opt-ins and
 * suppression status as read from SES, and every place SES disagrees with the
 * PersonRecords is listed under "Findings" for the owner to act on. The
 * legacy directory (DIRECTORY#MEMBERS) and its merge / migrate / consolidate
 * actions are gone; corrections to a person are made on their profile.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'solito/navigation'
import { AuthSession, AuthStatus } from '@my/app/types'
import {
  Button,
  Card,
  ErrorState,
  Heading,
  Input,
  LoadingState,
  Paragraph,
  Text,
  XStack,
  YStack,
} from '@my/ui'
import { Search, RefreshCw, AlertTriangle, Users } from '@tamagui/lucide-icons'
import { Wrapper } from '@my/app/provider/wrapper'
import { Section } from '@my/app/features/newsletter/Section'
import { LogInUser } from '@my/app/provider/auth/log-in-user'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { getEmailListsOverview } from '@my/app/provider/get-data'
import {
  type EmailFlag,
  type EmailListsEmailRow,
  type EmailListsOverview,
  type EmailListsPersonRow,
  personMatches,
} from '@my/app/utils/email-lists-overview'

export interface EmailListsProps {
  session: AuthSession | null
  status?: AuthStatus
}

type Filter = 'all' | 'findings' | 'shared' | 'suppressed'

const FLAG_LABEL: Record<EmailFlag, string> = {
  suppressed: 'Suppressed by SES',
  'suppressed-but-marked-active': 'Suppressed, but marked active on the person',
  'bounced-on-person': 'Bounced (person record)',
  'not-in-ses': 'Not in SES',
  'ses-case-duplicate': 'Duplicate SES contact (letter case)',
  'unsubscribed-all': 'Unsubscribed from all',
}

const WARNING_FLAGS: EmailFlag[] = ['suppressed-but-marked-active', 'not-in-ses', 'ses-case-duplicate']

export const EmailLists: React.FC<EmailListsProps> = ({ session }) => {
  const router = useRouter()
  const [overview, setOverview] = useState<EmailListsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const role = session?.user?.role
  const allowed = role === ROLES.ADMIN || role === ROLES.OWNER

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setOverview(await getEmailListsOverview())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Email Lists')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (allowed) load()
  }, [allowed, load])

  const nameOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of overview?.people || []) m.set(p.personId, p.displayName || '(no name)')
    return m
  }, [overview])

  const visible = useMemo(() => {
    const people = overview?.people || []
    return people.filter((p) => {
      if (!personMatches(p, query)) return false
      if (filter === 'findings') return p.findingCount > 0
      if (filter === 'shared') return p.emails.some((e) => e.sharedWith.length > 0)
      if (filter === 'suppressed') return p.emails.some((e) => !!e.suppressed || e.flags.includes('bounced-on-person'))
      return true
    })
  }, [overview, query, filter])

  if (!(session && session.user)) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Email Lists</Heading>
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
          <Paragraph>You need admin or owner permissions to view Email Lists.</Paragraph>
        </Section>
      </Wrapper>
    )
  }

  const openPerson = (personId: string) => router.push(`/people/${encodeURIComponent(personId)}`)

  return (
    <Wrapper subHeader="Email Lists">
      <Section gap={'$4'}>
        <YStack gap="$4">
          <Card bordered padding="$4" backgroundColor="$background">
            <YStack gap="$3">
              <Paragraph color="$gray11">
                People come from the member records. SES status is read from SES and compared; this page never
                changes SES. Fix a person on their profile.
              </Paragraph>
              {overview ? (
                <XStack gap="$4" flexWrap="wrap">
                  <Stat label="People" value={overview.counts.people} />
                  <Stat label="Their addresses" value={overview.counts.personAddresses} />
                  <Stat label="SES contacts" value={overview.counts.sesContacts} />
                  <Stat label="Suppressed" value={overview.counts.suppressed} />
                </XStack>
              ) : null}
              <XStack gap="$3" alignItems="center" flexWrap="wrap">
                <XStack flex={1} minWidth={240} alignItems="center" gap="$2">
                  <Search size={18} color="$gray10" />
                  <Input
                    flex={1}
                    size="$4"
                    placeholder="Filter by name, ecclesia or address"
                    value={query}
                    onChangeText={setQuery}
                    aria-label="Filter people"
                  />
                </XStack>
                <Button size="$4" icon={RefreshCw} onPress={load} disabled={loading}>
                  Refresh
                </Button>
              </XStack>
              <XStack gap="$2" flexWrap="wrap">
                {(
                  [
                    ['all', 'Everyone'],
                    ['findings', 'Has findings'],
                    ['shared', 'Shared address'],
                    ['suppressed', 'Bounced / suppressed'],
                  ] as Array<[Filter, string]>
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="$3"
                    variant={filter === key ? undefined : 'outlined'}
                    theme={filter === key ? 'active' : undefined}
                    onPress={() => setFilter(key)}
                  >
                    {label}
                  </Button>
                ))}
              </XStack>
            </YStack>
          </Card>

          {loading && !overview ? <LoadingState label="Email Lists" inline /> : null}
          {error ? <ErrorState title="Email Lists" message={error} actionLabel="Try again" onAction={load} /> : null}

          {overview ? <FindingsPanel overview={overview} nameOf={nameOf} onOpenPerson={openPerson} /> : null}

          {overview ? (
            <YStack gap="$3">
              <Text fontSize="$3" color="$gray11">
                {visible.length} of {overview.people.length} people
              </Text>
              {visible.map((person) => (
                <PersonCard
                  key={person.personId}
                  person={person}
                  topics={overview.topics}
                  nameOf={nameOf}
                  onOpenPerson={openPerson}
                />
              ))}
            </YStack>
          ) : null}
        </YStack>
      </Section>
    </Wrapper>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <YStack>
      <Text fontSize="$7" fontWeight="700">
        {value}
      </Text>
      <Text fontSize="$2" color="$gray11">
        {label}
      </Text>
    </YStack>
  )
}

function Badge({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'red' | 'orange' | 'green' | 'blue' }) {
  return (
    <XStack
      paddingHorizontal="$2"
      paddingVertical={2}
      borderRadius="$2"
      backgroundColor={`$${tone}3`}
      borderWidth={1}
      borderColor={`$${tone}6`}
    >
      <Text fontSize="$2" color={`$${tone}11`}>
        {children}
      </Text>
    </XStack>
  )
}

function PersonCard({
  person,
  topics,
  nameOf,
  onOpenPerson,
}: {
  person: EmailListsPersonRow
  topics: EmailListsOverview['topics']
  nameOf: Map<string, string>
  onOpenPerson: (personId: string) => void
}) {
  return (
    <Card bordered padding="$3" backgroundColor="$background">
      <YStack gap="$2">
        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
          <YStack>
            <Text fontSize="$5" fontWeight="600">
              {person.displayName || '(no name on record)'}
            </Text>
            <Text fontSize="$2" color="$gray11">
              {[person.ecclesia, person.role, person.memberStatus].filter(Boolean).join(' · ')} · {person.personId.slice(0, 8)}
            </Text>
          </YStack>
          <XStack gap="$2" alignItems="center">
            {person.findingCount > 0 ? <Badge tone="orange">{person.findingCount} to review</Badge> : null}
            <Button size="$3" variant="outlined" onPress={() => onOpenPerson(person.personId)}>
              Open profile
            </Button>
          </XStack>
        </XStack>
        {person.emails.length === 0 ? (
          <Text fontSize="$3" color="$gray11">
            No email address on record.
          </Text>
        ) : (
          person.emails.map((e) => <EmailRow key={e.email} row={e} topics={topics} nameOf={nameOf} />)
        )}
      </YStack>
    </Card>
  )
}

function EmailRow({
  row,
  topics,
  nameOf,
}: {
  row: EmailListsEmailRow
  topics: EmailListsOverview['topics']
  nameOf: Map<string, string>
}) {
  const optedIn = topics.filter((t) => row.ses.topics[t.name])
  return (
    <YStack gap="$1" paddingVertical="$2" borderTopWidth={1} borderColor="$gray4">
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <Text fontSize="$3" fontWeight="500" textDecorationLine={row.archived ? 'line-through' : 'none'}>
          {row.email}
        </Text>
        {row.isPrimary ? <Badge tone="blue">primary</Badge> : <Badge>{row.emailType || 'secondary'}</Badge>}
        {row.loginExcluded ? <Badge>receives mail, not a sign-in</Badge> : null}
        {row.sharedWith.length > 0 ? (
          <Badge tone="green">
            <Users size={12} /> shared with {row.sharedWith.map((id) => nameOf.get(id) || id.slice(0, 8)).join(', ')}
          </Badge>
        ) : null}
        {row.personSesStatus && row.personSesStatus !== 'active' ? <Badge tone="red">{row.personSesStatus}</Badge> : null}
        {row.suppressed ? <Badge tone="red">SES suppressed: {row.suppressed}</Badge> : null}
      </XStack>
      <XStack gap="$2" flexWrap="wrap" alignItems="center">
        {row.ses.inSes ? (
          optedIn.length > 0 ? (
            optedIn.map((t) => <Badge key={t.name}>{t.displayName}</Badge>)
          ) : (
            <Text fontSize="$2" color="$gray11">
              In SES, no topic opt-ins
            </Text>
          )
        ) : null}
        {row.flags
          .filter((f) => WARNING_FLAGS.includes(f) || f === 'unsubscribed-all')
          .map((f) => (
            <XStack key={f} gap="$1" alignItems="center">
              <AlertTriangle size={14} color="$orange10" />
              <Text fontSize="$2" color="$orange11">
                {FLAG_LABEL[f]}
              </Text>
            </XStack>
          ))}
      </XStack>
    </YStack>
  )
}

function FindingsPanel({
  overview,
  nameOf,
  onOpenPerson,
}: {
  overview: EmailListsOverview
  nameOf: Map<string, string>
  onOpenPerson: (personId: string) => void
}) {
  const f = overview.findings
  const people = (ids: string[]) => (
    <XStack gap="$2" flexWrap="wrap">
      {ids.map((id) => (
        <Button key={id} size="$2" variant="outlined" onPress={() => onOpenPerson(id)}>
          {nameOf.get(id) || id.slice(0, 8)}
        </Button>
      ))}
    </XStack>
  )
  return (
    <Card bordered padding="$4" backgroundColor="$background">
      <YStack gap="$3">
        <Heading size="$5">Findings</Heading>
        <Paragraph fontSize="$3" color="$gray11">
          Where SES and the member records disagree. Nothing here has been changed.
        </Paragraph>
        <FindingGroup
          title="Subscribed in SES, but no person holds the address"
          note="These addresses still receive list sends."
          count={f.sesSubscribedNoPerson.length}
        >
          {f.sesSubscribedNoPerson.map((x) => (
            <Text key={x.email} fontSize="$3">
              {x.email} — {x.topics.join(', ')}
              {x.suppressed ? ` (suppressed: ${x.suppressed})` : ''}
            </Text>
          ))}
        </FindingGroup>
        <FindingGroup
          title="Suppressed by SES, but still marked active on the person"
          count={f.suppressedButMarkedActive.length}
        >
          {f.suppressedButMarkedActive.map((x) => (
            <YStack key={x.email} gap="$1">
              <Text fontSize="$3">
                {x.email} — {x.reason}
              </Text>
              {people(x.personIds)}
            </YStack>
          ))}
        </FindingGroup>
        <FindingGroup title="Duplicate SES contacts (same address, different letter case)" count={f.sesCaseDuplicates.length}>
          {f.sesCaseDuplicates.map((x) => (
            <Text key={x.email} fontSize="$3">
              {x.variants.join('  ·  ')}
            </Text>
          ))}
        </FindingGroup>
        <FindingGroup title="A person's address with no SES contact" count={f.personEmailNotInSes.length}>
          {f.personEmailNotInSes.map((x) => (
            <YStack key={x.email} gap="$1">
              <Text fontSize="$3">{x.email}</Text>
              {people(x.personIds)}
            </YStack>
          ))}
        </FindingGroup>
        <FindingGroup
          title="Addresses shared by more than one person"
          note="Expected for a household inbox; listed so it is visible."
          count={f.sharedAddresses.length}
        >
          {f.sharedAddresses.map((x) => (
            <YStack key={x.email} gap="$1">
              <Text fontSize="$3">{x.email}</Text>
              {people(x.personIds)}
            </YStack>
          ))}
        </FindingGroup>
        {f.sesUnsubscribedNoPerson > 0 ? (
          <Text fontSize="$2" color="$gray11">
            Also {f.sesUnsubscribedNoPerson} SES contacts with no person and no opt-ins (they receive nothing).
          </Text>
        ) : null}
      </YStack>
    </Card>
  )
}

function FindingGroup({
  title,
  note,
  count,
  children,
}: {
  title: string
  note?: string
  count: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <YStack gap="$2" borderTopWidth={1} borderColor="$gray4" paddingTop="$2">
      <XStack justifyContent="space-between" alignItems="center" gap="$2">
        <YStack flex={1}>
          <Text fontSize="$4" fontWeight="600">
            {title}: {count}
          </Text>
          {note ? (
            <Text fontSize="$2" color="$gray11">
              {note}
            </Text>
          ) : null}
        </YStack>
        {count > 0 ? (
          <Button size="$2" variant="outlined" onPress={() => setOpen(!open)}>
            {open ? 'Hide' : 'Show'}
          </Button>
        ) : null}
      </XStack>
      {open ? <YStack gap="$2">{children}</YStack> : null}
    </YStack>
  )
}
