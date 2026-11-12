import { ROLES } from '@my/app/provider/auth/auth-roles'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'

/**
 * Who may send a speaker invitation for `ecclesia` (spec §2).
 *
 *   owner  OR  (person.ecclesia === ecclesia AND (isRecordingBrother OR role === 'rep'))
 *
 * Deliberately NARROWER than `checkEcclesiaEditPermission` (ecclesia-permissions.ts):
 * admins and the legacy `recorder` role are NOT inviters, and nobody but the
 * owner can invite for an ecclesia other than their own. Pure — the caller
 * resolves the person and the (assurance-capped) role.
 */
export function canSendSpeakerInvite(
  person: Pick<PersonRecord, 'ecclesia' | 'isRecordingBrother'> | null | undefined,
  role: string | null | undefined,
  ecclesia: string
): boolean {
  if (role === ROLES.OWNER) return true
  if (!person || !ecclesia) return false
  if (person.ecclesia !== ecclesia) return false
  return person.isRecordingBrother === true || role === ROLES.REP
}
