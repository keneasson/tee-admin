import { BaseRepository } from './base-repository'
import type {
  PrivacySettingsRecord,
  VisibilityLevel,
  ConnectionRecord,
} from '../types'
import { connectionRepository } from './connection-repository'
import { ROLES } from '../../auth/auth-roles'

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

/**
 * Repository for user privacy settings
 * Uses 'tee-admin' table with lowercase keys (pkey, skey)
 */
export class PrivacyRepository extends BaseRepository<PrivacySettingsRecord> {
  constructor() {
    super('admin', false) // false = lowercase keys (pkey, skey)
  }

  protected buildSheetPK(_sheetId: string): string {
    // Not used for privacy records, but required by base class
    throw new Error('buildSheetPK not applicable for PrivacyRepository')
  }

  /**
   * Get privacy settings for a user
   * Returns default settings if none exist
   */
  async getPrivacySettings(email: string): Promise<PrivacySettingsRecord> {
    const pk = `USER#${email}`
    const sk = 'PRIVACY_SETTINGS'
    const existing = await this.get(pk, sk)

    if (existing) {
      return existing
    }

    return this.getDefaultPrivacySettings(email)
  }

  /**
   * Default privacy: **your own ecclesia can see you.**
   *
   * Every field used to default to `private`, which quietly broke the thing the
   * directory is for. Only 28 of ~700 people had ever opened the settings, so
   * for everybody else a member looked up a brother and saw nothing at all — no
   * phone, no address, not even a name. It also made community confirmation of
   * a contact change impossible: you cannot vouch for an address you are not
   * allowed to see.
   *
   * `ecclesia_and_connections` is what people choose when they are actually
   * asked — of the 28 who set it, 25 chose exactly this for every field, and
   * none chose something more private than the old default across the board. So
   * the default was the outlier, not anybody's intention.
   *
   * What this does and does not open up:
   *   - signed-in MEMBERS of the same ecclesia, and people you have explicitly
   *     connected with: yes
   *   - another ecclesia, a guest account, anonymous visitors: no
   *
   * An explicit setting always wins over this default, so anyone who wants to
   * be less visible still says so in privacy settings.
   */
  private getDefaultPrivacySettings(email: string): PrivacySettingsRecord {
    return {
      pkey: `USER#${email}`,
      skey: 'PRIVACY_SETTINGS',
      showName: 'ecclesia_and_connections',
      showPhone: 'ecclesia_and_connections',
      showAddress: 'ecclesia_and_connections',
      showEmail: 'ecclesia_and_connections',
      showFamily: 'ecclesia_and_connections',
      allowContactRequests: true,
      allowConnectionRequests: true,
      preferredContactMethod: 'either',
      lastUpdated: new Date().toISOString(),
      version: 0,
    } as unknown as PrivacySettingsRecord
  }

  /**
   * Update privacy settings for a user
   */
  async updatePrivacySettings(
    email: string,
    updates: Partial<Omit<PrivacySettingsRecord, 'PK' | 'SK'>>
  ): Promise<PrivacySettingsRecord> {
    const pk = `USER#${email}`
    const sk = 'PRIVACY_SETTINGS'

    // Check if settings exist, if not create them first
    const existing = await this.get(pk, sk)
    if (!existing) {
      const defaultSettings = this.getDefaultPrivacySettings(email)
      await this.put({
        ...defaultSettings,
        ...updates,
      } as any)
      return { ...defaultSettings, ...updates }
    }

    return this.update(pk, sk, updates)
  }

  /**
   * Create initial privacy settings for a user
   */
  async createPrivacySettings(
    email: string,
    settings?: Partial<Omit<PrivacySettingsRecord, 'PK' | 'SK'>>
  ): Promise<void> {
    const defaultSettings = this.getDefaultPrivacySettings(email)
    await this.put({
      ...defaultSettings,
      ...settings,
    } as any)
  }

  /**
   * Check if a viewer can see a specific field of a target user
   * Takes into account visibility level, connections, ecclesia membership, and viewer role
   */
  async canViewField(
    viewerEmail: string,
    targetEmail: string,
    field: 'showName' | 'showPhone' | 'showAddress' | 'showEmail' | 'showFamily',
    viewerEcclesia?: string,
    targetEcclesia?: string,
    viewerRole?: string
  ): Promise<boolean> {
    // User can always view their own data
    if (viewerEmail === targetEmail) {
      return true
    }

    // Owner sees everything
    if (viewerRole === 'owner') {
      return true
    }

    // Admin, Recorder, and Rep see same-ecclesia members fully
    if (
      (viewerRole === 'admin' || viewerRole === 'recorder' || viewerRole === 'rep') &&
      viewerEcclesia && targetEcclesia && viewerEcclesia === targetEcclesia
    ) {
      return true
    }

    const settings = await this.getPrivacySettings(targetEmail)
    const visibility = settings[field]

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
        if (
          viewerEcclesia &&
          targetEcclesia &&
          viewerEcclesia === targetEcclesia &&
          viewerHasMemberStanding(viewerRole)
        ) {
          return true
        }
        // Check if there's a connection from target to viewer
        // (target has shared their info with viewer)
        return await connectionRepository.isConnected(targetEmail, viewerEmail)

      case 'connections_only':
        // Only if target has connected with viewer
        return await connectionRepository.isConnected(targetEmail, viewerEmail)

      case 'private':
        // Hidden - can only request contact
        return false

      default:
        return false
    }
  }

  /**
   * Get visible fields for a viewer looking at a target user's profile
   */
  async getVisibleFields(
    viewerEmail: string,
    targetEmail: string,
    viewerEcclesia?: string,
    targetEcclesia?: string,
    viewerRole?: string
  ): Promise<{
    canViewName: boolean
    canViewPhone: boolean
    canViewAddress: boolean
    canViewEmail: boolean
    canViewFamily: boolean
    canRequestContact: boolean
  }> {
    // User can always view their own data
    if (viewerEmail === targetEmail) {
      return {
        canViewName: true,
        canViewPhone: true,
        canViewAddress: true,
        canViewEmail: true,
        canViewFamily: true,
        canRequestContact: false, // Can't request contact from yourself
      }
    }

    const settings = await this.getPrivacySettings(targetEmail)

    const [canViewName, canViewPhone, canViewAddress, canViewEmail, canViewFamily] =
      await Promise.all([
        this.canViewField(viewerEmail, targetEmail, 'showName', viewerEcclesia, targetEcclesia, viewerRole),
        this.canViewField(viewerEmail, targetEmail, 'showPhone', viewerEcclesia, targetEcclesia, viewerRole),
        this.canViewField(viewerEmail, targetEmail, 'showAddress', viewerEcclesia, targetEcclesia, viewerRole),
        this.canViewField(viewerEmail, targetEmail, 'showEmail', viewerEcclesia, targetEcclesia, viewerRole),
        this.canViewField(viewerEmail, targetEmail, 'showFamily', viewerEcclesia, targetEcclesia, viewerRole),
      ])

    return {
      canViewName,
      canViewPhone,
      canViewAddress,
      canViewEmail,
      canViewFamily,
      canRequestContact: settings.allowContactRequests,
    }
  }
}

// Export singleton instance
export const privacyRepository = new PrivacyRepository()
