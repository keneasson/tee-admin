/**
 * Apply an edit request that the profile owner has approved.
 *
 * The approve route used to carry only a TODO:
 *
 *   // TODO: If approved and field is not 'email', apply the edit automatically
 *
 * So approving marked the request `approved` and changed NOTHING. A member who
 * clicked "approve" on their own address change got a success response and the
 * old address — the worst kind of failure, because it looks like it worked.
 *
 * Approval by the profile owner is authoritative, so the value is written
 * VERIFIED: the person it belongs to has just confirmed it. That is the one
 * case where a contact change does not need a separate Recording Brother or Rep
 * confirmation (see `proposeAddress` / `verifyAddress`).
 *
 * EMAIL is deliberately excluded. Changing the address a person signs in with
 * is an identity transfer, and a single click in an email is not sufficient
 * proof — that path has its own verification flow.
 */

import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { parseAddressLine } from '@my/app/utils/parse-address-line'
import type { EditRequestRecord } from '@my/app/provider/dynamodb/types'

export interface ApplyResult {
  applied: boolean
  /** Why it was not applied — shown to the person, so it must read plainly. */
  reason?: string
}

export async function applyApprovedEdit(request: EditRequestRecord): Promise<ApplyResult> {
  const person = await personRepository.getByEmail(request.targetEmail)
  if (!person) {
    return { applied: false, reason: 'We could not find that person’s record.' }
  }

  const value = (request.suggestedValue || '').trim()
  if (!value) {
    return { applied: false, reason: 'The suggested value was empty.' }
  }

  const now = new Date().toISOString()

  switch (request.field) {
    case 'name': {
      const [firstName, ...rest] = value.replace(/\s+/g, ' ').split(' ')
      await personRepository.update(`PERSON#${person.personId}`, 'PROFILE', {
        firstName,
        lastName: rest.join(' '),
        displayName: value,
      } as never)
      return { applied: true }
    }

    case 'phone': {
      await personRepository.addPhone(person.personId, {
        type: 'home',
        number: value,
        isPrimary: true,
      })
      return { applied: true }
    }

    case 'address': {
      // The suggestion arrives as one free-text line, because that is what the
      // Suggest-an-edit box collects. Parse it rather than storing the whole
      // string in `street1`, where city and province would be invisible to
      // every consumer that reads those fields.
      const parsed = parseAddressLine(value)
      if (!parsed.city || !parsed.province) {
        return {
          applied: false,
          reason:
            'We could not read a city and province from that address, so it has been ' +
            'recorded for your Recording Brother to enter.',
        }
      }
      const created = await personRepository.addAddress(person.personId, {
        type: 'home',
        street1: parsed.streetAddress || value,
        city: parsed.city,
        province: parsed.province,
        postalCode: parsed.postalCode || '',
        country: parsed.country === 'US' ? 'United States' : 'Canada',
        isPrimary: true,
      })
      // The owner approved it, so it is confirmed — no second sign-off needed.
      await personRepository.updateAddress(person.personId, created.addressId, {
        verified: true,
        verifiedBy: request.targetEmail,
        verifiedAt: now,
      })
      return { applied: true }
    }

    case 'email':
      return {
        applied: false,
        reason:
          'Changing your sign-in email needs an extra verification step, so we have ' +
          'passed this to your Recording Brother rather than changing it from a link.',
      }

    default:
      return { applied: false, reason: 'That kind of change cannot be applied automatically.' }
  }
}
