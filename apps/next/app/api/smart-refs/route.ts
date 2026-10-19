import { NextRequest, NextResponse } from 'next/server'
import { resolveViewer } from '../../../utils/resolve-viewer'
import { peopleIndexReady } from '@my/app/provider/dynamodb/people-index'
import { parseSmartRefs, resolveSmartRefs } from '@my/app/services/smart-refs-service'

/**
 * POST /api/smart-refs — resolve a post's smart references for THIS viewer
 * (plan §0 R6, ADR-0006 §7, ADR-0005).
 *
 *   body:     { refs: [{ type: 'person' | 'ecclesia', id }] }   (≤ 50, de-duplicated)
 *   response: { results: SmartRefResult[], indexReady: true }   (same order as refs)
 *
 * Open to every reader, anonymous included: each result is already shaped for
 * the viewer on the server — the floor (first name; ecclesia name, venue,
 * city, office titles) for anyone, the rest per tier and per the person's own
 * privacy, with every withheld field listed with its reason. A withheld value
 * never leaves the server. Responses vary by viewer, so they are never cached.
 *
 * Reads are BatchGetItem + keyed Query only (no Scan). Until the #278 people
 * projections are backfilled there are no CARDs to read, so it answers
 * `{ results: [], indexReady: false }` rather than "not found" for everyone.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = parseSmartRefs((body as any)?.refs)
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const headers = { 'Cache-Control': 'private, no-store' }
  if (!(await peopleIndexReady())) {
    return NextResponse.json({ results: [], indexReady: false }, { headers })
  }
  try {
    const viewer = await resolveViewer()
    const results = await resolveSmartRefs(parsed.refs, viewer)
    return NextResponse.json({ results, indexReady: true }, { headers })
  } catch (error) {
    console.error('smart-refs: resolve failed', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
