import { canSendSpeakerInvite } from './speaker-invite-permissions'

/**
 * Who may manage `ecclesia`'s schedule registry (docs/ECCLESIA_SCHEDULES.md §Gate):
 * the same people who may invite its speakers — the owner, or the Recording
 * Brother / Rep of their OWN ecclesia. One rule, so the two can never drift:
 * the invitations put speakers into these schedules.
 */
export const canManageEcclesiaSchedules: typeof canSendSpeakerInvite = (person, role, ecclesia) =>
  canSendSpeakerInvite(person, role, ecclesia)
