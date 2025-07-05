import { BaseRepository } from './base-repository'
import type { 
  DirectoryRecord, 
  MemberData,
  ContactInfo,
} from '../types'

export class AdminRepository extends BaseRepository<DirectoryRecord> {
  constructor() {
    super('admin') // Uses existing tee-admin table
  }

  protected buildSheetPK(sheetId: string): string {
    return `SHEET#${sheetId}` // Not used for admin table
  }

  // Key builders for directory records in tee-admin table
  private buildUserPK(email: string): string {
    return `USER#${email}`
  }

  private buildDirectorySK(sheetId: string): string {
    return `DIRECTORY#${sheetId}`
  }

  private buildEcclesiaGSI1PK(ecclesia: string): string {
    return `ECCLESIA#${ecclesia}`
  }

  private buildNameGSI1SK(lastName: string, firstName: string): string {
    return `${lastName}#${firstName}`
  }

  // Create or update directory record for a member
  async createOrUpdateDirectoryRecord(
    email: string,
    sheetId: string,
    firstName: string,
    lastName: string,
    ecclesia: string,
    contactInfo: ContactInfo
  ): Promise<DirectoryRecord> {
    const record: DirectoryRecord = {
      PK: this.buildUserPK(email),
      SK: this.buildDirectorySK(sheetId),
      GSI1PK: this.buildEcclesiaGSI1PK(ecclesia),
      GSI1SK: this.buildNameGSI1SK(lastName, firstName),
      email,
      firstName,
      lastName,
      ecclesia,
      contactInfo,
      sheetId,
      lastUpdated: new Date().toISOString(),
      version: 1,
    }

    await this.put(record)
    return record
  }

  // Get directory record for a specific member and sheet
  async getDirectoryRecord(email: string, sheetId: string): Promise<DirectoryRecord | null> {
    return this.get(this.buildUserPK(email), this.buildDirectorySK(sheetId))
  }

  // Get all directory records for a member (across all sheets)
  async getMemberDirectoryRecords(email: string): Promise<DirectoryRecord[]> {
    const result = await this.query(
      'PK = :pk AND begins_with(SK, :skPrefix)',
      { 
        ':pk': this.buildUserPK(email),
        ':skPrefix': 'DIRECTORY#'
      }
    )

    return result.items
  }

  // Get all members for an ecclesia (from directory records)
  async getMembersByEcclesia(ecclesia: string): Promise<DirectoryRecord[]> {
    const result = await this.query(
      'GSI1PK = :ecclesia',
      { ':ecclesia': this.buildEcclesiaGSI1PK(ecclesia) },
      {
        indexName: 'GSI1',
        scanIndexForward: true, // Sort by lastName#firstName
      }
    )

    return result.items
  }

  // Get combined member data (profile + directory info)
  async getMemberData(email: string, sheetId?: string): Promise<MemberData | null> {
    // Get profile record (existing functionality)
    const profileResult = await this.get(this.buildUserPK(email), 'PROFILE')
    
    // Get directory record if sheetId provided
    let directoryRecord: DirectoryRecord | null = null
    if (sheetId) {
      directoryRecord = await this.getDirectoryRecord(email, sheetId)
    } else {
      // Get any directory record for this user
      const directoryRecords = await this.getMemberDirectoryRecords(email)
      directoryRecord = directoryRecords[0] || null
    }

    // If neither profile nor directory exists, return null
    if (!profileResult && !directoryRecord) {
      return null
    }

    // Combine data from both sources
    const memberData: MemberData = {
      email,
      firstName: directoryRecord?.firstName || profileResult?.name?.split(' ')[0] || '',
      lastName: directoryRecord?.lastName || profileResult?.name?.split(' ').slice(1).join(' ') || '',
      ecclesia: directoryRecord?.ecclesia || '',
      role: profileResult?.role,
      contactInfo: directoryRecord?.contactInfo,
      profileExists: !!profileResult,
      directoryExists: !!directoryRecord,
    }

    return memberData
  }

  // Search members by name within an ecclesia
  async searchMembersByName(
    ecclesia: string,
    searchTerm: string,
    limit: number = 20
  ): Promise<DirectoryRecord[]> {
    const normalizedSearch = searchTerm.toLowerCase()

    const result = await this.query(
      'GSI1PK = :ecclesia',
      { ':ecclesia': this.buildEcclesiaGSI1PK(ecclesia) },
      {
        indexName: 'GSI1',
        limit: limit * 2, // Get more items to filter
        scanIndexForward: true,
      }
    )

    // Filter results by search term
    return result.items.filter(member => 
      member.firstName.toLowerCase().includes(normalizedSearch) ||
      member.lastName.toLowerCase().includes(normalizedSearch) ||
      member.email.toLowerCase().includes(normalizedSearch)
    ).slice(0, limit)
  }

  // Update directory record
  async updateDirectoryRecord(
    email: string,
    sheetId: string,
    updates: Partial<Pick<DirectoryRecord, 'firstName' | 'lastName' | 'contactInfo' | 'ecclesia'>>
  ): Promise<DirectoryRecord> {
    const existingRecord = await this.getDirectoryRecord(email, sheetId)
    if (!existingRecord) {
      throw new Error(`Directory record for ${email} in sheet ${sheetId} not found`)
    }

    const finalUpdates: any = { ...updates }

    // Update GSI1SK if name or ecclesia changed
    if (updates.firstName || updates.lastName || updates.ecclesia) {
      const newFirstName = updates.firstName || existingRecord.firstName
      const newLastName = updates.lastName || existingRecord.lastName
      const newEcclesia = updates.ecclesia || existingRecord.ecclesia
      
      finalUpdates.GSI1SK = this.buildNameGSI1SK(newLastName, newFirstName)
      finalUpdates.GSI1PK = this.buildEcclesiaGSI1PK(newEcclesia)
    }

    return this.update(
      this.buildUserPK(email),
      this.buildDirectorySK(sheetId),
      finalUpdates
    )
  }

  // Update contact information only
  async updateContactInfo(
    email: string,
    sheetId: string,
    contactInfo: Partial<ContactInfo>
  ): Promise<DirectoryRecord> {
    const existingRecord = await this.getDirectoryRecord(email, sheetId)
    if (!existingRecord) {
      throw new Error(`Directory record for ${email} in sheet ${sheetId} not found`)
    }

    const updatedContactInfo = { ...existingRecord.contactInfo, ...contactInfo }
    
    return this.update(
      this.buildUserPK(email),
      this.buildDirectorySK(sheetId),
      { contactInfo: updatedContactInfo }
    )
  }

  // Delete directory record
  async deleteDirectoryRecord(email: string, sheetId: string): Promise<void> {
    return this.delete(this.buildUserPK(email), this.buildDirectorySK(sheetId))
  }

  // Bulk operations for sheet sync
  async replaceSheetDirectoryRecords(
    sheetId: string,
    members: Omit<DirectoryRecord, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK' | 'lastUpdated' | 'version'>[]
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    // Clear existing directory records for this sheet
    await this.clearSheetDirectoryRecords(sheetId)

    // Create new records with proper keys
    const records: DirectoryRecord[] = members.map(member => ({
      ...member,
      PK: this.buildUserPK(member.email),
      SK: this.buildDirectorySK(sheetId),
      GSI1PK: this.buildEcclesiaGSI1PK(member.ecclesia),
      GSI1SK: this.buildNameGSI1SK(member.lastName, member.firstName),
      lastUpdated: new Date().toISOString(),
      version: 1,
    }))

    // Batch write new records
    const result = await this.batchWrite(records)
    return { 
      successful: result.successful, 
      failed: result.failed, 
      errors: result.errors 
    }
  }

  // Clear all directory records for a specific sheet
  async clearSheetDirectoryRecords(sheetId: string): Promise<void> {
    // Since we can't easily query by SK prefix, we need to scan and filter
    // This is less efficient but necessary for the tee-admin table structure
    const allDirectoryRecords = await this.scan({
      filterExpression: 'SK = :sk',
      expressionAttributeValues: { ':sk': this.buildDirectorySK(sheetId) },
    })

    // Delete in batches
    const deletePromises = allDirectoryRecords.items.map(record => 
      this.delete(record.PK, record.SK)
    )

    await Promise.all(deletePromises)
  }

  // Get member statistics for an ecclesia
  async getMemberStats(ecclesia: string): Promise<{
    totalMembers: number
    membersWithPhone: number
    membersWithAddress: number
    membersWithEmergencyContact: number
  }> {
    const members = await this.getMembersByEcclesia(ecclesia)

    return {
      totalMembers: members.length,
      membersWithPhone: members.filter(m => m.contactInfo.phone).length,
      membersWithAddress: members.filter(m => m.contactInfo.address).length,
      membersWithEmergencyContact: members.filter(m => m.contactInfo.emergencyContact).length,
    }
  }

  // Find potential duplicate members (same name, different email)
  async findPotentialDuplicates(ecclesia: string): Promise<DirectoryRecord[][]> {
    const members = await this.getMembersByEcclesia(ecclesia)

    // Group by name
    const nameGroups: Record<string, DirectoryRecord[]> = {}
    members.forEach(member => {
      const nameKey = `${member.firstName.toLowerCase()}#${member.lastName.toLowerCase()}`
      if (!nameGroups[nameKey]) {
        nameGroups[nameKey] = []
      }
      nameGroups[nameKey].push(member)
    })

    // Return groups with more than one member
    return Object.values(nameGroups).filter(group => group.length > 1)
  }
}