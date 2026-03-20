import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import {
  GetContactCommand,
  UpdateContactCommand,
} from '@aws-sdk/client-sesv2'
import { getSesClient } from '../../../../../utils/email/sesClient'
import { inputTemplate } from '../../../../../utils/email/contact-lists'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'

/**
 * POST: Link an SES-only email to an existing PersonRecord
 * Updates SES contact's AttributesData to reference the PersonRecord
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !['admin', 'owner'].includes((session.user as any)?.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, personId } = body

    if (!email || !personId) {
      return NextResponse.json(
        { error: 'Missing required fields: email, personId' },
        { status: 400 }
      )
    }

    console.log(`🔗 Linking SES contact ${email} to PersonRecord ${personId}`)

    // Look up the PersonRecord
    const person = await personRepository.getById(personId)
    if (!person) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      )
    }

    // Update SES contact's AttributesData
    const sesClient = getSesClient()
    const attributes = {
      firstName: person.firstName || '',
      lastName: person.lastName || '',
      displayName: person.displayName || `${person.firstName} ${person.lastName}`.trim(),
      personId: person.personId,
      ecclesia: person.ecclesia || '',
      isMember: HOME_ECCLESIA.isHomeEcclesia(person.ecclesia),
    }

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

      console.log(`✅ Linked ${email} to PersonRecord ${personId} (${person.displayName})`)

      // Also add this email to the PersonRecord if not already there
      const existingEmails = await personRepository.getEmails(personId)
      const emailAlreadyLinked = existingEmails.some(
        (e) => e.email.toLowerCase() === email.toLowerCase()
      )

      if (!emailAlreadyLinked) {
        await personRepository.addEmail(personId, {
          email: email.toLowerCase(),
          emailType: 'secondary',
          order: existingEmails.length,
          verified: false,
          sesSubscribed: true,
          sesStatus: 'active',
        })
        console.log(`✅ Added ${email} as secondary email to PersonRecord ${personId}`)
      }

      return NextResponse.json({
        success: true,
        linked: {
          email,
          personId: person.personId,
          name: person.displayName || `${person.firstName} ${person.lastName}`.trim(),
          emailAdded: !emailAlreadyLinked,
        },
      })
    } catch (sesError: any) {
      if (sesError.name === 'NotFoundException') {
        return NextResponse.json(
          { error: `${email} not found in SES` },
          { status: 404 }
        )
      }
      throw sesError
    }
  } catch (error) {
    console.error('❌ Error linking contact:', error)
    return NextResponse.json({ error: 'Failed to link contact' }, { status: 500 })
  }
}
