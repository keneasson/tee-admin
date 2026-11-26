/**
 * Merge one ecclesia record into another — the ONLY merge path.
 *
 * Duplicate records ("Brantford" and "Brantford Ecclesia") are one ecclesia.
 * Merging moves EVERYTHING that points at the source onto the target, then
 * deletes the source:
 *
 *   - people whose home ecclesia is the source (PROFILE `ecclesia` → cards follow)
 *   - offices: inbox / phone / postal address / holder, onto the target's office
 *   - posts: location blocks that name or reference the source, and posts the
 *     source OWNS (tenant is in the base key → re-keyed in one TransactWrite)
 *   - events: hosting / owning ecclesia
 *   - mailing lists the source owns
 *   - other ecclesias' nearby / excluded lists that name the source
 *   - open Recording Brother nominations at the source (withdrawn)
 *   - org fields the target lacks (address, phone, website, schedule config, …);
 *     never the stale copied Recording Brother name/email
 *
 * Things that can't be moved safely yet BLOCK the merge (nothing is written):
 * schedule sources, saved invitation programs, speaker invitations, a list key
 * the target already uses, a closed target, the home ecclesia as source.
 *
 * Three parts so each is testable on its own:
 *   loadMergeSnapshot  — read-only; everything the plan needs
 *   buildMergePlan     — PURE; the exact change list (this IS the dry run)
 *   applyMergePlan     — performs the plan's steps in order, source deleted LAST
 * Re-running after a partial failure is safe: the plan is rebuilt from what is
 * still attached to the source.
 */
import type { EcclesiaData } from './dynamodb/locations'
import type { PersonRecord, MailingListRecord, RBNominationRecord } from '@my/app/provider/dynamodb/types'
import type { OfficeRecord } from '@my/app/provider/dynamodb/repositories/office-repository'
import type { Post } from '@my/app/types/post'
import type { Event } from '@my/app/types/events'
import { ecclesiaIdOf } from '@my/app/provider/dynamodb/people-index/keys'
import { isClosedEcclesia, isSameEcclesia } from '@my/app/utils/ecclesia-name'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'

// ---------------------------------------------------------------------------
// Snapshot (read side)
// ---------------------------------------------------------------------------

export interface MergeSnapshot {
  source: EcclesiaData
  target: EcclesiaData
  /** Every ecclesia (for neighbour lists). */
  allEcclesias: EcclesiaData[]
  /** PROFILEs whose home ecclesia is the source. */
  people: Array<Pick<PersonRecord, 'personId' | 'ecclesia' | 'displayName'>>
  sourceOffices: OfficeRecord[]
  targetOffices: OfficeRecord[]
  posts: Post[]
  events: Event[]
  sourceLists: MailingListRecord[]
  targetLists: MailingListRecord[]
  openNominations: Array<Pick<RBNominationRecord, 'nominationId' | 'ecclesia'>>
  scheduleSources: number
  storedInvitePrograms: number
  speakerInvites: number
}

// ---------------------------------------------------------------------------
// Plan (pure)
// ---------------------------------------------------------------------------

export const COPYABLE_FIELDS = [
  'address',
  'postalCode',
  'venue',
  'phone',
  'contactEmail',
  'website',
  'externalLinks',
  'region',
  'logoUrl',
  'scheduleConfig',
  'timezone',
  'latitude',
  'longitude',
  'locationSource',
  'sharingPreference',
  'rbAlertPreference',
  'sharingRadiusKm',
  'newsletterEnabled',
] as const satisfies ReadonlyArray<keyof EcclesiaData>

type OfficeChannel = 'email' | 'phone' | 'postalAddress' | 'holder'

export type MergeStep =
  | { kind: 'copy-fields'; fields: string[]; values: Partial<EcclesiaData> }
  | {
      kind: 'office'
      /** The source office being folded in. */
      sourceRole: string
      sourceVersion: number
      /** Where it lands on the target: an existing office, a new one at the same id, or a new Rep slot. */
      action: 'fill-existing' | 'create' | 'new-rep-slot' | 'drop-empty'
      targetRole?: string
      copy: OfficeChannel[]
      email?: string
      phone?: string
      postalAddress?: OfficeRecord['postalAddress']
      holderPersonId?: string
    }
  | { kind: 'person'; personId: string; displayName?: string; from: string; to: string }
  | { kind: 'post'; postId: string; title: string; rehome: boolean; blocksChanged: number; blocks?: Post['blocks'] }
  | { kind: 'event'; eventId: string; title: string; fields: Array<'hostingEcclesia' | 'ownerEcclesia'> }
  | { kind: 'mailing-list'; listId: string; name: string }
  | { kind: 'neighbour-list'; ecclesiaName: string; field: 'nearbyEcclesias' | 'excludedEcclesias'; value: string[] }
  | { kind: 'withdraw-nomination'; nominationId: string }
  | { kind: 'delete-source'; name: string; ecclesiaId: string }

export interface MergePlan {
  source: { name: string; ecclesiaId: string }
  target: { name: string; ecclesiaId: string }
  /** Anything here means the merge will not run. */
  blockers: string[]
  /** Runs anyway, but someone should know. */
  warnings: string[]
  steps: MergeStep[]
  summary: {
    people: number
    offices: number
    posts: number
    events: number
    mailingLists: number
    neighbourLists: number
    nominationsWithdrawn: number
    fieldsCopied: string[]
  }
}

const isBlank = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0)

/** Re-point location blocks (anywhere in the tree) that name/reference the source. Pure; returns a new tree. */
export function repointPostBlocks(
  blocks: Post['blocks'],
  source: { name: string; ecclesiaId: string },
  target: { name: string; ecclesiaId: string }
): { blocks: Post['blocks']; changed: number } {
  let changed = 0
  const walk = (node: any): any => {
    if (Array.isArray(node)) return node.map(walk)
    if (!node || typeof node !== 'object') return node
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(node)) out[k] = walk(v)
    if (out.kind === 'location') {
      const byId = out.ecclesiaId && out.ecclesiaId === source.ecclesiaId
      const byRef = out.ecclesiaRef && isSameEcclesia(out.ecclesiaRef, source.name)
      const byVenue = out.venueName && isSameEcclesia(out.venueName, source.name)
      if (byId || byRef || byVenue) {
        changed++
        if (byId || byRef || out.mode === 'ecclesia') {
          out.ecclesiaRef = target.name
          out.ecclesiaId = target.ecclesiaId
        }
        if (byVenue) out.venueName = target.name
      }
    }
    return out
  }
  return { blocks: walk(blocks) as Post['blocks'], changed }
}

function officeHasData(o: OfficeRecord | undefined): boolean {
  return !!o && !!(o.email || o.phone || o.postalAddress || o.holderPersonId)
}

function planOffices(snap: MergeSnapshot, warnings: string[]): Extract<MergeStep, { kind: 'office' }>[] {
  const steps: Extract<MergeStep, { kind: 'office' }>[] = []
  const targetByRole = new Map(snap.targetOffices.map((o) => [o.role, o]))
  const takenRepSlots = new Set(snap.targetOffices.filter((o) => o.kind === 'rep').map((o) => o.slot || 0))
  let nextRepSlot = Math.max(0, ...takenRepSlots) + 1

  for (const s of [...snap.sourceOffices].sort((a, b) => a.role.localeCompare(b.role))) {
    const base = { kind: 'office' as const, sourceRole: s.role, sourceVersion: s.version }
    if (!officeHasData(s)) {
      steps.push({ ...base, action: 'drop-empty', copy: [] })
      continue
    }
    const t = targetByRole.get(s.role)
    const carry = (copy: OfficeChannel[]) => ({
      copy,
      ...(copy.includes('email') ? { email: s.email } : {}),
      ...(copy.includes('phone') ? { phone: s.phone } : {}),
      ...(copy.includes('postalAddress') ? { postalAddress: s.postalAddress } : {}),
      ...(copy.includes('holder') ? { holderPersonId: s.holderPersonId } : {}),
    })
    const all: OfficeChannel[] = (['email', 'phone', 'postalAddress', 'holder'] as const).filter((c) =>
      c === 'holder' ? !!s.holderPersonId : !!s[c]
    )

    if (!t) {
      steps.push({ ...base, action: 'create', targetRole: s.role, ...carry(all) })
      continue
    }
    // A second Rep is a second Rep: give it its own slot rather than overwrite.
    if (s.kind === 'rep' && officeHasData(t)) {
      steps.push({ ...base, action: 'new-rep-slot', targetRole: `rep#${nextRepSlot++}`, ...carry(all) })
      continue
    }
    const copy = all.filter((c) => (c === 'holder' ? !t.holderPersonId : !t[c]))
    for (const c of all) {
      if (copy.includes(c)) continue
      const same = c === 'holder' ? t.holderPersonId === s.holderPersonId : JSON.stringify(t[c]) === JSON.stringify(s[c])
      if (!same) {
        warnings.push(
          `${s.title || s.role}: both records have a ${c === 'holder' ? 'holder' : c === 'postalAddress' ? 'postal address' : c === 'email' ? 'office inbox' : 'phone'}; ${snap.target.name}'s is kept.`
        )
      }
    }
    steps.push({ ...base, action: 'fill-existing', targetRole: t.role, ...carry(copy) })
  }
  return steps
}

export function buildMergePlan(snap: MergeSnapshot): MergePlan {
  const source = { name: snap.source.name, ecclesiaId: ecclesiaIdOf(snap.source) }
  const target = { name: snap.target.name, ecclesiaId: ecclesiaIdOf(snap.target) }
  const blockers: string[] = []
  const warnings: string[] = []
  const steps: MergeStep[] = []

  if (source.ecclesiaId === target.ecclesiaId) blockers.push('Choose two different ecclesias.')
  if (HOME_ECCLESIA.isHomeEcclesia(source.name)) {
    blockers.push(`${source.name} is the home ecclesia; it can't be merged away.`)
  }
  if (isClosedEcclesia(snap.target)) blockers.push(`${target.name} is closed; merge into an active ecclesia.`)
  if (snap.scheduleSources > 0) {
    blockers.push(`${source.name} has ${snap.scheduleSources} schedule source(s) set up. Remove or move them first.`)
  }
  if (snap.storedInvitePrograms > 0) {
    blockers.push(`${source.name} has ${snap.storedInvitePrograms} saved invitation program(s). Move them first.`)
  }
  if (snap.speakerInvites > 0) {
    blockers.push(`${source.name} has ${snap.speakerInvites} speaker invitation(s). They can't be moved yet.`)
  }

  // 1. Org fields the target lacks.
  const values: Partial<EcclesiaData> = {}
  for (const f of COPYABLE_FIELDS) {
    if (isBlank(snap.target[f]) && !isBlank(snap.source[f])) (values as any)[f] = snap.source[f]
  }
  const fieldsCopied = Object.keys(values)
  if (fieldsCopied.length > 0) steps.push({ kind: 'copy-fields', fields: fieldsCopied, values })

  // 2. Offices.
  const officeSteps = planOffices(snap, warnings)
  steps.push(...officeSteps)

  // 3. People.
  for (const p of snap.people) {
    steps.push({ kind: 'person', personId: p.personId, displayName: p.displayName, from: p.ecclesia || source.name, to: target.name })
  }

  // 4. Posts.
  let postCount = 0
  for (const post of snap.posts) {
    const rehome = isSameEcclesia(post.tenant, source.name)
    const { blocks, changed } = repointPostBlocks(post.blocks || [], source, target)
    if (!rehome && changed === 0) continue
    postCount++
    steps.push({ kind: 'post', postId: post.id, title: post.title, rehome, blocksChanged: changed, ...(changed > 0 ? { blocks } : {}) })
  }

  // 5. Events.
  let eventCount = 0
  for (const ev of snap.events) {
    const fields: Array<'hostingEcclesia' | 'ownerEcclesia'> = []
    const hosting = typeof (ev as any).hostingEcclesia === 'string' ? (ev as any).hostingEcclesia : ev.hostingEcclesia?.name
    if (hosting && isSameEcclesia(hosting, source.name)) fields.push('hostingEcclesia')
    if (ev.ownerEcclesia && isSameEcclesia(ev.ownerEcclesia, source.name)) fields.push('ownerEcclesia')
    if (fields.length === 0) continue
    eventCount++
    steps.push({ kind: 'event', eventId: ev.id, title: ev.title, fields })
  }

  // 6. Mailing lists.
  const targetKeys = new Set(snap.targetLists.filter((l) => l.status === 'active').map((l) => l.key))
  for (const l of snap.sourceLists) {
    if (l.status === 'active' && targetKeys.has(l.key)) {
      blockers.push(`Both ecclesias have an active "${l.name}" list. Archive one first.`)
      continue
    }
    steps.push({ kind: 'mailing-list', listId: l.listId, name: l.name })
  }

  // 7. Other ecclesias' neighbour lists.
  let neighbourCount = 0
  for (const e of snap.allEcclesias) {
    const id = ecclesiaIdOf(e)
    if (id === source.ecclesiaId) continue
    for (const field of ['nearbyEcclesias', 'excludedEcclesias'] as const) {
      const list = e[field] || []
      if (!list.some((n) => isSameEcclesia(n, source.name))) continue
      const value = [...new Set(list.map((n) => (isSameEcclesia(n, source.name) ? target.name : n)))].filter(
        (n) => id !== target.ecclesiaId || !isSameEcclesia(n, target.name)
      )
      neighbourCount++
      steps.push({ kind: 'neighbour-list', ecclesiaName: e.name, field, value })
    }
  }

  // 8. Open nominations at the source are withdrawn (the target runs its own).
  for (const n of snap.openNominations) steps.push({ kind: 'withdraw-nomination', nominationId: n.nominationId })

  // 9. Last: the source record itself.
  steps.push({ kind: 'delete-source', name: source.name, ecclesiaId: source.ecclesiaId })

  return {
    source,
    target,
    blockers,
    warnings,
    steps,
    summary: {
      people: snap.people.length,
      offices: officeSteps.filter((s) => s.action !== 'drop-empty').length,
      posts: postCount,
      events: eventCount,
      mailingLists: steps.filter((s) => s.kind === 'mailing-list').length,
      neighbourLists: neighbourCount,
      nominationsWithdrawn: snap.openNominations.length,
      fieldsCopied,
    },
  }
}

// ---------------------------------------------------------------------------
// Apply (write side)
// ---------------------------------------------------------------------------

export interface MergeWriters {
  updateEcclesiaFields(name: string, updates: Record<string, any>): Promise<unknown>
  saveOffice(input: {
    ecclesiaId: string
    role: string
    email?: string | null
    phone?: string | null
    postalAddress?: OfficeRecord['postalAddress'] | null
  }): Promise<unknown>
  assignHolder(ecclesiaId: string, role: string, personId: string | null): Promise<unknown>
  deleteOffice(ecclesiaId: string, role: string, expectedVersion: number): Promise<void>
  updatePerson(personId: string, updates: { ecclesia: string }): Promise<unknown>
  updatePostBlocks(postId: string, blocks: Post['blocks']): Promise<unknown>
  rehomePost(postId: string, tenant: string, blocks?: Post['blocks']): Promise<unknown>
  updateEventEcclesia(eventId: string, fields: Array<'hostingEcclesia' | 'ownerEcclesia'>, target: EcclesiaData): Promise<unknown>
  reassignListOwner(listId: string, ownerId: string): Promise<unknown>
  withdrawNomination(ecclesia: string, nominationId: string): Promise<unknown>
  deleteEcclesia(name: string): Promise<unknown>
  invalidateCaches(): void
}

export interface MergeResult {
  completed: number
  /** The step that failed, when one did; the source is NOT deleted then. */
  failed?: { step: MergeStep; error: string }
}

export async function applyMergePlan(
  plan: MergePlan,
  snap: Pick<MergeSnapshot, 'target'>,
  w: MergeWriters
): Promise<MergeResult> {
  if (plan.blockers.length > 0) throw new Error(`Merge blocked: ${plan.blockers.join(' ')}`)
  let completed = 0
  try {
    for (const step of plan.steps) {
      try {
        await applyStep(step, plan, snap.target, w)
        completed++
      } catch (error: any) {
        return { completed, failed: { step, error: error?.message || String(error) } }
      }
    }
    return { completed }
  } finally {
    w.invalidateCaches()
  }
}

async function applyStep(step: MergeStep, plan: MergePlan, target: EcclesiaData, w: MergeWriters): Promise<void> {
  const tid = plan.target.ecclesiaId
  switch (step.kind) {
    case 'copy-fields':
      await w.updateEcclesiaFields(plan.target.name, step.values)
      return
    case 'office': {
      if (step.action !== 'drop-empty' && step.targetRole) {
        const channels = {
          ...(step.copy.includes('email') ? { email: step.email } : {}),
          ...(step.copy.includes('phone') ? { phone: step.phone } : {}),
          ...(step.copy.includes('postalAddress') ? { postalAddress: step.postalAddress } : {}),
        }
        if (step.action !== 'fill-existing' || Object.keys(channels).length > 0) {
          await w.saveOffice({ ecclesiaId: tid, role: step.targetRole, ...channels })
        }
        if (step.copy.includes('holder') && step.holderPersonId) {
          await w.assignHolder(tid, step.targetRole, step.holderPersonId)
        }
      }
      await w.deleteOffice(plan.source.ecclesiaId, step.sourceRole, step.sourceVersion)
      return
    }
    case 'person':
      await w.updatePerson(step.personId, { ecclesia: step.to })
      return
    case 'post':
      if (step.rehome) await w.rehomePost(step.postId, plan.target.name, step.blocks)
      else if (step.blocks) await w.updatePostBlocks(step.postId, step.blocks)
      return
    case 'event':
      await w.updateEventEcclesia(step.eventId, step.fields, target)
      return
    case 'mailing-list':
      await w.reassignListOwner(step.listId, tid)
      return
    case 'neighbour-list':
      await w.updateEcclesiaFields(step.ecclesiaName, { [step.field]: step.value })
      return
    case 'withdraw-nomination':
      await w.withdrawNomination(plan.source.name, step.nominationId)
      return
    case 'delete-source':
      await w.deleteEcclesia(step.name)
      return
  }
}
