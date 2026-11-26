/**
 * The I/O half of the ecclesia merge (see `ecclesia-merge.ts` for the rules):
 * read the snapshot, build the plan, and — unless `dryRun` — apply it.
 * Owner/admin only; the route enforces that.
 */
import {
  deleteEcclesia,
  getAllEcclesia,
  getEcclesiaByName,
  invalidateEcclesiaCache,
  updateEcclesiaFields,
  type EcclesiaData,
} from './dynamodb/locations'
import { ecclesiaIdOf } from '@my/app/provider/dynamodb/people-index/keys'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { officeRepository } from '@my/app/provider/dynamodb/repositories/office-repository'
import { postRepository } from '@my/app/provider/dynamodb/repositories/post-repository'
import { mailingListRepository } from '@my/app/provider/dynamodb/repositories/mailing-list-repository'
import { rbNominationRepository } from '@my/app/provider/dynamodb/repositories/rb-nomination-repository'
import { scheduleRegistryRepository } from '@my/app/provider/dynamodb/repositories/schedule-registry-repository'
import { inviteProgramRepository } from '@my/app/provider/dynamodb/repositories/invite-program-repository'
import { speakerInviteRepository } from '@my/app/provider/dynamodb/repositories/speaker-invite-repository'
import { scheduleEcclesiaId } from '@my/app/provider/dynamodb/repositories/schedule-repository'
import { getAllEvents, getEventById, updateEvent } from '@my/app/services/event-service'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'
import { invalidatePeopleCache } from '@/app/api/people/cache'
import { invalidateMemberCountsCache } from '@/app/api/admin/ecclesias/cache'
import {
  applyMergePlan,
  buildMergePlan,
  type MergePlan,
  type MergeResult,
  type MergeSnapshot,
  type MergeWriters,
} from './ecclesia-merge'

export class MergeNotFoundError extends Error {}

async function everyoneAt(name: string): Promise<PersonRecord[]> {
  const out: PersonRecord[] = []
  let lastEvaluatedKey: Record<string, any> | undefined
  do {
    const page = await personRepository.listByEcclesia(name, { lastEvaluatedKey })
    out.push(...page.items.filter((p) => p.skey === 'PROFILE'))
    lastEvaluatedKey = page.lastEvaluatedKey
  } while (lastEvaluatedKey)
  return out
}

export async function loadMergeSnapshot(sourceName: string, targetName: string): Promise<MergeSnapshot> {
  const [source, target] = await Promise.all([getEcclesiaByName(sourceName), getEcclesiaByName(targetName)])
  if (!source) throw new MergeNotFoundError(`No ecclesia named "${sourceName}"`)
  if (!target) throw new MergeNotFoundError(`No ecclesia named "${targetName}"`)
  const sourceId = ecclesiaIdOf(source)
  const targetId = ecclesiaIdOf(target)
  const schedId = scheduleEcclesiaId(source.name)

  const [
    allEcclesias,
    people,
    sourceOffices,
    targetOffices,
    posts,
    events,
    sourceLists,
    targetLists,
    openNominations,
    scheduleSources,
    storedPrograms,
    speakerInvites,
  ] = await Promise.all([
    getAllEcclesia(),
    everyoneAt(source.name),
    officeRepository.listOffices(sourceId),
    officeRepository.listOffices(targetId),
    postRepository.listAllPosts({ includeArchived: true }),
    getAllEvents(true),
    mailingListRepository.listByTenant('ecclesia', sourceId),
    mailingListRepository.listByTenant('ecclesia', targetId),
    rbNominationRepository.getOpenByEcclesia(source.name),
    scheduleRegistryRepository.listEntries(schedId),
    inviteProgramRepository.listStored(source.name),
    speakerInviteRepository.listInvitesByEcclesia(source.name),
  ])

  return {
    source,
    target,
    allEcclesias,
    people: people.map((p) => ({ personId: p.personId, ecclesia: p.ecclesia, displayName: p.displayName })),
    sourceOffices,
    targetOffices,
    posts,
    events,
    sourceLists,
    targetLists,
    openNominations,
    scheduleSources: scheduleSources.length,
    storedInvitePrograms: storedPrograms.length,
    speakerInvites: speakerInvites.length,
  }
}

function hostingOf(target: EcclesiaData) {
  return { name: target.name, ...(target.province ? { province: target.province } : {}), ...(target.city ? { city: target.city } : {}) }
}

export const defaultMergeWriters: MergeWriters = {
  updateEcclesiaFields: (name, updates) => updateEcclesiaFields(name, updates),
  saveOffice: (input) => officeRepository.saveOffice(input),
  assignHolder: (ecclesiaId, role, personId) => officeRepository.assignHolder(ecclesiaId, role, personId),
  deleteOffice: (ecclesiaId, role, version) => officeRepository.deleteOffice(ecclesiaId, role, version),
  updatePerson: (personId, updates) => personRepository.updatePerson(personId, updates),
  updatePostBlocks: (postId, blocks) => postRepository.updatePost(postId, { blocks }),
  rehomePost: (postId, tenant, blocks) => postRepository.rehomePost(postId, tenant, blocks),
  updateEventEcclesia: async (eventId, fields, target) => {
    const ev = await getEventById(eventId)
    if (!ev) throw new Error(`Event ${eventId} not found`)
    // updateEvent drops these when absent from the update, so always pass them through.
    const keep = {
      hostingEcclesia: ev.hostingEcclesia,
      location: (ev as any).location,
      locations: (ev as any).locations,
      sections: (ev as any).sections,
    }
    await updateEvent({
      id: eventId,
      ...keep,
      ...(fields.includes('hostingEcclesia') ? { hostingEcclesia: hostingOf(target) } : {}),
      ...(fields.includes('ownerEcclesia') ? { ownerEcclesia: target.name } : {}),
    } as any)
  },
  reassignListOwner: (listId, ownerId) => mailingListRepository.reassignOwner(listId, ownerId),
  withdrawNomination: (ecclesia, nominationId) => rbNominationRepository.withdraw(ecclesia, nominationId),
  deleteEcclesia: (name) => deleteEcclesia(name),
  invalidateCaches: () => {
    invalidateEcclesiaCache()
    invalidatePeopleCache()
    invalidateMemberCountsCache()
  },
}

export interface MergeOutcome {
  dryRun: boolean
  plan: MergePlan
  result?: MergeResult
}

/**
 * `mergeEcclesia(source, target, { dryRun })`. A dry run (the default) returns
 * the exact change list and writes nothing. A real run rebuilds the plan from
 * fresh reads, refuses if anything blocks it, and applies it.
 */
export async function mergeEcclesia(
  sourceName: string,
  targetName: string,
  opts: { dryRun?: boolean; writers?: MergeWriters } = {}
): Promise<MergeOutcome> {
  const dryRun = opts.dryRun !== false
  const snap = await loadMergeSnapshot(sourceName, targetName)
  const plan = buildMergePlan(snap)
  if (dryRun || plan.blockers.length > 0) return { dryRun, plan }
  const result = await applyMergePlan(plan, snap, opts.writers ?? defaultMergeWriters)
  return { dryRun, plan, result }
}
