import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { getEcclesiaByName } from './dynamodb/locations'
import { officeRepository, OFFICE_ROLES } from '@my/app/provider/dynamodb/repositories/office-repository'
import { ecclesiaIdOf } from '@my/app/provider/dynamodb/people-index'
import { invalidatePeopleCache } from '../app/api/people/cache'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'

interface SetRecordingBrotherParams {
  ecclesiaName: string
  newPersonId: string
  emailPreference: 'personal' | 'ecclesia'
  rbEcclesiaEmail?: string
  callerEmail: string
}

interface SetRecordingBrotherResult {
  success: boolean
  oldRBPersonId?: string
  newRBPersonId: string
  rbEmail: string
}

/**
 * Central function to handle all Recording Brother transitions.
 *
 * Steps:
 * 1. Look up new person's PersonRecord
 * 2. Find current RB for this ecclesia (isRecordingBrother === true + ecclesia match)
 * 3. Clear old RB → isRecordingBrother: false, clear rbEmailPreference/rbEcclesiaEmail
 *    (their role stays unchanged — owner stays owner, admin stays admin, etc.)
 * 4. Set new RB → isRecordingBrother: true, set rbEmailPreference, set rbEcclesiaEmail if applicable
 * 5. Update the ecclesia's Recording Brother OFFICE (R3): holder = the new person
 *    (closing the previous term), inbox = the ecclesia-specific RB address when
 *    that preference is chosen. The ecclesia item stores no RB name/email.
 * 6. Invalidate caches (people + ecclesia)
 *
 * Replaces transferRBEmail() as the single entry point for all RB changes.
 */
export async function setRecordingBrother(params: SetRecordingBrotherParams): Promise<SetRecordingBrotherResult> {
  const { ecclesiaName, newPersonId, emailPreference, rbEcclesiaEmail } = params

  // 1. Look up new person
  const newPerson = await personRepository.getById(newPersonId)
  if (!newPerson) {
    throw new Error(`Person ${newPersonId} not found`)
  }

  // 2. Find current RB for this ecclesia
  const oldRB = await findCurrentRB(ecclesiaName)

  // 3. Clear old RB (if exists and is different person)
  if (oldRB && oldRB.personId !== newPersonId) {
    await personRepository.updatePerson(oldRB.personId, {
      isRecordingBrother: false,
      rbEmailPreference: undefined,
      rbEcclesiaEmail: undefined,
    } as any)
  }

  // 4. Set new RB
  const rbEmail = emailPreference === 'ecclesia' && rbEcclesiaEmail
    ? rbEcclesiaEmail.toLowerCase().trim()
    : newPerson.primaryEmail.toLowerCase()

  await personRepository.updatePerson(newPersonId, {
    isRecordingBrother: true,
    rbEmailPreference: emailPreference,
    rbEcclesiaEmail: emailPreference === 'ecclesia' ? rbEcclesiaEmail : undefined,
  } as any)

  // If preference is 'ecclesia' and the email isn't already on the person's record,
  // add it as a secondary email
  if (emailPreference === 'ecclesia' && rbEcclesiaEmail) {
    const normalizedEmail = rbEcclesiaEmail.toLowerCase().trim()
    const existingEmails = await personRepository.getEmails(newPersonId)
    const alreadyHasEmail = existingEmails.some(
      (e) => e.email.toLowerCase() === normalizedEmail
    ) || newPerson.primaryEmail.toLowerCase() === normalizedEmail

    if (!alreadyHasEmail) {
      await personRepository.addEmail(newPersonId, {
        email: normalizedEmail,
        emailType: 'secondary',
        order: existingEmails.length,
        verified: true,
        sesSubscribed: false,
        sesStatus: 'active',
      })
    }
  }

  // 5. The Recording Brother office: inbox + holder (term history kept by the office)
  const ecclesiaId = await ecclesiaIdFor(ecclesiaName)
  await officeRepository.saveOffice({
    ecclesiaId,
    role: OFFICE_ROLES.RECORDING_BROTHER,
    email: emailPreference === 'ecclesia' && rbEcclesiaEmail ? rbEmail : null,
  })
  await officeRepository.assignHolder(ecclesiaId, OFFICE_ROLES.RECORDING_BROTHER, newPersonId)

  // 6. Invalidate caches
  invalidatePeopleCache()

  return {
    success: true,
    oldRBPersonId: oldRB?.personId,
    newRBPersonId: newPersonId,
    rbEmail,
  }
}

/**
 * Clear the Recording Brother designation for an ecclesia.
 * Used when removing an RB without replacing them.
 */
export async function clearRecordingBrother(ecclesiaName: string): Promise<void> {
  const currentRB = await findCurrentRB(ecclesiaName)

  if (currentRB) {
    await personRepository.updatePerson(currentRB.personId, {
      isRecordingBrother: false,
      rbEmailPreference: undefined,
      rbEcclesiaEmail: undefined,
    } as any)
  }

  // Vacate the office (closes the term) and drop its inbox; the office itself stays.
  const ecclesiaId = await ecclesiaIdFor(ecclesiaName)
  await officeRepository.saveOffice({ ecclesiaId, role: OFFICE_ROLES.RECORDING_BROTHER, email: null })
  await officeRepository.assignHolder(ecclesiaId, OFFICE_ROLES.RECORDING_BROTHER, null)

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
