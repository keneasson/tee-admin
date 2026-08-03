import { NextResponse } from 'next/server'
import { getPublicPosts } from '../../../../utils/get-public-posts'

/**
 * Public unified-Post read for the live web pages (Consolidated CMS #131,
 * Phase 4b-1). Returns the ACTIVE, viewer-redacted NATIVE posts split by facet:
 * `{ events, news }` — the events page renders `events`, the news page renders
 * `news`, each via the shared read-only `<PostView>`.
 *
 * ADDITIVE + FLAG-GATED: with `CONSOLIDATED_CMS` OFF this returns
 * `{ events: [], news: [] }` (see {@link getPublicPosts}) so the live pages show
 * nothing extra and stay byte-identical to today. Legacy events/news render
 * through their OWN untouched endpoints (`/api/events/public`, `/api/news`) — this
 * route never double-renders them.
 *
 * Per-viewer + PII-aware, so it is never shared-cached (private, no-store).
 */
export async function GET() {
  try {
    const posts = await getPublicPosts()
    return NextResponse.json(posts, {
      headers: {
        'Cache-Control': 'private, no-store',
        Vary: 'Cookie',
      },
    })
  } catch (error) {
    // Additive surface — a native-post read failure must NOT break the legacy
    // page. Fail closed to "nothing extra".
    console.error('Error loading public posts:', error)
    return NextResponse.json({ events: [], news: [] })
  }
}
