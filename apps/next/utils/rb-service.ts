import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { getEcclesiaByName } from './dynamodb/locations'
import {
  deriveOfficeFlags,
  officeRepository,
  OFFICE_ROLES,
} from '@my/app/provider/dynamodb/repositories/office-repository'
import { ecclesiaIdOf } from '@my/app/provider/dynamodb/people-index'
import { invalidatePeopleCache } from '../app/api/people/cache'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'

interface SetRecordingBrotherParams {
  ecclesiaName: string
  newPersonId: string
  /** 'ecclesia' → ecclesia mail goes to `rbEcclesiaEmail`, the OFFICE's own
   *  address; 'personal' → the office has no address, so it goes to the
   *  holder's primary email. */
  emailPreference: 'personal' | 'ecclesia'
  rbEcclesiaEmail?: string
  callerEmail: string
}

interface SetRecordingBrotherResult {
  success: boolean
  oldRBPersonId?: string
  newRBPersonId: string
  /** Where ecclesia mail now goes ('' = nowhere: no office address, holder has no email). */
  rbEmail: string
}

/**
 * Central function to handle all Recording Brother transitions (R3).
 *
 * The ecclesia's Recording Brother OFFICE is the source:
 * 1. Look up the new person.
 * 2. The office's address: the ecclesia's own RB address when that preference
 *    is chosen, else none (mail then goes to the holder's primary). An office
 *    address belongs to the office: it is never added to a person's emails,
 *    and it stays with the office when the holder changes.
 * 3. The office's holder: the new person (the previous term is closed).
 * 4. The stored person flags are a projection of the offices held:
 *    `isRecordingBrother` (and `isInterEcclesiaRep` when set) are re-derived
 *    for the previous and the new holder.
 * 5. Invalidate caches.
 *
 * The single entry point for all RB changes (nomination, owner/admin page).
 */
export async function setRecordingBrother(params: SetRecordingBrotherParams): Promise<SetRecordingBrotherResult> {
  const { ecclesiaName, newPersonId, emailPreference, rbEcclesiaEmail } = params

  const newPerson = await personRepository.getById(newPersonId)
  if (!newPerson) {
    throw new Error(`Person ${newPersonId} not found`)
  }
  if (!(newPerson.firstName || '').trim() && !(newPerson.lastName || '').trim()) {
    // A nameless record is an address (often an ecclesia mailbox), not a person.
    throw new Error(`Person ${newPersonId} has no name; an office holder must be a named person`)
  }

  const oldRB = await findCurrentRB(ecclesiaName)
  const officeEmail = emailPreference === 'ecclesia' && rbEcclesiaEmail ? rbEcclesiaEmail.toLowerCase().trim() : null

  const ecclesiaId = await ecclesiaIdFor(ecclesiaName)
  await officeRepository.saveOffice({ ecclesiaId, role: OFFICE_ROLES.RECORDING_BROTHER, email: officeEmail })
  await officeRepository.assignHolder(ecclesiaId, OFFICE_ROLES.RECORDING_BROTHER, newPersonId)

  const rbOffice = { kind: OFFICE_ROLES.RECORDING_BROTHER, ecclesiaId }
  await syncOfficeFlags(newPersonId, { holds: rbOffice })
  if (oldRB && oldRB.personId !== newPersonId) await syncOfficeFlags(oldRB.personId, { released: rbOffice })

  invalidatePeopleCache()

  return {
    success: true,
    oldRBPersonId: oldRB?.personId,
    newRBPersonId: newPersonId,
    rbEmail: officeEmail || (newPerson.primaryEmail || '').toLowerCase(),
  }
}

/**
 * Re-derive a person's stored RB flag from the offices they hold, and drop the
 * old per-person copies of an office address (`rbEmailPreference`,
 * `rbEcclesiaEmail`): the address lives on the office.
 */
type OfficeRef = { kind: string; ecclesiaId: string }
async function syncOfficeFlags(personId: string, change: { holds?: OfficeRef; released?: OfficeRef }): Promise<void> {
  // The holder index is eventually consistent, so apply the change just made.
  const same = (a: OfficeRef, b?: OfficeRef) => !!b && a.kind === b.kind && a.ecclesiaId === b.ecclesiaId
  const held = (await officeRepository.listOfficesHeldBy(personId)).filter((o) => !same(o, change.released))
  const flags = deriveOfficeFlags(change.holds ? [...held, change.holds] : held)
  await personRepository.updatePerson(personId, {
    isRecordingBrother: flags.isRecordingBrother,
    ...(flags.isInterEcclesiaRep ? { isInterEcclesiaRep: true } : {}),
    rbEmailPreference: undefined,
    rbEcclesiaEmail: undefined,
  } as any)
}

/**
 * Clear the Recording Brother designation for an ecclesia.
 * Used when removing an RB without replacing them.
 */
export async function clearRecordingBrother(ecclesiaName: string): Promise<void> {
  const currentRB = await findCurrentRB(ecclesiaName)

  // Vacate the office (closes the term). Its address stays: it belongs to the
  // ecclesia, not to the person leaving.
  const ecclesiaId = await ecclesiaIdFor(ecclesiaName)
  await officeRepository.ensureRecordingBrotherOffice(ecclesiaId)
  await officeRepository.assignHolder(ecclesiaId, OFFICE_ROLES.RECORDING_BROTHER, null)
  if (currentRB) await syncOfficeFlags(currentRB.personId, { released: { kind: OFFICE_ROLES.RECORDING_BROTHER, ecclesiaId } })

  invalidatePeopleCache()
}

async function ecclesiaIdFor(ecclesiaName: string): Promise<string> {
  const ecclesia = await getEcclesiaByName(ecclesiaName)
  if (!ecclesia) throw new Error(`Ecclesia "${ecclesiaName}" not found`)
  return ecclesiaIdOf(ecclesia)
}

/**
 * The current Recording Brother: the RB office's holder; for an ecclesia with
 * no RB office yet, the person flagged isRecordingBrother for it (pre-cutover).
 */
async function findCurrentRB(ecclesiaName: string): Promise<PersonRecord | null> {
  const office = await officeRepository.getOffice(await ecclesiaIdFor(ecclesiaName), OFFICE_ROLES.RECORDING_BROTHER)
  if (office) return office.holderPersonId ? personRepository.getById(office.holderPersonId) : null
  const result = await personRepository.scan({
    filterExpression: 'isRecordingBrother = :isRB AND ecclesia = :ecclesia AND skey = :profile',
    expressionAttributeValues: {
      ':isRB': true,
      ':ecclesia': ecclesiaName,
      ':profile': 'PROFILE',
    },
  })

  return result.items[0] || null
}
