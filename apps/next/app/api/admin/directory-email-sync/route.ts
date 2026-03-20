import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { getContacts } from '../../../../utils/email/contact'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { ROLES } from '@my/app/provider/auth/auth-roles'

type DirectoryMember = {
  personId: string
  // pkey/skey maintained for UI backward compat (keyed by skey)
  pkey: string
  skey: string
  firstName: string
  lastName: string
  email: string
  ecclesia: string
  role: string
}

/**
 * GET: Fetch directory members and SES contacts for comparison
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session || !['admin', 'owner'].includes((session.user as any)?.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('📋 Fetching directory (PersonRecords) and SES data for email sync')

    // Fetch all PersonRecords (source of truth for people data)
    const allPersons = []
    let lastKey: Record<string, any> | undefined

    do {
      const result = await personRepository.listAll({ lastEvaluatedKey: lastKey })
      allPersons.push(...result.items)
      lastKey = result.lastEvaluatedKey
    } while (lastKey)

    const directoryMembers: DirectoryMember[] = []

    for (const person of allPersons) {
      // Skip placeholder records, suspicious, and deceased
      if (person.primaryEmail?.startsWith('unknown-')) continue
      if (person.role === ROLES.SUSPICIOUS || person.role === ROLES.DECEASED) continue

      directoryMembers.push({
        personId: person.personId,
        pkey: `PERSON#${person.personId}`,
        skey: `PROFILE`,
        firstName: person.firstName || '',
        lastName: person.lastName || '',
        email: person.primaryEmail || '',
        ecclesia: person.ecclesia || '',
        role: person.role || 'guest',
      })
    }

    // Fetch all SES contacts (any list)
    const sesContacts: string[] = []
    let nextToken: string | undefined = undefined

    do {
      const response = await getContacts({ nextPageToken: nextToken })
      if (response.Contacts) {
        response.Contacts.forEach((contact) => {
          if (contact.EmailAddress) {
            sesContacts.push(contact.EmailAddress.toLowerCase().trim())
          }
        })
      }
      nextToken = response.NextToken
    } while (nextToken)

    // Fetch SES Members list specifically
    const sesMemberContacts: string[] = []
    let memberNextToken: string | undefined = undefined

    do {
      const response = await getContacts({ listTopic: 'members', nextPageToken: memberNextToken })
      if (response.Contacts) {
        response.Contacts.forEach((contact) => {
          if (contact.EmailAddress) {
            sesMemberContacts.push(contact.EmailAddress.toLowerCase().trim())
          }
        })
      }
      memberNextToken = response.NextToken
    } while (memberNextToken)

    // Create sets for comparison
    const directoryEmails = new Set(
      directoryMembers.map((m) => m.email.toLowerCase().trim()).filter((e) => e)
    )
    const sesEmailSet = new Set(sesContacts)
    const sesMembersSet = new Set(sesMemberContacts)

    // Find matches and mismatches
    const matched = Array.from(directoryEmails).filter((email) => sesEmailSet.has(email)).length
    const sesOnlyEmails = Array.from(sesEmailSet)
      .filter((email) => !directoryEmails.has(email))
      .map((email) => ({ email, hasMatch: false }))

    console.log(
      `✅ Sync analysis: ${directoryMembers.length} directory, ${sesContacts.length} SES total, ${sesMemberContacts.length} SES members, ${matched} matched`
    )

    return NextResponse.json({
      directoryMembers,
      sesOnlyEmails,
      sesAllEmails: sesContacts,
      sesMembersEmails: sesMemberContacts,
      totalDirectory: directoryMembers.length,
      totalSES: sesContacts.length,
      totalSESMembers: sesMemberContacts.length,
      matched,
      unmatched: directoryMembers.length - matched,
    })
  } catch (error) {
    console.error('❌ Error fetching directory-email-sync data:', error)
    return NextResponse.json({ error: 'Failed to fetch sync data' }, { status: 500 })
  }
}

/**
 * PATCH: Update a directory member's email address via PersonRecord
 */
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session || !['admin', 'owner'].includes((session.user as any)?.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { pkey, email } = body

    if (!pkey || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Missing required fields: pkey, email' },
        { status: 400 }
      )
    }

    // Extract personId from pkey (format: PERSON#<uuid>)
    const personId = pkey.replace('PERSON#', '')

    console.log(`📧 Updating email for person ${personId} to ${email}`)

    const updated = await personRepository.updatePerson(personId, {
      primaryEmail: email.trim().toLowerCase(),
    })

    console.log(`✅ Updated email for person ${personId}`)

    return NextResponse.json({
      success: true,
      updated,
    })
  } catch (error) {
    console.error('❌ Error updating directory email:', error)
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 })
  }
}
