import { NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { GetContactCommand, UpdateContactCommand, SubscriptionStatus } from '@aws-sdk/client-sesv2'
import { getSesClient } from '../../../../../utils/email/sesClient'
import { inputTemplate } from '../../../../../utils/email/contact-lists'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { ROLES } from '@my/app/provider/auth/auth-roles'

/**
 * POST: Sync all TEE members from DynamoDB Directory to SES Members list
 * This subscribes all directory members with ecclesia='TEE' to the SES 'members' list
 */
export async function POST() {
  try {
    // Check authentication - OWNER only for this operation
    const session = await auth()
    if (!session || (session.user as any)?.role !== 'owner') {
      return NextResponse.json({ error: 'Unauthorized - Owner role required' }, { status: 401 })
    }

    console.log('🔄 Starting sync of TEE members to SES Members list...')

    // 1. Fetch all PersonRecords (source of truth)
    const allPersons = []
    let lastKey: Record<string, any> | undefined

    do {
      const result = await personRepository.listAll({ lastEvaluatedKey: lastKey })
      allPersons.push(...result.items)
      lastKey = result.lastEvaluatedKey
    } while (lastKey)

    if (allPersons.length === 0) {
      return NextResponse.json(
        { error: 'No directory members found' },
        { status: 404 }
      )
    }

    // 2. Filter for home ecclesia members and extract their emails
    const teeMembers: {
      email: string
      firstName: string
      lastName: string
      personId: string
    }[] = []

    for (const person of allPersons) {
      // Skip placeholders, suspicious, deceased
      if (person.primaryEmail?.startsWith('unknown-')) continue
      if (person.role === ROLES.SUSPICIOUS || person.role === ROLES.DECEASED) continue

      // Only sync members of the home ecclesia
      if (HOME_ECCLESIA.isHomeEcclesia(person.ecclesia)) {
        if (person.primaryEmail) {
          teeMembers.push({
            email: person.primaryEmail,
            firstName: person.firstName || '',
            lastName: person.lastName || '',
            personId: person.personId,
          })
        }
      }
    }

    console.log(`📧 Found ${teeMembers.length} TEE member email addresses`)

    if (teeMembers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No TEE members found',
        added: 0,
        updated: 0,
        failed: 0,
      })
    }

    // 3. Update SES for each member
    const sesClient = getSesClient()
    const results = []
    const errors = []

    for (const member of teeMembers) {
      try {
        // Get current contact to preserve other list subscriptions
        let currentContact
        try {
          const getCommand = new GetContactCommand({
            ...inputTemplate,
            EmailAddress: member.email,
          })
          currentContact = await sesClient.send(getCommand)
        } catch (getError: any) {
          // Contact doesn't exist in SES - skip this one
          if (getError.name === 'NotFoundException') {
            console.warn(`⚠️ ${member.email} not found in SES - skipping`)
            errors.push({
              email: member.email,
              reason: 'Not in SES',
            })
            continue
          }
          throw getError
        }

        // Update only the members topic preference, keep others
        const updatedTopicPreferences =
          currentContact.TopicPreferences?.map((pref) => {
            if (pref.TopicName === 'members') {
              return {
                ...pref,
                SubscriptionStatus: SubscriptionStatus.OPT_IN,
              }
            }
            return pref
          }) || []

        // If 'members' topic doesn't exist, add it
        if (!updatedTopicPreferences.find((p) => p.TopicName === 'members')) {
          updatedTopicPreferences.push({
            TopicName: 'members',
            SubscriptionStatus: SubscriptionStatus.OPT_IN,
          })
        }

        // Build AttributesData with directory information
        const attributes = {
          firstName: member.firstName || '',
          lastName: member.lastName || '',
          displayName:
            member.firstName && member.lastName
              ? `${member.firstName} ${member.lastName}`.trim()
              : '',
          personId: member.personId, // Link back to PersonRecord
          ecclesia: HOME_ECCLESIA.canonicalName, // All members being synced here are home ecclesia members
          isMember: true, // All members being synced here are members
        }

        const updateCommand = new UpdateContactCommand({
          ...inputTemplate,
          EmailAddress: member.email,
          TopicPreferences: updatedTopicPreferences,
          AttributesData: JSON.stringify(attributes),
        })

        await sesClient.send(updateCommand)

        results.push({
          email: member.email,
          firstName: member.firstName,
          lastName: member.lastName,
          success: true,
        })

        console.log(`✅ Added ${member.email} to SES Members list`)
      } catch (error: any) {
        console.error(`❌ Failed to update ${member.email}:`, error.message)
        errors.push({
          email: member.email,
          error: error.message,
        })
      }
    }

    console.log(`✅ Sync complete: ${results.length} succeeded, ${errors.length} failed`)

    return NextResponse.json({
      success: true,
      message: `Synced ${results.length} TEE members to SES Members list`,
      totalTEEMembers: teeMembers.length,
      added: results.length,
      failed: errors.length,
      results,
      errors,
    })
  } catch (error) {
    console.error('❌ Error syncing members to SES:', error)
    return NextResponse.json({ error: 'Failed to sync members to SES' }, { status: 500 })
  }
}
