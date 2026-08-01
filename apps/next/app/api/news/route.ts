import { NextResponse } from 'next/server'
import { listNewsItems } from '@my/app/services/news-service'
import { auth } from '@/utils/auth'
import { resolveViewer } from '@/utils/resolve-viewer'
import { redactNewsForViewer } from '@/utils/redact-news'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'

/**
 * Public News API — returns active news items (expired items are filtered out).
 *
 * PII read boundary (Consolidated CMS Phase 0, epic #131): behind the
 * CONSOLIDATED_CMS flag, each item is run through the unified block model
 * (`legacyToPost` → `redactPost`) for the resolved viewer, then projected back
 * onto the NewsItem shape so the client contract is unchanged. This scrubs the
 * anon web view of PII-bearing news (e.g. a `medical` update's body + flyers
 * default to member-only reach — anon sees title + summary only).
 *
 * FLAG-GATED + ADDITIVE: when the flag is OFF the raw items are returned exactly
 * as before (byte-identical) — the shared path is not mutated for un-flagged
 * reasons. Flip the flag to 'everyone' to ship the scrub to all readers.
 */
export async function GET() {
  try {
    const items = await listNewsItems({ includeExpired: false })

    const session = await auth()
    const flagOn = await checkFeatureFlagFromDB(FEATURE_FLAGS.CONSOLIDATED_CMS, session as any)
    if (!flagOn) {
      // Flag OFF → unchanged legacy behaviour (byte-identical).
      return NextResponse.json(items)
    }

    const viewer = await resolveViewer()
    const redacted = items.map((item) => redactNewsForViewer(item, viewer))
    return NextResponse.json(redacted)
  } catch (error) {
    console.error('Error listing news (public):', error)
    return NextResponse.json({ error: 'Failed to list news' }, { status: 500 })
  }
}
