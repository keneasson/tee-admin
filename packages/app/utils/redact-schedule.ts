/**
 * Server-side PII redaction for schedule data (Phase 0 — see
 * docs/UNIFIED_POST_MODEL_DESIGN.md). Schedule rows carry role assignments as
 * full-name STRINGS (e.g. Presider "Brad Stephens", Doorkeeper "Ken Easson"), not
 * structured names. For anon we reduce each to its FIRST NAME ("Brad", "Ken") —
 * sufficiently non-identifying — and drop precise host addresses. Bible readings,
 * hymns, topics, dates etc. are NOT names and pass through untouched.
 *
 * Works by field NAME so it applies to any schedule response shape (the flattened
 * /api/enhanced-schedule rows and the raw /api/schedule/[type] rows alike): a
 * generic walk that redacts known person/location keys wherever they appear.
 *
 * Reveal tier (member+ or the newsletter-email channel) passes through unchanged.
 */
import { canRevealPii, firstNameOf, type Viewer, type Channel } from './viewer-pii'

// Keys whose value is a person's full-name string (across memorial/bibleClass/
// sundaySchool/cyc rows). Verified against live schedule data.
const PERSON_KEYS = new Set([
  'Preside',
  'Exhort',
  'Organist',
  'Steward',
  'Doorkeeper',
  'Collection',
  'Lunch',
  'Presider',
  'Speaker',
  'Refreshments',
  'speaker', // cyc
])

// Precise-location keys → dropped for anon (host ecclesia street address / map link).
const DROP_KEYS = new Set(['resolvedAddress', 'resolvedMapUrl'])

const looksLikeAddress = (v: string) => /\d/.test(v) // a street number ⇒ precise address

function walk(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(walk)
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (DROP_KEYS.has(k)) continue
      if (PERSON_KEYS.has(k) && typeof v === 'string') {
        out[k] = firstNameOf(v)
      } else if (k === 'InPerson' && typeof v === 'string' && looksLikeAddress(v)) {
        // "Yes" / online note stays; an in-person street address collapses to "Yes".
        out[k] = 'Yes'
      } else if (k === 'location' && typeof v === 'string' && looksLikeAddress(v)) {
        // Drop an address-like free-text location (venue-name strings pass through).
        continue
      } else {
        out[k] = walk(v)
      }
    }
    return out
  }
  return node
}

/**
 * Redact any schedule response (array, `{data:{memorial:[…]}}`, single row, etc.)
 * for the given viewer/channel. Member+ / newsletter-email passes through unchanged.
 */
export function redactScheduleData<T>(data: T, viewer: Viewer, channel: Channel = 'public-web'): T {
  if (canRevealPii(viewer, channel)) return data
  return walk(data) as T
}
