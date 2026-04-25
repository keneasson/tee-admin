import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import {
  GetContactCommand,
  UpdateContactCommand,
} from '@aws-sdk/client-sesv2'
import { getSesClient } from '../../../../../utils/email/sesClient'
import { inputTemplate } from '../../../../../utils/email/contact-lists'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { invalidatePeopleCache } from '../../../../api/people/cache'

/**
 * POST: Create a new directory entry from an SES-only email
 * Creates a PersonRecord (source of truth) and syncs to SES
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session || !['admin', 'owner'].includes((session.user as any)?.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, firstName, lastName, isMember } = body

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: email, firstName, lastName' },
        { status: 400 }
      )
    }

    console.log(
      `📧 Creating directory entry for: ${firstName} ${lastName} (${email}) - Member: ${isMember ? 'Yes' : 'No'}`
    )

    // Check for duplicate email
    const existing = await personRepository.getByEmail(email.toLowerCase())
    if (existing) {
      return NextResponse.json(
        { error: 'A person with this email already exists' },
        { status: 409 }
      )
    }

    // Create PersonRecord
    const ecclesiaValue = isMember ? HOME_ECCLESIA.canonicalName : ''
    const person = await personRepository.create({
      email: email.trim().toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      ecclesia: ecclesiaValue,
      memberStatus: isMember ? 'member' : 'visitor',
      role: isMember ? 'member' : 'guest',
    })

    invalidatePeopleCache()

    console.log(`✅ Created PersonRecord: ${person.personId}`)

    // Sync to SES with AttributesData
    const sesClient = getSesClient()
    const attributes = {
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`.trim(),
      personId: person.personId,
      ecclesia: ecclesiaValue,
      isMember: !!isMember,
    }

    let sesResult = null
    try {
      const getCommand = new GetContactCommand({
        ...inputTemplate,
        EmailAddress: email,
      })
      const currentContact = await sesClient.send(getCommand)

      const updateCommand = new UpdateContactCommand({
        ...inputTemplate,
        EmailAddress: email,
        TopicPreferences: currentContact.TopicPreferences,
        AttributesData: JSON.stringify(attributes),
      })
      await sesClient.send(updateCommand)
      sesResult = { action: 'updated', email }
      console.log(`✅ Updated SES contact for ${email}`)
    } catch (getError: any) {
      if (getError.name === 'NotFoundException') {
        console.warn(`⚠️ ${email} not found in SES - skipping`)
        sesResult = { action: 'skipped', email, reason: 'not in SES' }
      } else {
        console.error(`❌ Failed to update SES for ${email}:`, getError.message)
        sesResult = { action: 'failed', email, error: getError.message }
      }
    }

    return NextResponse.json({
      success: true,
      created: {
        pkey: `PERSON#${person.personId}`,
        skey: 'PROFILE',
        personId: person.personId,
        firstName,
        lastName,
        email,
      },
      sesSync: sesResult,
    })
  } catch (error) {
    console.error('❌ Error creating directory entry:', error)
    return NextResponse.json({ error: 'Failed to create directory entry' }, { status: 500 })
  }
}
