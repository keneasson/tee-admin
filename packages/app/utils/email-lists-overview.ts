/**
 * Email Lists, built from PersonRecords only (#276, ADR-0006).
 *
 * People come from the person CARD projections, one card per person. SES is
 * NOT a source of people here: its contacts, topic preferences and the
 * account suppression list are a *projection* to compare against. Every
 * place they disagree with the PersonRecords is reported as a finding, and
 * nothing here writes to SES.
 *
 * Pure, so the rules are unit-testable and shared by the API and the screen.
 */

export interface OverviewCardInput {
  personId: string
  displayName: string
  firstName?: string
  lastName?: string
  ecclesia?: string
  role?: string
  memberStatus?: string
  primaryEmail?: string
  emails: Array<{
    email: string
    emailType?: string
    order?: number
    verified?: boolean
    sesStatus?: string
    loginExcluded?: boolean
    archiveAfter?: string
  }>
}

export interface OverviewSesContactInput {
  email: string
  unsubscribeAll?: boolean
  /** Explicit topic preferences only — what the send path reads (`UseDefaultIfPreferenceUnavailable: false`). */
  topics: Record<string, 'OPT_IN' | 'OPT_OUT'>
}

export interface EmailListsTopic {
  name: string
  displayName: string
}

export interface EmailListsSesStatus {
  inSes: boolean
  unsubscribeAll: boolean
  /** Topic name → opted in (explicitly). */
  topics: Record<string, boolean>
  /** How many SES contacts hold this address in some letter case (>1 = duplicate). */
  sesVariants: number
}

export type EmailFlag =
  | 'suppressed'
  | 'suppressed-but-marked-active'
  | 'bounced-on-person'
  | 'not-in-ses'
  | 'ses-case-duplicate'
  | 'unsubscribed-all'

export interface EmailListsEmailRow {
  email: string
  emailType?: string
  isPrimary: boolean
  archived: boolean
  verified?: boolean
  loginExcluded?: boolean
  /** The PersonRecord's own delivery status for this address. */
  personSesStatus?: string
  ses: EmailListsSesStatus
  /** Suppression-list reason (BOUNCE / COMPLAINT), if suppressed. */
  suppressed?: string
  /** Other people who hold this same address (a shared household inbox). */
  sharedWith: string[]
  flags: EmailFlag[]
}

export interface EmailListsPersonRow {
  personId: string
  displayName: string
  firstName: string
  lastName: string
  ecclesia: string
  role?: string
  memberStatus?: string
  emails: EmailListsEmailRow[]
  findingCount: number
}

export interface EmailListsFindings {
  /** Subscribed to at least one topic in SES, but no person holds the address. They still receive sends. */
  sesSubscribedNoPerson: Array<{ email: string; topics: string[]; suppressed?: string }>
  /** In SES with no person and no opt-in (harmless, listed for cleanup). */
  sesUnsubscribedNoPerson: number
  /** One address stored as several SES contacts differing only in letter case. */
  sesCaseDuplicates: Array<{ email: string; variants: string[] }>
  /** Suppressed by SES, but the PersonRecord still says `sesStatus: active`. */
  suppressedButMarkedActive: Array<{ email: string; reason: string; personIds: string[] }>
  /** A person's (non-archived) address with no SES contact at all. */
  personEmailNotInSes: Array<{ email: string; personIds: string[] }>
  /** One address held by several people — expected for households; listed so it is visible. */
  sharedAddresses: Array<{ email: string; personIds: string[] }>
}

export interface EmailListsOverview {
  generatedAt: string
  topics: EmailListsTopic[]
  counts: {
    people: number
    personAddresses: number
    sesContacts: number
    sesAddresses: number
    suppressed: number
  }
  people: EmailListsPersonRow[]
  findings: EmailListsFindings
}

const lower = (s: string | undefined | null) => (s || '').trim().toLowerCase()

export function buildEmailListsOverview(input: {
  cards: OverviewCardInput[]
  sesContacts: OverviewSesContactInput[]
  suppressed: Array<{ email: string; reason?: string }>
  topics: EmailListsTopic[]
  now?: Date
}): EmailListsOverview {
  const topicNames = input.topics.map((t) => t.name)

  // --- SES, folded by lower-cased address ---
  const sesByAddress = new Map<string, { variants: string[]; unsubscribeAll: boolean; topics: Record<string, boolean> }>()
  for (const c of input.sesContacts) {
    const key = lower(c.email)
    if (!key) continue
    const entry = sesByAddress.get(key) || { variants: [], unsubscribeAll: false, topics: {} }
    entry.variants.push(c.email)
    // Several case variants: an address counts as opted in to a topic if ANY
    // variant is, because each variant receives that send.
    entry.unsubscribeAll = entry.unsubscribeAll || !!c.unsubscribeAll
    for (const [topic, status] of Object.entries(c.topics || {})) {
      entry.topics[topic] = entry.topics[topic] || status === 'OPT_IN'
    }
    sesByAddress.set(key, entry)
  }
  const suppressedBy = new Map(input.suppressed.map((s) => [lower(s.email), s.reason || 'BOUNCE']))

  // --- Who holds each address (shared household inboxes) ---
  const holders = new Map<string, string[]>()
  for (const card of input.cards) {
    for (const e of dedupeEmails(card)) {
      const list = holders.get(e.email) || []
      if (!list.includes(card.personId)) list.push(card.personId)
      holders.set(e.email, list)
    }
  }

  const findings: EmailListsFindings = {
    sesSubscribedNoPerson: [],
    sesUnsubscribedNoPerson: 0,
    sesCaseDuplicates: [],
    suppressedButMarkedActive: [],
    personEmailNotInSes: [],
    sharedAddresses: [],
  }

  const people: EmailListsPersonRow[] = input.cards.map((card) => {
    const emails: EmailListsEmailRow[] = dedupeEmails(card).map((e) => {
      const ses = sesByAddress.get(e.email)
      const suppressed = suppressedBy.get(e.email)
      const archived = e.emailType === 'archived'
      const flags: EmailFlag[] = []
      if (suppressed) flags.push('suppressed')
      if (suppressed && (e.sesStatus === 'active' || !e.sesStatus)) flags.push('suppressed-but-marked-active')
      if (e.sesStatus === 'bounced' || e.sesStatus === 'complained') flags.push('bounced-on-person')
      if (!ses && !archived) flags.push('not-in-ses')
      if (ses && ses.variants.length > 1) flags.push('ses-case-duplicate')
      if (ses?.unsubscribeAll) flags.push('unsubscribed-all')
      return {
        email: e.email,
        emailType: e.emailType,
        isPrimary: e.email === lower(card.primaryEmail) || e.emailType === 'primary',
        archived,
        verified: e.verified,
        loginExcluded: e.loginExcluded,
        personSesStatus: e.sesStatus,
        ses: {
          inSes: !!ses,
          unsubscribeAll: !!ses?.unsubscribeAll,
          topics: Object.fromEntries(topicNames.map((t) => [t, !!ses?.topics[t]])),
          sesVariants: ses?.variants.length || 0,
        },
        suppressed,
        sharedWith: (holders.get(e.email) || []).filter((id) => id !== card.personId),
        flags,
      }
    })
    const findingCount = emails.reduce(
      (n, e) => n + e.flags.filter((f) => f !== 'suppressed' && f !== 'unsubscribed-all').length,
      0
    )
    return {
      personId: card.personId,
      displayName: card.displayName || [card.firstName, card.lastName].filter(Boolean).join(' '),
      firstName: card.firstName || '',
      lastName: card.lastName || '',
      ecclesia: card.ecclesia || '',
      role: card.role,
      memberStatus: card.memberStatus,
      emails,
      findingCount,
    }
  })

  // --- Findings across people ---
  for (const [email, ids] of holders) {
    if (ids.length > 1) findings.sharedAddresses.push({ email, personIds: ids.slice().sort() })
    const reason = suppressedBy.get(email)
    if (reason) {
      const markedActive = people
        .filter((p) => ids.includes(p.personId))
        .filter((p) => p.emails.some((e) => e.email === email && e.flags.includes('suppressed-but-marked-active')))
        .map((p) => p.personId)
      if (markedActive.length > 0) findings.suppressedButMarkedActive.push({ email, reason, personIds: markedActive.sort() })
    }
    const notInSes = people
      .filter((p) => ids.includes(p.personId))
      .filter((p) => p.emails.some((e) => e.email === email && e.flags.includes('not-in-ses')))
      .map((p) => p.personId)
    if (notInSes.length > 0) findings.personEmailNotInSes.push({ email, personIds: notInSes.sort() })
  }
  for (const [email, ses] of sesByAddress) {
    if (ses.variants.length > 1) findings.sesCaseDuplicates.push({ email, variants: ses.variants.slice().sort() })
    if (holders.has(email)) continue
    const optedIn = Object.entries(ses.topics).filter(([, v]) => v).map(([t]) => t)
    if (optedIn.length > 0 && !ses.unsubscribeAll) {
      findings.sesSubscribedNoPerson.push({ email, topics: optedIn.sort(), suppressed: suppressedBy.get(email) })
    } else {
      findings.sesUnsubscribedNoPerson++
    }
  }
  for (const list of Object.values(findings)) {
    if (Array.isArray(list)) (list as Array<{ email: string }>).sort((a, b) => a.email.localeCompare(b.email))
  }

  people.sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName) ||
      a.firstName.localeCompare(b.firstName) ||
      a.personId.localeCompare(b.personId)
  )

  return {
    generatedAt: (input.now || new Date()).toISOString(),
    topics: input.topics,
    counts: {
      people: people.length,
      personAddresses: holders.size,
      sesContacts: input.sesContacts.length,
      sesAddresses: sesByAddress.size,
      suppressed: suppressedBy.size,
    },
    people,
    findings,
  }
}

/** A person's addresses, lower-cased, one row per address, in display order. */
function dedupeEmails(card: OverviewCardInput): OverviewCardInput['emails'] {
  const seen = new Set<string>()
  const out: OverviewCardInput['emails'] = []
  const rows = card.emails.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  // A legacy profile can lack its EMAIL# row; the primary still belongs on the card.
  if (card.primaryEmail && !rows.some((r) => lower(r.email) === lower(card.primaryEmail))) {
    rows.unshift({ email: card.primaryEmail, emailType: 'primary', order: -1 })
  }
  for (const r of rows) {
    const email = lower(r.email)
    if (!email || seen.has(email)) continue
    seen.add(email)
    out.push({ ...r, email })
  }
  return out
}

/** Case-insensitive match of a person row against a free-text filter (name, ecclesia, any address). */
export function personMatches(person: EmailListsPersonRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    person.displayName.toLowerCase().includes(q) ||
    person.ecclesia.toLowerCase().includes(q) ||
    person.emails.some((e) => e.email.includes(q))
  )
}
