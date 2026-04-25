/**
 * @deprecated Use setRecordingBrother() from './rb-service' instead.
 * This file is kept for reference during transition. All call sites have been migrated.
 */

import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { getEcclesiaByName, updateEcclesiaFields } from './dynamodb/locations'
import { invalidatePeopleCache } from '../app/api/people/cache'

/**
 * Transfer the Recording Brother email for an ecclesia.
 *
 * Handles three scenarios:
 * 1. Dedicated RB email (~80%): secondary email moves from old RB to new RB
 * 2. Member's primary email (~15%): ecclesia record updated, no email transfer
 * 3. Unlinked mailbox (~5%): ecclesia record updated, no PersonRecord changes
 *
 * Steps:
 * 1. Look up current ecclesia → get old recordingBrotherEmail
 * 2. If old RB email differs from new, remove old secondary email from previous holder
 * 3. If new RB email isn't already on the new RB's PersonRecord, add as secondary
 * 4. Update ecclesia record with new RB email/name
 * 5. Invalidate people cache
 */
export async function transferRBEmail(params: {
  ecclesia: string
  newRBEmail: string
  newRBName: string
  newRBPersonId?: string
}): Promise<void> {
  const { ecclesia, newRBEmail, newRBName, newRBPersonId } = params
  const normalizedNewEmail = newRBEmail.toLowerCase().trim()

  // 1. Look up current ecclesia record
  const ecclesiaRecord = await getEcclesiaByName(ecclesia)
  const oldRBEmail = ecclesiaRecord?.recordingBrotherEmail?.toLowerCase()

  // 2. If old RB email exists and differs from new, clean up the old secondary
  if (oldRBEmail && oldRBEmail !== normalizedNewEmail) {
    const oldEmailRecords = await personRepository.getEmailsByEmail(oldRBEmail)
    // Only remove secondary emails (never remove primary emails)
    const secondaryRecords = oldEmailRecords.filter(
      (r) => r.emailType === 'secondary'
    )
    for (const record of secondaryRecords) {
      const personId = record.pkey.replace('PERSON#', '')
      await personRepository.removeEmail(personId, record.emailId)
    }
  }

  // 3. If a new RB person is identified, ensure the email is on their record
  if (newRBPersonId && normalizedNewEmail) {
    const existingEmails = await personRepository.getEmails(newRBPersonId)
    const alreadyHasEmail = existingEmails.some(
      (e) => e.email.toLowerCase() === normalizedNewEmail
    )

    if (!alreadyHasEmail) {
      await personRepository.addEmail(newRBPersonId, {
        email: normalizedNewEmail,
        emailType: 'secondary',
        order: existingEmails.length,
        verified: true,
        sesSubscribed: false,
        sesStatus: 'active',
      })
    }
  }

  // 4. Update ecclesia record
  await updateEcclesiaFields(ecclesia, {
    recordingBrotherEmail: normalizedNewEmail,
    recordingBrotherName: newRBName,
  })

  // 5. Invalidate cache
  invalidatePeopleCache()
}
