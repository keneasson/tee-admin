import { NextRequest, NextResponse } from 'next/server'
import { computeNextTargetSunday } from '@/utils/email/exhorter-heads-up'
import {
  prepareHeadsUpForReview,
  sendHeadsUpProblemNotice,
} from '@/utils/email/exhorter-heads-up-review'
import {
  describeHeadsUpProblem,
  describeHeadsUpFailure,
} from '@/utils/email/exhorter-heads-up-problem'

/**
 * Saturday job for the exhorter heads-up (#124, slice B).
 *
 * Called by the EventBridge scheduler. It resolves who is exhorting three
 * Sundays out (the Saturday two weeks before), renders the email, parks it, and
 * emails the Recording Brother a link to the review page.
 *
 * When no review copy can be prepared — a name that matches nobody or more
 * than one person, no email on file, no schedule row, a changed Sunday, or an
 * error — the Recording Brother is emailed what went wrong and how to fix it
 * (#332). The scheduler discards this route's response, so without that email
 * a failure is silent.
 *
 * **It never writes to the exhorter.** The send happens when a person presses
 * the button on that page. Until several weeks of these have been read and
 * trusted, a cron must not be able to email a visiting brother on its own —
 * and there is no auto-send path here to forget to turn off.
 *
 * Bearer-authenticated with EMAIL_SENDER_SECRET, like the other cron endpoints.
 */

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

async function run(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.EMAIL_SENDER_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return unauthorized()
  }

  // An explicit date is for re-running a specific Sunday by hand; the scheduled
  // path always computes it, so the notice period lives in ONE place.
  const explicit = request.nextUrl.searchParams.get('date')?.trim()
  const date = explicit || computeNextTargetSunday()

  try {
    const result = await prepareHeadsUpForReview({ date })

    const problem = result.parked ? null : describeHeadsUpProblem(result.report)
    let problemNotified = false
    if (problem) {
      problemNotified = await sendHeadsUpProblemNotice({
        date,
        problem,
        reviewerEmail: result.reviewerEmail,
      }).catch((error) => {
        console.error('[exhorter-headsup] problem notice failed:', error)
        return false
      })
    }

    // Report the outcome either way. A cron that silently does nothing is
    // indistinguishable from a cron that is broken — and the statuses that do
    // nothing (an unresolved name, a placeholder, a cancelled Sunday) are
    // exactly the ones a human needs to know about.
    return NextResponse.json({
      success: true,
      date,
      parked: result.parked,
      status: result.report.status,
      exhortName: result.report.exhortName,
      matchStatus: result.report.matchStatus,
      note: result.report.note,
      reviewerEmail: result.reviewerEmail,
      problemNotified,
      // The URL is deliberately NOT returned — it is a capability, and it
      // belongs only in the email to the reviewer.
    })
  } catch (error) {
    console.error('[exhorter-headsup] Saturday job failed:', error)
    await sendHeadsUpProblemNotice({ date, problem: describeHeadsUpFailure() }).catch((noticeError) => {
      console.error('[exhorter-headsup] failure notice also failed:', noticeError)
    })
    return NextResponse.json({ error: 'Failed to prepare the heads-up' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return run(request)
}

/** EventBridge/Vercel schedulers issue a GET; the work is identical. */
export async function GET(request: NextRequest) {
  return run(request)
}
