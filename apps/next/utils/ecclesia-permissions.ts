import { ROLES } from '@my/app/provider/auth/auth-roles'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { getDefaultRegion } from '@my/app/config/regions'
import { getEcclesiaByName, getAllEcclesia } from './dynamodb/locations'

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

/**
 * Resolve which region an ecclesia belongs to: its explicit `region` field if
 * set, otherwise derived from country/province. Returns null if the ecclesia
 * isn't found or has no location to derive from.
 */
async function getEcclesiaRegion(ecclesiaName: string): Promise<string | null> {
  const ecclesia = await getEcclesiaByName(ecclesiaName)
  if (!ecclesia) return null
  if (ecclesia.region) return ecclesia.region
  if (!ecclesia.country) return null
  return getDefaultRegion(ecclesia.country, ecclesia.province)
}

/**
 * Can this user AUTHOR content (events / news / meetings) for a given ecclesia?
 *
 * Same ownership rules as {@link checkEcclesiaEditPermission}, plus regional
 * admins: an ADMIN/REP/RECORDER whose `managedRegions` covers the ecclesia's
 * region may author for it. OWNER may author for any ecclesia (this is how the
 * owner "selects" which org they operate as — content is still stamped with a
 * real, validated ecclesia, never a blind body value).
 *
 * NOTE: this is the WRITE/authoring gate; it does not change a person's home
 * ecclesia membership (PersonRecord.ecclesia), which is where they appear in
 * directories.
 */
export async function canAuthorForEcclesia(
  userEmail: string,
  userRole: string,
  ecclesiaName: string
): Promise<boolean> {
  if (userRole === ROLES.OWNER) {
    return true
  }

  const person = await personRepository.getByEmail(userEmail)
  if (!person) {
    return false
  }

  const isStaff =
    userRole === ROLES.ADMIN || userRole === ROLES.RECORDER || userRole === ROLES.REP
  const isSameEcclesia = person.ecclesia === ecclesiaName

  // Own ecclesia: staff roles, or the recording brother designation.
  if (isSameEcclesia && (isStaff || person.isRecordingBrother)) {
    return true
  }

  // Regional admin: managedRegions covers the target ecclesia's region.
  if (isStaff && person.managedRegions && person.managedRegions.length > 0) {
    const region = await getEcclesiaRegion(ecclesiaName)
    if (region && person.managedRegions.includes(region)) {
      return true
    }
  }

  return false
}

export type ContentEcclesiaAuth =
  | { ok: true; ecclesia: string }
  | { ok: false; status: number; error: string }

/**
 * Resolve AND authorize the ecclesia a content write targets.
 *
 * - `requestedEcclesia` is what the client asked for (e.g. event.hostingEcclesia.name,
 *   news.ecclesiaId, meeting.ownerName). It is never trusted blindly.
 * - If omitted, defaults to the caller's home ecclesia (so a scoped admin who
 *   doesn't specify simply authors for their own ecclesia).
 * - The resolved ecclesia is only returned if {@link canAuthorForEcclesia} passes,
 *   otherwise a 403 (or 400 when no ecclesia can be determined).
 *
 * Callers should stamp the returned `ecclesia` onto the content rather than
 * re-reading the client value.
 */
export async function authorizeContentEcclesia(
  userEmail: string,
  userRole: string,
  requestedEcclesia: string | null | undefined
): Promise<ContentEcclesiaAuth> {
  let target = (requestedEcclesia || '').trim()

  if (!target) {
    const person = await personRepository.getByEmail(userEmail)
    target = (person?.ecclesia || '').trim()
  }

  if (!target) {
    return {
      ok: false,
      status: 400,
      error: 'Could not determine which ecclesia this content belongs to.',
    }
  }

  const allowed = await canAuthorForEcclesia(userEmail, userRole, target)
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      error: `You do not have permission to manage content for ${target}.`,
    }
  }

  return { ok: true, ecclesia: target }
}

/**
 * The set of ecclesias whose content a user may manage (for READ-side scoping of
 * admin lists). `{ all: true }` means no filter — OWNER sees everything. Mirrors
 * {@link canAuthorForEcclesia}: own ecclesia for staff/RB, plus ecclesias covered
 * by an ADMIN/REP/RECORDER's managedRegions.
 */
export type ManageableEcclesias = { all: true } | { all: false; ecclesias: Set<string> }

export async function listManageableEcclesias(
  userEmail: string,
  userRole: string
): Promise<ManageableEcclesias> {
  if (userRole === ROLES.OWNER) {
    return { all: true }
  }

  const person = await personRepository.getByEmail(userEmail)
  const ecclesias = new Set<string>()
  if (!person) {
    return { all: false, ecclesias }
  }

  const isStaff =
    userRole === ROLES.ADMIN || userRole === ROLES.RECORDER || userRole === ROLES.REP

  if (person.ecclesia && (isStaff || person.isRecordingBrother)) {
    ecclesias.add(person.ecclesia)
  }

  if (isStaff && person.managedRegions && person.managedRegions.length > 0) {
    const all = await getAllEcclesia()
    for (const e of all) {
      const region = e.region || (e.country ? getDefaultRegion(e.country, e.province) : null)
      if (region && person.managedRegions.includes(region)) {
        ecclesias.add(e.name)
      }
    }
  }

  return { all: false, ecclesias }
}

/** True if the given manageable set covers `ecclesiaName`. */
export function canManageEcclesia(
  manageable: ManageableEcclesias,
  ecclesiaName: string
): boolean {
  return manageable.all || manageable.ecclesias.has(ecclesiaName)
}

/**
 * Concrete, sorted list of ecclesia NAMES a user may author for — for the
 * content-form ecclesia picker (the "operating as" selector). Resolves the
 * `{ all: true }` OWNER case to every ecclesia name. The caller's home ecclesia
 * (when present) sorts first as the natural default.
 */
export async function listSelectableEcclesias(
  userEmail: string,
  userRole: string
): Promise<string[]> {
  const manageable = await listManageableEcclesias(userEmail, userRole)
  let names: string[]
  if (manageable.all) {
    names = (await getAllEcclesia()).map((e) => e.name).filter(Boolean)
  } else {
    names = Array.from(manageable.ecclesias)
  }

  const person = await personRepository.getByEmail(userEmail)
  const home = person?.ecclesia
  return names.sort((a, b) => {
    if (home) {
      if (a === home) return -1
      if (b === home) return 1
    }
    return a.localeCompare(b)
  })
}
