/**
 * The per-field privacy rule for a person's directory details, PURE so the
 * privacy repository (directory, profile pages) and the smart reference
 * resolver (plan §0 R6) share one definition.
 */
import { ROLES } from '../provider/auth/auth-roles'
import type { VisibilityLevel } from '../provider/dynamodb/types'

/**
 * Whether a viewer is inside the community enough to read the directory.
 *
 * Deliberately an allow-list of roles rather than "not a guest", so a role
 * added later cannot silently inherit directory access. An absent role counts
 * as a guest: unknown standing is not member standing.
 */
function viewerHasMemberStanding(viewerRole?: string): boolean {
  return (
    viewerRole === ROLES.MEMBER ||
    viewerRole === ROLES.REP ||
    viewerRole === ROLES.RECORDER ||
    viewerRole === ROLES.ADMIN ||
    viewerRole === ROLES.OWNER
  )
}

export type VisibilityContext = {
  isSelf: boolean
  viewerRole?: string
  viewerEcclesia?: string | null
  targetEcclesia?: string | null
}

/** Viewers whose access does not depend on the target's settings at all. */
export function seesPastPrivacy({ isSelf, viewerRole, viewerEcclesia, targetEcclesia }: VisibilityContext): boolean {
  // User can always view their own data
  if (isSelf) return true
  // Owner sees everything
  if (viewerRole === 'owner') return true
  // Admin, Recorder, and Rep see same-ecclesia members fully
  const sameEcclesia = !!viewerEcclesia && !!targetEcclesia && viewerEcclesia === targetEcclesia
  return (viewerRole === 'admin' || viewerRole === 'recorder' || viewerRole === 'rep') && sameEcclesia
}

/**
 * THE per-field visibility rule, pure: may this viewer see a field the target
 * person set to `visibility`? Returns `'if-connected'` when only a connection
 * from the target to the viewer would allow it, so the caller does that one
 * read only when it matters. Shared by {@link PrivacyRepository.canViewField}
 * and the smart reference resolver, so the rule is declared once.
 */
export function decideFieldVisibility(
  visibility: VisibilityLevel | undefined,
  ctx: VisibilityContext
): boolean | 'if-connected' {
  if (seesPastPrivacy(ctx)) return true
  const { viewerRole, viewerEcclesia, targetEcclesia } = ctx
  const sameEcclesia = !!viewerEcclesia && !!targetEcclesia && viewerEcclesia === targetEcclesia

  switch (visibility) {
    case 'authenticated':
      // Anyone logged in can see
      return true
    case 'ecclesia_and_connections':
      // Same ecclesia OR connection exists.
      //
      // "Same ecclesia" means a MEMBER of it. A guest account — someone
      // registered but not part of the community, a record created by a
      // family-add, a login flagged as suspicious — carries an ecclesia on
      // its profile but has no standing to read the directory. Now that this
      // is the DEFAULT rather than an opt-in, that distinction is what stops
      // the change handing every contact detail to any account that signs up.
      if (sameEcclesia && viewerHasMemberStanding(viewerRole)) return true
      return 'if-connected'
    case 'connections_only':
      // Only if target has connected with viewer
      return 'if-connected'
    case 'private':
      // Hidden - can only request contact
      return false
    default:
      return false
  }
}
