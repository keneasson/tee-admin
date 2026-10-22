import { NextRequest, NextResponse } from 'next/server'
import { getContact, setUnsubscribeAll } from '@/utils/email/contact'
import { verifyEcclesiaToken } from '@/utils/email/ecclesia-token'
import { auth } from '@/utils/auth'
import { personForSessionEmail } from '@/utils/session-person'
import { maskEmail } from '@/utils/mask-email'
import { getTenantFromHeaders, resolveTenantFromEnv } from '@my/app/config/tenants'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { mailingListRepository } from '@my/app/provider/dynamodb/repositories/mailing-list-repository'
import { ecclesiaIdOf, slugifyEcclesia } from '@my/app/provider/dynamodb/people-index/keys'
import { getDefaultRegion } from '@my/app/config/regions'
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
 * Self-serve subscription management (Issue #75, R5).
 *
 * Writes ONLY the mailing-list registry (SUB# rows), plus the SES contact's
 * UnsubscribeAll ("stop all email"), which stays in SES. No SES topic is read
 * or written: topics are safety nets now, not lists.
 *
 * SECURITY: only self-serve lists (reminders / newsletters) are shown or
 * changed. Office / membership lists (inter-ecclesial correspondence, members,
 * the test list) are conferred by role, never self-serve.
 */
async function emailForToken(token: string | null): Promise<string | null> {
  if (!token) return null
  const res = await verifyEcclesiaToken(token)
  return res.valid && res.email ? res.email.toLowerCase() : null
}

/**
 * Resolve which address this request is about, and whether the caller has
 * proven it's theirs.
 *
 *  - An email link (`?token=`) is about the address that email was SENT to.
 *    The caller is authenticated for it only when they're signed in as a
 *    person who holds that address (compared by person, not by email);
 *    otherwise it's recognized (masked, read-only), as for a forward.
 *  - With no valid token, a signed-in caller manages their own sign-in
 *    address (e.g. arriving from the profile page).
 */
async function resolveIdentity(
  token: string | null
): Promise<{ email: string; authenticated: boolean; session: any } | null> {
  const session = await auth()
  const sessionEmail = session?.user?.email?.toLowerCase() || null
  const fromToken = await emailForToken(token)
  if (fromToken) {
    const authenticated = !!sessionEmail && (await signedInPersonHolds(sessionEmail, fromToken))
    return { email: fromToken, authenticated, session: authenticated ? session : null }
  }
  if (sessionEmail) return { email: sessionEmail, authenticated: true, session }
  return null
}

/** Is `address` one of the signed-in person's addresses? (A household address can have several holders.) */
async function signedInPersonHolds(sessionEmail: string, address: string): Promise<boolean> {
  if (address === sessionEmail) return true
  const me = await personForSessionEmail(sessionEmail)
  if (!me) return false
  const holders = await personRepository.getAllPersonsByEmail(address)
  return holders.some((p) => p.personId === me.personId)
}

/**
 * Every self-serve list offered to this address (scope ladder from the
 * person's ecclesia), plus any list it already has a registry row on, grouped
 * by owner with its registry state (defaultOptIn applied).
 */
async function loadListPreferences(email: string) {
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

/** GET /api/subscribe?token=… (or a session) → the lists offered to this address and its state on each. */
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')
  const id = await resolveIdentity(token)
  if (!id) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
  }
  const email = id.email
  try {
    // getContact() is null when the address isn't an SES contact: not stopped.
    const [contact, listGroups] = await Promise.all([getContact(email), loadListPreferences(email)])
    return NextResponse.json({
      ...identityFields(id),
      listGroups,
      name: await firstNameForEmail(email),
      unsubscribedAll: !!contact?.UnsubscribeAll,
      tenant: tenantBrand(request),
    })
  } catch (error) {
    console.error('subscribe GET failed:', error)
    return NextResponse.json({ error: 'Could not load your preferences' }, { status: 500 })
  }
}

/**
 * POST /api/subscribe { token, lists: { [listId]: boolean }, unsubscribeAll?: boolean }
 * Writes the registry for changed self-serve lists, and UnsubscribeAll in SES.
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

  try {
    // Only lists whose state actually changed are written, so saving never
    // turns a list's defaultOptIn into a stored row.
    let changes: ReturnType<typeof planListSave>['changes'] = []
    if (body?.lists && typeof body.lists === 'object') {
      const current = new Map(
        (await loadListPreferences(email)).flatMap((g) => g.lists.map((l) => [l.listId, l.subscribed] as const))
      )
      changes = planListSave(body.lists, await mailingListRepository.listAllLists(), current).changes
    }

    if (changes.length > 0) {
      const deps = await defaultSubscriptionDeps()
      // Registry choices need a person; check before any write so a save is
      // never half-applied.
      if (!(await resolveSubscriber(email, deps))) {
        return NextResponse.json(
          { error: 'We could not find your profile to save list choices. Please sign in again.' },
          { status: 409 }
        )
      }
      for (const change of changes) {
        const result = await setListSubscription(
          {
            listId: change.list.listId,
            email,
            subscribed: change.subscribed,
            defaultOptIn: change.list.defaultOptIn === true,
          },
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

    // "Stop all email" stays in SES (UnsubscribeAll), the gate every send checks.
    if (typeof body?.unsubscribeAll === 'boolean') {
      await setUnsubscribeAll(email, body.unsubscribeAll)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('subscribe POST failed:', error)
    return NextResponse.json({ error: 'Could not save your preferences' }, { status: 500 })
  }
}
