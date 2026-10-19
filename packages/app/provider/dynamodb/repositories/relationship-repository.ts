import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { BaseRepository } from './base-repository'
import { docClient } from '../config'
import type { RelationshipRecord, RelationshipType } from '../types'

/**
 * Family relationships, keyed by PERSON (R7, epic #270).
 *
 *   pkey PERSON#<sourcePersonId>   skey REL#<targetPersonId>#<type>
 *
 * A relationship is stored as two rows, one per direction, and the second row
 * carries the inverse type (A parent-of B ⇔ B child-of A). Both rows are
 * written in ONE transaction, so a relationship never exists in one direction
 * only.
 *
 * The legacy rows (`USER#<email>` / `RELATIONSHIP#<targetEmail>#<type>`) were
 * keyed by email, so a person whose primary email changed lost their family
 * from view. Nothing here reads them; `scripts/migrate-relationships-to-person.ts`
 * converts them.
 */

export const REL_SK_PREFIX = 'REL#'

export const INVERSE_RELATIONSHIP: Record<RelationshipType, RelationshipType> = {
  spouse: 'spouse',
  parent: 'child',
  child: 'parent',
  sibling: 'sibling',
  grandparent: 'grandchild',
  grandchild: 'grandparent',
  extended_family: 'extended_family',
  household_member: 'household_member',
}

export const RELATIONSHIP_TYPES = Object.keys(INVERSE_RELATIONSHIP) as RelationshipType[]

export function isRelationshipType(value: unknown): value is RelationshipType {
  return typeof value === 'string' && value in INVERSE_RELATIONSHIP
}

export function relationshipKey(sourcePersonId: string, targetPersonId: string, type: RelationshipType) {
  return { pkey: `PERSON#${sourcePersonId}`, skey: `${REL_SK_PREFIX}${targetPersonId}#${type}` }
}

/** The two rows of one relationship: forward, then inverse. Pure. */
export function buildRelationshipPair(
  sourcePersonId: string,
  targetPersonId: string,
  type: RelationshipType,
  status: RelationshipRecord['status'] = 'active',
  now: string = new Date().toISOString(),
  createdAt: string = now
): [RelationshipRecord, RelationshipRecord] {
  if (!sourcePersonId || !targetPersonId) throw new Error('relationship: both personIds are required')
  if (sourcePersonId === targetPersonId) throw new Error('relationship: a person cannot be related to themselves')
  const row = (s: string, t: string, ty: RelationshipType): RelationshipRecord => ({
    ...relationshipKey(s, t, ty),
    type: 'RELATIONSHIP',
    sourcePersonId: s,
    targetPersonId: t,
    relationshipType: ty,
    status,
    createdAt,
    lastUpdated: now,
    version: 0,
  })
  return [row(sourcePersonId, targetPersonId, type), row(targetPersonId, sourcePersonId, INVERSE_RELATIONSHIP[type])]
}

export class RelationshipRepository extends BaseRepository<RelationshipRecord> {
  constructor() {
    super('admin', false) // tee-admin, lowercase keys (pkey, skey)
  }

  protected buildSheetPK(_sheetId: string): string {
    throw new Error('buildSheetPK not applicable for RelationshipRepository')
  }

  /** Create (or re-activate) a relationship: both directions, one transaction. */
  async createRelationship(sourcePersonId: string, targetPersonId: string, type: RelationshipType): Promise<void> {
    const [forward, inverse] = buildRelationshipPair(sourcePersonId, targetPersonId, type)
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: this.tableName, Item: forward } },
          { Put: { TableName: this.tableName, Item: inverse } },
        ],
      })
    )
  }

  /** Every relationship row for a person (all statuses), all pages. */
  async getRelationships(personId: string): Promise<RelationshipRecord[]> {
    const items: RelationshipRecord[] = []
    let lastEvaluatedKey: Record<string, any> | undefined
    do {
      const page = await this.query(
        'pkey = :pk AND begins_with(skey, :skPrefix)',
        { ':pk': `PERSON#${personId}`, ':skPrefix': REL_SK_PREFIX },
        { lastEvaluatedKey }
      )
      items.push(...page.items)
      lastEvaluatedKey = page.lastEvaluatedKey
    } while (lastEvaluatedKey)
    return items
  }

  /** Active relationships only. */
  async getFamilyMembers(personId: string): Promise<RelationshipRecord[]> {
    return (await this.getRelationships(personId)).filter((rel) => rel.status === 'active')
  }

  async hasRelationship(sourcePersonId: string, targetPersonId: string, type?: RelationshipType): Promise<boolean> {
    const rels = await this.getRelationships(sourcePersonId)
    return rels.some(
      (rel) =>
        rel.targetPersonId === targetPersonId &&
        rel.status === 'active' &&
        (type ? rel.relationshipType === type : true)
    )
  }

  /** Soft delete: both directions are marked removed, in one transaction. */
  async removeRelationship(sourcePersonId: string, targetPersonId: string, type: RelationshipType): Promise<void> {
    const now = new Date().toISOString()
    const update = (key: { pkey: string; skey: string }) => ({
      Update: {
        TableName: this.tableName,
        Key: key,
        UpdateExpression: 'SET #status = :removed, #lastUpdated = :now, #version = if_not_exists(#version, :zero) + :one',
        ConditionExpression: 'attribute_exists(pkey)',
        ExpressionAttributeNames: { '#status': 'status', '#lastUpdated': 'lastUpdated', '#version': 'version' },
        ExpressionAttributeValues: { ':removed': 'removed', ':now': now, ':zero': 0, ':one': 1 },
      },
    })
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          update(relationshipKey(sourcePersonId, targetPersonId, type)),
          update(relationshipKey(targetPersonId, sourcePersonId, INVERSE_RELATIONSHIP[type])),
        ],
      })
    )
  }
}

export const relationshipRepository = new RelationshipRepository()
