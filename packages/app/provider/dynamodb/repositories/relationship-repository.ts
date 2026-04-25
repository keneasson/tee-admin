import { BaseRepository } from './base-repository'
import type {
  RelationshipRecord,
  RelationshipType,
  RelationshipQueryResult,
} from '../types'

/**
 * Repository for family relationship records
 * Relationships are bidirectional - when A is parent of B, B is child of A
 * Uses 'tee-admin' table with lowercase keys (pkey, skey)
 */
export class RelationshipRepository extends BaseRepository<RelationshipRecord> {
  constructor() {
    super('admin', false) // false = lowercase keys (pkey, skey)
  }

  protected buildSheetPK(_sheetId: string): string {
    // Not used for relationship records, but required by base class
    throw new Error('buildSheetPK not applicable for RelationshipRepository')
  }

  // Map to get inverse relationship type
  private getInverseRelationship(type: RelationshipType): RelationshipType {
    const inverseMap: Record<RelationshipType, RelationshipType> = {
      spouse: 'spouse',
      parent: 'child',
      child: 'parent',
      sibling: 'sibling',
      grandparent: 'grandchild',
      grandchild: 'grandparent',
      extended_family: 'extended_family',
      household_member: 'household_member',
    }
    return inverseMap[type]
  }

  /**
   * Create a bidirectional relationship between two users
   * Creates records for both directions
   */
  async createRelationship(
    sourceEmail: string,
    targetEmail: string,
    type: RelationshipType
  ): Promise<void> {
    const now = new Date().toISOString()

    // Create forward relationship (source -> target)
    const forwardRecord = {
      pkey: `USER#${sourceEmail}`,
      skey: `RELATIONSHIP#${targetEmail}#${type}`,
      sourceEmail,
      targetEmail,
      relationshipType: type,
      status: 'active',
      createdAt: now,
      lastUpdated: now,
      version: 0,
    }

    // Create inverse relationship (target -> source)
    const inverseType = this.getInverseRelationship(type)
    const inverseRecord = {
      pkey: `USER#${targetEmail}`,
      skey: `RELATIONSHIP#${sourceEmail}#${inverseType}`,
      sourceEmail: targetEmail,
      targetEmail: sourceEmail,
      relationshipType: inverseType,
      status: 'active',
      createdAt: now,
      lastUpdated: now,
      version: 0,
    }

    // Write both records
    await Promise.all([
      this.put(forwardRecord as any),
      this.put(inverseRecord as any),
    ])
  }

  /**
   * Get all relationships for a user
   */
  async getRelationships(email: string): Promise<RelationshipQueryResult> {
    const pk = `USER#${email}`
    const result = await this.query(
      'pkey = :pk AND begins_with(skey, :skPrefix)',
      { ':pk': pk, ':skPrefix': 'RELATIONSHIP#' }
    )
    return {
      items: result.items as RelationshipRecord[],
      lastEvaluatedKey: result.lastEvaluatedKey,
    }
  }

  /**
   * Get relationships of a specific type for a user
   */
  async getRelationshipsByType(
    email: string,
    type: RelationshipType
  ): Promise<RelationshipQueryResult> {
    const result = await this.getRelationships(email)
    return {
      items: result.items.filter(rel => rel.relationshipType === type),
      lastEvaluatedKey: result.lastEvaluatedKey,
    }
  }

  /**
   * Check if a relationship exists between two users
   */
  async hasRelationship(
    sourceEmail: string,
    targetEmail: string,
    type?: RelationshipType
  ): Promise<boolean> {
    const result = await this.getRelationships(sourceEmail)
    return result.items.some(
      rel =>
        rel.targetEmail === targetEmail &&
        rel.status === 'active' &&
        (type ? rel.relationshipType === type : true)
    )
  }

  /**
   * Remove a relationship (marks as removed, doesn't delete)
   * Updates both directions
   */
  async removeRelationship(
    sourceEmail: string,
    targetEmail: string,
    type: RelationshipType
  ): Promise<void> {
    const inverseType = this.getInverseRelationship(type)

    // Update both records to 'removed' status
    await Promise.all([
      this.update(
        `USER#${sourceEmail}`,
        `RELATIONSHIP#${targetEmail}#${type}`,
        { status: 'removed' }
      ),
      this.update(
        `USER#${targetEmail}`,
        `RELATIONSHIP#${sourceEmail}#${inverseType}`,
        { status: 'removed' }
      ),
    ])
  }

  /**
   * Permanently delete a relationship (use removeRelationship for soft delete)
   * Deletes both directions
   */
  async deleteRelationship(
    sourceEmail: string,
    targetEmail: string,
    type: RelationshipType
  ): Promise<void> {
    const inverseType = this.getInverseRelationship(type)

    await Promise.all([
      this.delete(`USER#${sourceEmail}`, `RELATIONSHIP#${targetEmail}#${type}`),
      this.delete(`USER#${targetEmail}`, `RELATIONSHIP#${sourceEmail}#${inverseType}`),
    ])
  }

  /**
   * Get family members (active relationships only)
   */
  async getFamilyMembers(email: string): Promise<RelationshipRecord[]> {
    const result = await this.getRelationships(email)
    return result.items.filter(rel => rel.status === 'active')
  }

  /**
   * Get immediate family (spouse, parents, children)
   */
  async getImmediateFamily(email: string): Promise<RelationshipRecord[]> {
    const immediateTypes: RelationshipType[] = ['spouse', 'parent', 'child']
    const result = await this.getRelationships(email)
    return result.items.filter(
      rel => rel.status === 'active' && immediateTypes.includes(rel.relationshipType)
    )
  }

  /**
   * Get household members (spouse and household_member type)
   */
  async getHouseholdMembers(email: string): Promise<RelationshipRecord[]> {
    const householdTypes: RelationshipType[] = ['spouse', 'household_member']
    const result = await this.getRelationships(email)
    return result.items.filter(
      rel => rel.status === 'active' && householdTypes.includes(rel.relationshipType)
    )
  }
}

// Export singleton instance
export const relationshipRepository = new RelationshipRepository()
