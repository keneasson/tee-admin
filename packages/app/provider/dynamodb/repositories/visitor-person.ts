import { personRepository } from './person-repository'
import { privacyRepository } from './privacy-repository'
import type { PersonRecord, VisibilityLevel } from '../types'

/**
 * The ONE way a visitor PersonRecord is created (docs/SPEAKER_INVITATIONS.md
 * §9a): the visiting-speaker schedule import and speaker invitations both call
 * this, so every visitor gets the same status, role and privacy defaults, and
 * records where it came from and who added it.
 */

/**
 * Field visibility for visitor records. Sensitive fields are
 * `ecclesia_and_connections`: same-ecclesia members see them, and the owner /
 * same-ecclesia admin-recorder-rep see them via the role overrides in
 * `PrivacyRepository.canViewField`. Deliberately NOT the literal 'private'
 * level, which would hide the speaker from their own ecclesia too.
 */
export const VISITING_SPEAKER_VISIBILITY: VisibilityLevel = 'ecclesia_and_connections'

export const VISITOR_PRIVACY_SETTINGS = {
  showName: VISITING_SPEAKER_VISIBILITY,
  showEmail: VISITING_SPEAKER_VISIBILITY,
  showPhone: VISITING_SPEAKER_VISIBILITY,
  showAddress: VISITING_SPEAKER_VISIBILITY,
  showFamily: VISITING_SPEAKER_VISIBILITY,
} as const

export interface CreateVisitorPersonInput {
  firstName: string
  lastName: string
  ecclesia: string
  /** Their own address. Omit for an emailless visitor (NOEMAIL# sentinel). */
  email?: string
  phone?: string
  /**
   * A household address someone else already uses (#267). The visitor joins
   * it the way `scripts/join-shared-household-email.ts` joins one: an EMAIL#
   * row marked `loginExcluded`, so the existing holder still signs in by
   * default and sign-in asks "Are you A or B?" (`peopleWhoCanUse`). It becomes
   * their primary only when it is the existing holder's primary too; when the
   * holder has it as a secondary, a second PROFILE on that key would take over
   * `getByEmail`'s primary fast path, so it stays a secondary.
   * No privacy settings are written: they are keyed by address, and the
   * address's settings belong to the existing holder.
   */
  sharedEmail?: { address: string; asPrimary: boolean }
  source: 'schedule-import' | 'speaker-invitation'
  sourceRef: string
  createdByPersonId?: string
  /**
   * Default 'guest' (the schedule import). A speaker invitation passes
   * 'member': the inviting RB/Rep vouches the person is aligned with an
   * ecclesia (§9b). Role is access, independent of `baptized`.
   */
  role?: 'member' | 'guest'
  /** Recorded facts (§9b), vouched for by `createdByPersonId`. Never inferred. */
  gender?: 'male' | 'female'
  baptized?: boolean
  baptismDate?: string
}

export interface VisitorPersonDeps {
  repository?: Pick<typeof personRepository, 'create' | 'addPhone' | 'addEmail'>
  privacy?: Pick<typeof privacyRepository, 'createPrivacySettings'>
}

export async function createVisitorPerson(
  input: CreateVisitorPersonInput,
  deps: VisitorPersonDeps = {}
): Promise<PersonRecord> {
  const repo = deps.repository ?? personRepository
  const privacy = deps.privacy ?? privacyRepository
  const { email, phone, sharedEmail, createdByPersonId } = input
  const shared = sharedEmail?.address.trim().toLowerCase()

  const created = await repo.create({
    firstName: input.firstName,
    lastName: input.lastName,
    ecclesia: input.ecclesia,
    memberStatus: 'visitor',
    role: input.role ?? 'guest',
    source: input.source,
    sourceRef: input.sourceRef,
    ...(createdByPersonId ? { createdByPersonId } : {}),
    ...(input.gender ? { gender: input.gender, ...(createdByPersonId ? { genderSetByPersonId: createdByPersonId } : {}) } : {}),
    ...(typeof input.baptized === 'boolean'
      ? {
          baptized: input.baptized,
          ...(input.baptismDate ? { baptismDate: input.baptismDate } : {}),
          ...(createdByPersonId ? { baptizedSetByPersonId: createdByPersonId } : {}),
        }
      : {}),
    // With an email we take the normal create() path (real EMAIL# item +
    // EMAIL# gsi1 key) so getByEmail finds them; without, create() falls
    // back to the emailless NOEMAIL# sentinel.
    ...(shared && sharedEmail?.asPrimary
      ? { email: shared, emailLoginExcluded: true }
      : !shared && email
        ? { email }
        : {}),
  })
  if (shared && !sharedEmail?.asPrimary) {
    await repo.addEmail(created.personId, {
      email: shared,
      emailType: 'secondary',
      order: 0,
      verified: true,
      sesSubscribed: false,
      sesStatus: 'active',
      loginExcluded: true,
    })
  }
  if (phone) {
    await repo.addPhone(created.personId, { type: 'mobile', number: phone, isPrimary: true })
  }
  if (email && !shared) {
    await privacy.createPrivacySettings(email, { ...VISITOR_PRIVACY_SETTINGS })
  }
  return created
}
