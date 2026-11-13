import { getTrust, meetsAssurance, type Trust } from '../auth-trust'
import { verifyEcclesiaToken } from '../email/ecclesia-token'
import { personForSessionEmail } from '../session-person'
import { mayActAs } from '../sign-in-identity'

/**
 * Who is acting on an invitation or swap (spec §6).
 *
 * `getTrust()` lets a live session win over the link's token. When the session
 * belongs to SOMEONE ELSE (a partner, a forwarded email, a shared device) but
 * the token is the speaker's own, `mismatch` is true: the client signs the
 * other session out and exchanges the token (`/auth/signin-token`) for a
 * `recognized` session as the speaker, then retries. The API never acts for the
 * wrong person — it only reports the mismatch.
 */

export interface InviteSubject {
  /** The speaker whose booking this is (invitee, or a swap's target). */
  personId: string
  email?: string | null
}

export interface InviteActor {
  trust: Trust
  personId: string | null
  isInvitee: boolean
  mismatch: boolean
}

async function personIdFor(email: string | null | undefined): Promise<string | null> {
  if (!email) return null
  const person = await personForSessionEmail(email).catch(() => null)
  return person?.personId ?? null
}

function same(a?: string | null, b?: string | null): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()
}

export async function resolveInviteActor(
  subject: InviteSubject,
  opts: { ecclesiaToken?: string | null } = {}
): Promise<InviteActor> {
  const ctx = await getTrust({ ecclesiaToken: opts.ecclesiaToken ?? null })
  if (ctx.trust === 'anonymous' || !ctx.email) {
    return { trust: 'anonymous', personId: null, isInvitee: false, mismatch: false }
  }

  // The session's chosen person ("Are you A or B?"), or the address's default holder.
  const personId = await personIdFor(ctx.email)
  // A shared household address is trusted (§9a): whoever proved it, or anyone
  // who can use it (`peopleWhoCanUse`), may act on this speaker's invite. The
  // history still records `personId`, the person actually acting.
  const isInvitee =
    personId === subject.personId ||
    same(ctx.email, subject.email) ||
    (!!personId && !!subject.email && (await mayActAs(personId, subject.email).catch(() => false)))

  let mismatch = false
  if (!isInvitee && ctx.session && opts.ecclesiaToken) {
    // The session is someone else's. Is the link's token the speaker's own?
    const res = await verifyEcclesiaToken(opts.ecclesiaToken)
    if (res.valid && res.email) {
      mismatch = same(res.email, subject.email) || (await personIdFor(res.email)) === subject.personId
    }
  }

  return { trust: ctx.trust, personId, isInvitee, mismatch }
}

export type ActorRefusal = {
  status: 401 | 403
  body: { error: string; code: string; trust: Trust; required?: Trust; stepUpRequired?: boolean; mismatch?: boolean }
}

/**
 * The gate for an invitee action. `min` is `recognized` for view / accept /
 * change / cancel / respond-to-swap and `authenticated` for requesting a swap.
 * Returns null when the actor may proceed.
 */
export function refuseActor(actor: InviteActor, min: Trust): ActorRefusal | null {
  if (actor.mismatch) {
    return {
      status: 403,
      body: {
        error: 'You are signed in as someone else. Continue as the invited speaker.',
        code: 'SESSION_MISMATCH',
        trust: actor.trust,
        mismatch: true,
      },
    }
  }
  if (actor.trust === 'anonymous') {
    return { status: 401, body: { error: 'Sign in to continue.', code: 'SIGN_IN_REQUIRED', trust: actor.trust, required: min } }
  }
  if (!actor.isInvitee) {
    return { status: 403, body: { error: 'This invitation is for someone else.', code: 'NOT_INVITEE', trust: actor.trust } }
  }
  if (!meetsAssurance(actor.trust, min)) {
    return {
      status: 403,
      body: {
        error: "Please confirm it's you to continue.",
        code: 'STEP_UP_REQUIRED',
        trust: actor.trust,
        required: min,
        stepUpRequired: true,
      },
    }
  }
  return null
}
