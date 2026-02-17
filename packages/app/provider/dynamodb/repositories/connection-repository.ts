import { BaseRepository } from './base-repository'
import type {
  ConnectionRecord,
  ConnectionStatus,
  ConnectionQueryResult,
} from '../types'

/**
 * Repository for connection records (one-way sharing)
 * Connections are one-way: "I share MY info with you"
 * Different from Relationships which are bidirectional family links
 * Uses 'tee-admin' table with lowercase keys (pkey, skey)
 */
export class ConnectionRepository extends BaseRepository<ConnectionRecord> {
  constructor() {
    super('admin', false) // false = lowercase keys (pkey, skey)
  }

  protected buildSheetPK(_sheetId: string): string {
    // Not used for connection records, but required by base class
    throw new Error('buildSheetPK not applicable for ConnectionRepository')
  }

  /**
   * Add a connection (share your info with someone)
   * This is one-way: userEmail is sharing their info with targetEmail
   */
  async addConnection(userEmail: string, targetEmail: string): Promise<void> {
    const now = new Date().toISOString()

    const record = {
      pkey: `USER#${userEmail}`,
      skey: `CONNECTION#${targetEmail}`,
      targetEmail,
      status: 'active',
      createdAt: now,
      lastUpdated: now,
      version: 0,
    }

    await this.put(record as any)
  }

  /**
   * Remove a connection (stop sharing your info)
   */
  async removeConnection(userEmail: string, targetEmail: string): Promise<void> {
    const pk = `USER#${userEmail}`
    const sk = `CONNECTION#${targetEmail}`
    await this.delete(pk, sk)
  }

  /**
   * Get all connections for a user (people they share info with)
   */
  async getConnections(email: string): Promise<ConnectionQueryResult> {
    const pk = `USER#${email}`
    const result = await this.query(
      'pkey = :pk AND begins_with(skey, :skPrefix)',
      { ':pk': pk, ':skPrefix': 'CONNECTION#' }
    )
    return {
      items: result.items as ConnectionRecord[],
      lastEvaluatedKey: result.lastEvaluatedKey,
    }
  }

  /**
   * Get active connections only
   */
  async getActiveConnections(email: string): Promise<ConnectionRecord[]> {
    const result = await this.getConnections(email)
    return result.items.filter(conn => conn.status === 'active')
  }

  /**
   * Check if a connection exists (userEmail shares info with targetEmail)
   */
  async isConnected(userEmail: string, targetEmail: string): Promise<boolean> {
    const pk = `USER#${userEmail}`
    const sk = `CONNECTION#${targetEmail}`
    const connection = await this.get(pk, sk)
    return connection?.status === 'active'
  }

  /**
   * Get a specific connection
   */
  async getConnection(userEmail: string, targetEmail: string): Promise<ConnectionRecord | null> {
    const pk = `USER#${userEmail}`
    const sk = `CONNECTION#${targetEmail}`
    return this.get(pk, sk)
  }

  /**
   * Block someone from requesting contact
   */
  async blockConnection(userEmail: string, targetEmail: string): Promise<void> {
    const pk = `USER#${userEmail}`
    const sk = `CONNECTION#${targetEmail}`

    // Check if connection exists
    const existing = await this.get(pk, sk)

    if (existing) {
      // Update existing connection to blocked
      await this.update(pk, sk, { status: 'blocked' })
    } else {
      // Create a blocked connection
      const record = {
        pkey: pk,
        skey: sk,
        targetEmail,
        status: 'blocked',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        version: 0,
      }
      await this.put(record as any)
    }
  }

  /**
   * Unblock someone
   */
  async unblockConnection(userEmail: string, targetEmail: string): Promise<void> {
    const pk = `USER#${userEmail}`
    const sk = `CONNECTION#${targetEmail}`

    const existing = await this.get(pk, sk)
    if (existing?.status === 'blocked') {
      // Remove the blocked connection
      await this.delete(pk, sk)
    }
  }

  /**
   * Check if someone is blocked
   */
  async isBlocked(userEmail: string, targetEmail: string): Promise<boolean> {
    const connection = await this.getConnection(userEmail, targetEmail)
    return connection?.status === 'blocked'
  }

  /**
   * Get list of blocked users
   */
  async getBlockedUsers(email: string): Promise<string[]> {
    const result = await this.getConnections(email)
    return result.items
      .filter(conn => conn.status === 'blocked')
      .map(conn => conn.targetEmail)
  }

  /**
   * Update connection status
   */
  async updateConnectionStatus(
    userEmail: string,
    targetEmail: string,
    status: ConnectionStatus
  ): Promise<ConnectionRecord> {
    const pk = `USER#${userEmail}`
    const sk = `CONNECTION#${targetEmail}`
    return this.update(pk, sk, { status })
  }
}

// Export singleton instance
export const connectionRepository = new ConnectionRepository()
