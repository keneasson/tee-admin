import { NextRequest, NextResponse } from 'next/server'
import { CreateContactCommand, UpdateContactCommand, SubscriptionStatus } from '@aws-sdk/client-sesv2'
import { getSesClient } from '@/utils/email/sesClient'
import { getContact } from '@/utils/email/contact'
import { inputTemplate } from '@/utils/email/contact-lists'
import { verifyEcclesiaToken } from '@/utils/email/ecclesia-token'
import { auth } from '@/utils/auth'
import { maskEmail } from '@/utils/mask-email'
import { PUBLIC_TOPICS, PUBLIC_TOPIC_LABELS } from '@/utils/email/public-topics'
import { getTenantFromHeaders, resolveTenantFromEnv } from '@my/app/config/tenants'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { mailingListRepository } from '@my/app/provider/dynamodb/repositories/mailing-list-repository'
import { ecclesiaIdOf, slugifyEcclesia } from '@my/app/provider/dynamodb/people-index/keys'
import { getDefaultRegion } from '@my/app/config/regions'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { listEcclesiasCached } from '@/utils/dynamodb/locations'
import { buildListPreferences, planListSave, isSelfServe } from '@/utils/mailing-lists/preferences'
import { ownerNamesFor, ownerNameOf } from '@/utils/mailing-lists/owners'
import { defaultSubscriptionDeps, resolveSubscriber, setListSubscription } from '@/utils/mailing-lists/subscriptions'

/** Serving-tenant brand, so the page reads as a clear entrypoint into tee-admin.com OR echadhub.org. */
function tenantBrand(request: NextRequest) {
  const t = getTenantFromHeaders(request.headers) ?? resolveTenantFromEnv()
  return { id: t.id, publicName: t.publicName, senderDomain: t.senderDomain }
}

async function firstNameForEmail(email: string): Promise<string | null> {
  try {
    const person = await personRepository.getByEmailForAuth(email)
    return person?.firstName || null
  } catch {
    return null
  }
}

/**
 * Self-serve subscription management (Issue #75).
 *
 * SECURITY: only the PUBLIC, self-manageable topics are exposed here. Office /
 * membership topics (`interEcclesia` = conferred by the Recording-Brother
 * office; `members` = TEE membership; `testList`) are NEVER shown or changed by
 * this endpoint — they're set by role/membership, not self-serve. This is the
 * fix for the SES hosted page exposing every topic.
 */
async function emailForToken(token: string | null): Promise<string | null> {
  if (!token) return null
  const res = await verifyEcclesiaToken(token)
  return res.valid && res.email ? res.email.toLowerCase() : null
}

/**
 * Resolve who this request is for. Two accepted identities, both fine for the
 * PUBLIC topics: an ecclesia token (recognized — from an email link) OR a live
 * session (authenticated — e.g. arriving from the profile page). This is why a
 * signed-in user can manage preferences without a token.
 */
async function resolveIdentity(
  token: string | null
): Promise<{ email: string; authenticated: boolean; session: any } | null> {
  // Session wins: a signed-in user is authenticated even if a token is still in
  // the URL. Only fall back to the token (recognized) when there's no session.
  const session = await auth()
  const em = session?.user?.email
  if (em) return { email: em.toLowerCase(), authenticated: true, session } // authenticated
  const fromToken = await emailForToken(token)
  if (fromToken) return { email: fromToken, authenticated: false, session: null } // recognized
  return null
}

/** Mailing-list registry (R5) is visible to this caller? (owner-first rollout) */
async function registryOn(session: any): Promise<boolean> {
  return checkFeatureFlagFromDB(FEATURE_FLAGS.MAILING_LIST_REGISTRY, session)
}

/**
 * Every self-serve list offered to this address (scope ladder from the
 * person's ecclesia), plus any list it already has a registry row on, grouped
 * by owner with the state that decides delivery today.
 */
async function loadListPreferences(email: string, sesOptIns: Set<string>) {
  const [allLists, person] = await Promise.all([
    mailingListRepository.listAllLists(),
    personRepository.getByEmail(email),
  ])
  let ecclesiaId: string | null = null
  let region: string | null = null
  if (person?.ecclesia) {
    const eccl = (await listEcclesiasCached()).find((e) => e.name === person.ecclesia)
    ecclesiaId = eccl ? ecclesiaIdOf(eccl) : slugifyEcclesia(person.ecclesia)
    region = eccl ? eccl.region || getDefaultRegion(eccl.country, eccl.province) : null
  }
  const offered = await mailingListRepository.getOfferedListsForPerson({ ecclesiaId }, region)
  const candidates = allLists.filter(isSelfServe)
  const registryStatus = new Map<string, 'opt_in' | 'opt_out'>()
  await Promise.all(
    candidates.map(async (l) => {
      const rows = await mailingListRepository.getListSubscriptionsForEmail(l.listId, email)
      if (rows.length > 0) {
        registryStatus.set(l.listId, rows.some((r) => r.status === 'opt_in') ? 'opt_in' : 'opt_out')
      }
    })
  )
  const names = await ownerNamesFor(candidates)
  return buildListPreferences({
    allLists: candidates,
    offeredIds: new Set(offered.map((l) => l.listId)),
    registryStatus,
    sesOptIns,
    ownerName: (l) => ownerNameOf(names, l),
  })
}

/**
 * PRIVACY: only expose the FULL address to a confirmed (authenticated) caller.
 * A recognized (token-only) caller might be a forward recipient, so we return
 * just the masked form — enough to know "which identity" without revealing it.
 */
function identityFields(id: { email: string; authenticated: boolean }) {
  return {
    email: id.authenticated ? id.email : null,
    emailMasked: maskEmail(id.email),
    authenticated: id.authenticated,
  }
}

/** GET /api/subscribe?token=… (or a session) → current opt-in state for the public topics. */
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')
  const id = await resolveIdentity(token)
  if (!id) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
  }
  const email = id.email
  try {
    // getContact() returns null when the address isn't a contact yet (it
    // swallows NotFoundException), so an absent contact reads as "opted into
    // nothing" with no special-case branch.
    const contact = await getContact(email)
    const prefs = new Map(
      (contact?.TopicPreferences ?? []).map((p) => [p.TopicName, p.SubscriptionStatus])
    )
    const subscriptions = PUBLIC_TOPICS.map((t) => ({
      topic: t,
      label: PUBLIC_TOPIC_LABELS[t],
      subscribed: prefs.get(t) === SubscriptionStatus.OPT_IN,
    }))
    // R5 (flagged): every list offered to this person, grouped by owner.
    // Absent when the flag is off → the page renders the topic toggles as before.
    let listGroups: Awaited<ReturnType<typeof loadListPreferences>> | undefined
    if (await registryOn(id.session)) {
      const sesOptIns = new Set(
        [...prefs.entries()]
          .filter(([, status]) => status === SubscriptionStatus.OPT_IN)
          .map(([topic]) => topic as string)
      )
      listGroups = await loadListPreferences(email, sesOptIns)
    }
    return NextResponse.json({
      ...identityFields(id),
      ...(listGroups ? { listGroups } : {}),
      name: await firstNameForEmail(email),
      subscriptions,
      unsubscribedAll: !!contact?.UnsubscribeAll,
      tenant: tenantBrand(request),
    })
  } catch (error) {
    console.error('subscribe GET failed:', error)
    return NextResponse.json({ error: 'Could not load your preferences' }, { status: 500 })
  }
}

/**
 * POST /api/subscribe { token, subscriptions: { newsletter?: boolean, … } }
 * Updates ONLY the public topics; preserves every other topic exactly.
 */
export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const id = await resolveIdentity(body?.token ?? null)
  if (!id) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
  }
  // Saving is a protected action: a recognized (token-only) caller must confirm
  // it's them (sign in) before we mutate anything. See #80.
  if (!id.authenticated) {
    return NextResponse.json(
      { error: "Please confirm it's you to save changes.", stepUpRequired: true },
      { status: 403 }
    )
  }
  const email = id.email
  const requested: Record<string, boolean> = { ...(body?.subscriptions ?? {}) }

  // R5 (flagged): `lists: { [listId]: boolean }`. Validated against the real
  // lists; a bridged list's change is ALSO applied to its SES topic below.
  let listChanges: ReturnType<typeof planListSave>['changes'] = []
  if (body?.lists && typeof body.lists === 'object') {
    if (!(await registryOn(id.session))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const planned = planListSave(body.lists, await mailingListRepository.listAllLists())
    listChanges = planned.changes
    Object.assign(requested, planned.sesTopics)
  }

  try {
    // Registry choices need a person; check before any SES write so a save is
    // never half-applied.
    const deps = listChanges.length > 0 ? await defaultSubscriptionDeps() : null
    if (deps && !(await resolveSubscriber(email, deps))) {
      return NextResponse.json(
        { error: 'We could not find your profile to save list choices. Please sign in again.' },
        { status: 409 }
      )
    }

    // Reuse getContact() (null when not yet a contact) for the existing-prefs
    // read — no bespoke NotFoundException handling.
    const existing = await getContact(email)

    // Start from existing prefs so non-public topics are preserved verbatim.
    const current = new Map<string, SubscriptionStatus>(
      (existing?.TopicPreferences ?? []).map((p) => [
        p.TopicName as string,
        p.SubscriptionStatus as SubscriptionStatus,
      ])
    )
    for (const t of PUBLIC_TOPICS) {
      if (t in requested) {
        current.set(t, requested[t] ? SubscriptionStatus.OPT_IN : SubscriptionStatus.OPT_OUT)
      }
    }
    const TopicPreferences = Array.from(current.entries()).map(([TopicName, SubscriptionStatus]) => ({
      TopicName,
      SubscriptionStatus,
    }))

    const touchesSes = Object.keys(requested).some((t) => (PUBLIC_TOPICS as readonly string[]).includes(t))
    if (existing) {
      await getSesClient().send(
        new UpdateContactCommand({ ...inputTemplate, EmailAddress: email, TopicPreferences })
      )
    } else if (touchesSes && TopicPreferences.some((p) => p.SubscriptionStatus === SubscriptionStatus.OPT_IN)) {
      // No SES contact yet: create it with the requested topics only.
      await getSesClient().send(
        new CreateContactCommand({ ...inputTemplate, EmailAddress: email, TopicPreferences })
      )
    }

    // Registry writes (every list, bridged or not).
    if (deps) {
      for (const change of listChanges) {
        const result = await setListSubscription(
          { listId: change.list.listId, email, subscribed: change.subscribed },
          deps
        )
        if (result === 'no-person') {
          return NextResponse.json(
            { error: 'We could not find your profile to save list choices. Please sign in again.' },
            { status: 409 }
          )
        }
      }
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('subscribe POST failed:', error)
    return NextResponse.json({ error: 'Could not save your preferences' }, { status: 500 })
  }
}
