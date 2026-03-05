import { ROLES } from '@my/app/provider/auth/auth-roles'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'

/**
 * Check if a user can edit a given ecclesia.
 *
 * Rules:
 * 1. System owner (role === 'owner') → can edit any ecclesia
 * 2. Same-ecclesia admin (role === 'admin' AND person.ecclesia === ecclesiaName)
 * 3. Same-ecclesia recording brother (person.isRecordingBrother === true AND person.ecclesia === ecclesiaName)
 * 4. Same-ecclesia rep (role === 'rep' AND person.ecclesia === ecclesiaName)
 *
 * Note: RB is a designation (isRecordingBrother boolean), not a hierarchy role.
 */
export async function checkEcclesiaEditPermission(
  userEmail: string,
  userRole: string,
  ecclesiaName: string
): Promise<boolean> {
  // Owner can edit any ecclesia
  if (userRole === ROLES.OWNER) {
    return true
  }

  // Look up the person record to check ecclesia membership and RB designation
  const person = await personRepository.getByEmail(userEmail)
  if (!person) {
    return false
  }

  const isSameEcclesia = person.ecclesia === ecclesiaName

  // Admin, legacy recorder role, or Rep of the same ecclesia
  if ((userRole === ROLES.ADMIN || userRole === ROLES.RECORDER || userRole === ROLES.REP) && isSameEcclesia) {
    return true
  }

  // Recording brother of the same ecclesia (isRecordingBrother boolean is canonical)
  if (isSameEcclesia && person.isRecordingBrother) {
    return true
  }

  return false
}

/**
 * Check if a user can set the Recording Brother for a given ecclesia.
 *
 * Rules:
 * 1. System owner → can set for any ecclesia
 * 2. Admin → can set for any ecclesia
 * 3. Current Recording Brother (isRecordingBrother) → can set for their own ecclesia only
 * 4. Rep → CANNOT set Recording Brother
 */
export async function checkRecordingBrotherPermission(
  userEmail: string,
  userRole: string,
  ecclesiaName: string
): Promise<boolean> {
  if (userRole === ROLES.OWNER || userRole === ROLES.ADMIN) {
    return true
  }

  // Legacy recorder role or RB designation — same-ecclesia only
  if (userRole === ROLES.RECORDER) {
    const person = await personRepository.getByEmail(userEmail)
    return !!person && person.ecclesia === ecclesiaName
  }

  // isRecordingBrother designation — same-ecclesia only
  const person = await personRepository.getByEmail(userEmail)
  if (person?.isRecordingBrother && person.ecclesia === ecclesiaName) {
    return true
  }

  return false
}
