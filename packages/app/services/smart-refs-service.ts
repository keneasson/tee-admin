/**
 * Resolve a batch of smart references for one viewer (plan §0 R6, ADR-0006 §7,
 * ADR-0005). The one server path behind `POST /api/smart-refs` and the
 * server-side post render.
 *
 * Every read is a BatchGetItem or a keyed Query — never a Scan (ADR-0006 §8):
 *
 *   1. BatchGet  PERSON#<id> / CARD  +  ECCLESIA_ID#<id> / ECCLESIA      (the references)
 *      Query     ECCLESIA_ID#<id>, begins_with(skey, 'OFFICE#')         (each ecclesia's offices, in parallel)
 *   2. BatchGet  the ECCLESIA#… source items  +  office holders' CARDs not already read
 *   3. BatchGet  the people's privacy settings (privacyRepository)
 *   4. BatchGet  connections, only for people whose privacy depends on one
 *
 * A post with 5 people and an ecclesia costs ~3 RRU (plan §9). Shaping per
 * viewer tier is pure and lives in `utils/smart-refs-shape.ts`.
 *
 * Needs the people projections (#278): callers check `peopleIndexReady()`
 * first, because before the backfill a missing CARD would read as "not found".
 */
import { batchGetItems } from '../provider/dynamodb/people-index/reader'
import { CARD_SK, ECCLESIA_ALIAS_SK, ecclesiaIdPk, type PersonCard } from '../provider/dynamodb/people-index/keys'
import { officeRepository, type OfficeRecord } from '../provider/dynamodb/repositories/office-repository'
import { privacyRepository } from '../provider/dynamodb/repositories/privacy-repository'
import { connectionRepository } from '../provider/dynamodb/repositories/connection-repository'
import type { Viewer } from '../utils/viewer-pii'
import {
  type EcclesiaAlias,
  type EcclesiaSourceFields,
  isUnrenderablePerson,
  needsConnectionCheck,
  shapeEcclesia,
  shapePerson,
} from '../utils/smart-refs-shape'
import { MAX_SMART_REFS, type SmartPerson, type SmartRef, type SmartRefResult } from '../types/smart-refs'
import type { Post } from '../types/post'
import { applyContactRefs, postContactRefs } from '../utils/post-references'
import { peopleIndexReady } from '../provider/dynamodb/people-index/reader'

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/

/**
 * Validate and de-duplicate untrusted input. Returns the references in first-
 * seen order, or an error message.
 */
export function parseSmartRefs(input: unknown): { refs: SmartRef[] } | { error: string } {
  if (!Array.isArray(input)) return { error: 'refs must be an array' }
  const seen = new Set<string>()
  const refs: SmartRef[] = []
  for (const raw of input) {
    const type = (raw as any)?.type
    const id = (raw as any)?.id
    if ((type !== 'person' && type !== 'ecclesia') || typeof id !== 'string' || !ID_RE.test(id)) {
      return { error: 'each ref must be { type: "person" | "ecclesia", id }' }
    }
    const key = `${type}:${id}`
    if (seen.has(key)) continue
    seen.add(key)
    refs.push({ type, id })
  }
  if (refs.length > MAX_SMART_REFS) return { error: `at most ${MAX_SMART_REFS} refs per request` }
  return { refs }
}

const personKey = (id: string) => ({ pkey: `PERSON#${id}`, skey: CARD_SK })

/** Resolve `refs` for `viewer`. Results come back in the order of `refs`. */
export async function resolveSmartRefs(refs: SmartRef[], viewer: Viewer): Promise<SmartRefResult[]> {
  if (refs.length === 0) return []
  const personIds = refs.filter((r) => r.type === 'person').map((r) => r.id)
  const ecclesiaIds = refs.filter((r) => r.type === 'ecclesia').map((r) => r.id)

  // 1. The references themselves, and each ecclesia's offices.
  const [firstBatch, officesByEcclesia] = await Promise.all([
    batchGetItems<Record<string, any>>([
      ...personIds.map(personKey),
      ...ecclesiaIds.map((id) => ({ pkey: ecclesiaIdPk(id), skey: ECCLESIA_ALIAS_SK })),
    ]),
    Promise.all(ecclesiaIds.map(async (id) => [id, await officeRepository.listOffices(id)] as const)),
  ])
  const cards = new Map<string, PersonCard>()
  const aliases = new Map<string, EcclesiaAlias>()
  for (const item of firstBatch) {
    if (item.skey === CARD_SK) cards.set(item.personId, item as PersonCard)
    else if (item.skey === ECCLESIA_ALIAS_SK) aliases.set(item.ecclesiaId, item as EcclesiaAlias)
  }
  const offices = new Map<string, OfficeRecord[]>(officesByEcclesia)

  // 2. Ecclesia source items (venue, address) and holders not already read.
  const holderIds = [
    ...new Set(
      [...offices.values()].flat().map((o) => o.holderPersonId).filter((id): id is string => !!id && !cards.has(id))
    ),
  ]
  const secondBatch = await batchGetItems<Record<string, any>>([
    ...[...aliases.values()].map((a) => ({ pkey: a.ecclesiaPkey, skey: a.ecclesiaSkey })),
    ...holderIds.map(personKey),
  ])
  const sources = new Map<string, EcclesiaSourceFields>()
  for (const item of secondBatch) {
    if (item.skey === CARD_SK) cards.set(item.personId, item as PersonCard)
    else if (item.type === 'ECCLESIA') sources.set(`${item.pkey}\u0000${item.skey}`, item as EcclesiaSourceFields)
  }

  // 3–4. Privacy (and, where it depends on one, the connection) for every person shown.
  const shown = [...cards.values()].filter((c) => !isUnrenderablePerson(c))
  const privacy = await privacyRepository.getPrivacySettingsForPeople(
    shown.map((c) => ({ personId: c.personId, primaryEmail: c.primaryEmail, emails: (c.emails || []).map((e) => e.email) }))
  )
  const needConnection = shown.filter((c) => c.primaryEmail && needsConnectionCheck(c, privacy.get(c.personId), viewer))
  const connected =
    needConnection.length > 0 && viewer.email
      ? await connectionRepository.connectedTo(
          needConnection.map((c) => c.primaryEmail),
          viewer.email.trim().toLowerCase()
        )
      : new Set<string>()

  const person = (card: PersonCard, includeId: boolean): SmartPerson =>
    shapePerson(card, {
      viewer,
      privacy: privacy.get(card.personId),
      connected: connected.has(card.primaryEmail),
      includeId,
    })

  // An office holder's id is directory linkage: identified viewers only (as in redact-post).
  const holderIncludesId = viewer.assurance !== 'anonymous'
  const holders = new Map<string, SmartPerson>()
  for (const id of new Set([...offices.values()].flat().map((o) => o.holderPersonId).filter(Boolean) as string[])) {
    const card = cards.get(id)
    if (card && !isUnrenderablePerson(card)) holders.set(id, person(card, holderIncludesId))
  }

  return refs.map((ref): SmartRefResult => {
    if (ref.type === 'person') {
      const card = cards.get(ref.id)
      return card && !isUnrenderablePerson(card) ? person(card, true) : { type: 'person', id: ref.id, found: false }
    }
    const alias = aliases.get(ref.id)
    if (!alias) return { type: 'ecclesia', id: ref.id, found: false }
    return shapeEcclesia(alias, {
      viewer,
      source: sources.get(`${alias.ecclesiaPkey}\u0000${alias.ecclesiaSkey}`) || null,
      offices: offices.get(ref.id) || [],
      holders,
    })
  })
}

/**
 * Fill a post's referenced registration contacts for `viewer`, BEFORE
 * `redactPost` (plan §0 R6). A post with no references is returned as is, with
 * no reads. Never fails the read: if the people index is not built yet, or a
 * read fails, each block keeps what it stored (its first-name floor).
 */
export async function resolvePostReferences(post: Post, viewer: Viewer): Promise<Post> {
  const ids = postContactRefs(post)
  if (ids.length === 0) return post
  try {
    if (!(await peopleIndexReady())) return post
    const results = await resolveSmartRefs(
      ids.map((id) => ({ type: 'person' as const, id })),
      viewer
    )
    const people = new Map<string, SmartPerson>()
    for (const r of results) if (r.type === 'person' && r.found && r.id) people.set(r.id, r)
    return applyContactRefs(post, people)
  } catch (error) {
    console.error('smart-refs: could not resolve post references; using stored contacts', error)
    return post
  }
}
