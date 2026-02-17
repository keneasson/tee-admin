import { BaseRepository } from './base-repository'
import type {
  PrivacySettingsRecord,
  VisibilityLevel,
  ConnectionRecord,
} from '../types'
import { connectionRepository } from './connection-repository'

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

    // Return default privacy settings (most restrictive)
    return this.getDefaultPrivacySettings(email)
  }

  /**
   * Get default privacy settings (private by default)
   */
  private getDefaultPrivacySettings(email: string): PrivacySettingsRecord {
    return {
      pkey: `USER#${email}`,
      skey: 'PRIVACY_SETTINGS',
      showName: 'private',
      showPhone: 'private',
      showAddress: 'private',
      showEmail: 'private',
      showFamily: 'private',
      allowContactRequests: true,
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

    // Admin sees same-ecclesia members fully
    if (viewerRole === 'admin' && viewerEcclesia && targetEcclesia && viewerEcclesia === targetEcclesia) {
      return true
    }

    const settings = await this.getPrivacySettings(targetEmail)
    const visibility = settings[field]

    switch (visibility) {
      case 'authenticated':
        // Anyone logged in can see
        return true

      case 'ecclesia_and_connections':
        // Same ecclesia OR connection exists
        if (viewerEcclesia && targetEcclesia && viewerEcclesia === targetEcclesia) {
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
