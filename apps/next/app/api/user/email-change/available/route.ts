import { NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { requireFreshAuth } from '../../../../../utils/require-fresh-auth'

/**
 * GET /api/user/email-change/available — is the secure email-change feature
 * visible to THIS session, and is a fresh step-up already satisfied?
 *
 * `available`: the client `useFeatureFlag` hook is presence-based (always true
 * once a flag is defined), so it can't drive a launch-dark UI. This resolves the
 * flag server-side per session (same check the start/confirm routes enforce),
 * letting the UI self-hide for everyone the flag doesn't target while an admin can
 * exercise it in prod behind the flag.
 *
 * `freshAuth`: whether `requireFreshAuth()` currently passes (read-only, no side
 * effects). Lets the UI escalate the ORIGIN proof (the "confirm it's you" step-up)
 * BEFORE the new-email form for a low-trust visitor (e.g. arrived via a newsletter
 * deep-link) instead of interrupting them after they submit.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ available: false, freshAuth: false })
  }
  const available = await checkFeatureFlagFromDB(FEATURE_FLAGS.SECURE_EMAIL_CHANGE, session as any)
  const gate = await requireFreshAuth()
  return NextResponse.json({ available: !!available, freshAuth: gate.ok })
}
