import { NextRequest, NextResponse } from 'next/server'
import { requireAssurance } from '../../../../../../utils/auth-trust'
import { checkEcclesiaEditPermission } from '../../../../../../utils/ecclesia-permissions'
import { migrateSubscriptions } from '../../../../../../utils/email/contact'
import { notifyLoginEmailChanged } from '../../../../../../utils/email/notify-login-email-changed'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { invalidatePeopleCache } from '../../../../people/cache'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/admin/people/[personId]/email-change
 *
 * RB/Rep "assist a member": an authenticated content manager changes a member's
 * login email ON THEIR BEHALF — the admin-attested counterpart of the self-serve
 * /api/user/email-change flow, with NO confirmation-code round-trip (the RB has
 * already proven who they are and is vouching for the change).
 *
 * Auth gate:
 *   1. requireAssurance('authenticated') — a fully signed-in operator; no fresh
 *      step-up (that's for a person changing their OWN login).
 *   2. target must exist (404).
 *   3. actor may not target their OWN primary address — that's the self-serve
 *      flow, not "assist" (400).
 *   4. actor must have edit permission over the TARGET's ecclesia (403).
 *
 * Body (three modes):
 *   { correctEmailId, newEmail }         — CORRECT an address (typo fix). The
 *                                          member page's pencil. Login row → its
 *                                          login moves and the wrong address is
 *                                          REMOVED, not kept or notified (it
 *                                          bounces). Other rows → fixed in place.
 *   { newEmail }                         — change to a brand-new address.
 *   { promoteEmailId } | { email }       — promote an existing VERIFIED secondary.
 *
 * After a login transfer: move SES + PersonRecord topic subscriptions, notify
 * the OLD address (not for a correction), invalidate the people cache.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  try {
    // 1. A fully signed-in operator — NOT requireFreshAuth (no self step-up).
    const gate = await requireAssurance('authenticated')
    if (!gate.ok) return gate.response

    const actorEmail = gate.ctx.email
    if (!actorEmail) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { personId } = await params
    if (!personId) {
      return NextResponse.json({ error: 'Missing personId' }, { status: 400 })
    }

    // 2. Target must exist.
    const targetPerson = await personRepository.getById(personId)
    if (!targetPerson) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    // 3. Reject self — that's the self-serve flow, not "assist a member".
    const targetPrimary = (targetPerson.primaryEmail || '').toLowerCase()
    if (actorEmail === targetPrimary) {
      return NextResponse.json(
        { error: 'Use the self-serve email change for your own login.' },
        { status: 400 }
      )
    }

    // 4. Actor must be able to edit the TARGET's ecclesia.
    const actorPerson = await personRepository.getByEmail(actorEmail)
    const actorRole = actorPerson?.role || (gate.ctx.session?.user as any)?.role || ROLES.GUEST
    const canEdit = await checkEcclesiaEditPermission(
      actorEmail,
      actorRole,
      targetPerson.ecclesia
    )
    if (!canEdit) {
      return NextResponse.json(
        { error: 'You do not have permission to manage this person.' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))

    // Resolve the target address for each mode BEFORE any write.
    let newEmail = ''
    let isCorrection = false

    const correctEmailId =
      typeof body?.correctEmailId === 'string' ? body.correctEmailId.trim() : ''
    if (correctEmailId) {
      const corrected = typeof body?.newEmail === 'string' ? body.newEmail.trim().toLowerCase() : ''
      if (!corrected || !EMAIL_RE.test(corrected)) {
        return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
      }
      const row = (await personRepository.getEmails(targetPerson.personId)).find(
        (r) => r.emailId === correctEmailId
      )
      if (!row) {
        return NextResponse.json({ error: "That address isn't on this person's account." }, { status: 400 })
      }
      if (row.email.toLowerCase() === corrected) {
        return NextResponse.json({ success: true, newEmail: corrected, movedTopics: [] })
      }
      const owners = await personRepository.getAllPersonsByEmail(corrected)
      if (owners.some((p) => p.personId !== targetPerson.personId)) {
        return NextResponse.json(
          { error: 'That email address is already in use by another person.' },
          { status: 409 }
        )
      }
      if (row.emailType !== 'primary') {
        // A non-login address: fix it in place. Login is untouched.
        await personRepository.correctSecondaryEmail(targetPerson.personId, row.emailId, corrected)
        invalidatePeopleCache()
        return NextResponse.json({ success: true, newEmail: corrected, movedTopics: [] })
      }
      newEmail = corrected
      isCorrection = true
    }

    const promoteEmailId =
      typeof body?.promoteEmailId === 'string' ? body.promoteEmailId.trim() : ''
    const promoteEmail =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (isCorrection) {
      // resolved above
    } else if (promoteEmailId || promoteEmail) {
      // Promote mode: the address must already be a VERIFIED row on the target.
      const rows = await personRepository.getEmails(targetPerson.personId)
      const row = promoteEmailId
        ? rows.find((r) => r.emailId === promoteEmailId)
        : rows.find((r) => r.email.toLowerCase() === promoteEmail)

      if (!row) {
        return NextResponse.json(
          { error: "That address isn't on this person's account." },
          { status: 400 }
        )
      }
      if (row.verified !== true) {
        return NextResponse.json(
          { error: 'That address must be verified before it can become the login.' },
          { status: 400 }
        )
      }
      if (row.emailType === 'primary') {
        return NextResponse.json(
          { error: "That's already this person's login email." },
          { status: 400 }
        )
      }
      newEmail = row.email.toLowerCase()
    } else {
      // Change mode: a brand-new address.
      newEmail = typeof body?.newEmail === 'string' ? body.newEmail.trim().toLowerCase() : ''
      if (!newEmail || !EMAIL_RE.test(newEmail)) {
        return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
      }
      if (newEmail === targetPrimary) {
        return NextResponse.json(
          { error: "That's already this person's login email." },
          { status: 400 }
        )
      }

      // Collision guard: refuse an address that belongs to a DIFFERENT person.
      const owners = await personRepository.getAllPersonsByEmail(newEmail)
      const conflict = owners.find((p) => p.personId !== targetPerson.personId)
      if (conflict) {
        return NextResponse.json(
          { error: 'That email address is already in use by another person.' },
          { status: 409 }
        )
      }
    }

    // Identity transfer (PersonRecords): promote new → primary, demote old →
    // recoverable secondary, re-point the login index. This flips the PROFILE
    // (the login handle) LAST, so a mid-failure leaves login on the OLD address.
    const { oldEmail } = await personRepository.changePrimaryEmail(
      targetPerson.personId,
      newEmail,
      { replace: isCorrection }
    )

    // Post-transfer side effects — best-effort so they can't fail the change that
    // already succeeded.
    let movedTopics: string[] = []
    if (oldEmail && oldEmail !== newEmail) {
      try {
        const res = await migrateSubscriptions(oldEmail, newEmail, {
          personId: targetPerson.personId,
        })
        movedTopics = res.movedTopics
      } catch (error) {
        console.error('admin email-change: migrateSubscriptions failed (non-fatal):', error)
      }

      // Notify the OLD address so the member catches an unwanted change (best-effort
      // internally) — the RB did it, but the member still gets the paper trail.
      // Not for a correction: the old address was wrong and would only bounce.
      if (!isCorrection) {
        await notifyLoginEmailChanged({ oldEmail, newEmail, headers: request.headers })
      }
    }

    invalidatePeopleCache()

    return NextResponse.json({ success: true, newEmail, movedTopics })
  } catch (error) {
    console.error('admin email-change error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to change email' },
      { status: 500 }
    )
  }
}
