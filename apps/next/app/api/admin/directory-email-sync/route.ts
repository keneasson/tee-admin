import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { getContacts } from '../../../../utils/email/contact'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

// DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
})
const docClient = DynamoDBDocumentClient.from(dynamoClient)

type DirectoryRecord = {
  PK: string
  SK: string
  firstName?: string
  lastName?: string
  email?: string
  address?: string
  phone?: string
  ecclesia?: string
  children?: string
}

type DirectoryMember = {
  pkey: string
  skey: string
  firstName: string
  lastName: string
  email: string
  ecclesia: string
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

    console.log('📋 Fetching directory and SES data for email sync')

    // Fetch directory data directly from DynamoDB
    const queryCommand = new QueryCommand({
      TableName: 'tee-schedules',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'DIRECTORY#MEMBERS'
      }
    })

    const directoryResponse = await docClient.send(queryCommand)
    const directoryMembers: DirectoryMember[] = []

    if (directoryResponse.Items) {
      directoryResponse.Items.forEach((record: any) => {
        const item = record as DirectoryRecord
        const emailField = item.email || ''

        // Split multiple emails (semicolon, comma, pipe, or space separated)
        const emails = emailField
          .split(/[;,|\s]/)
          .map(e => e.trim())
          .filter(e => e.length > 0)

        if (emails.length === 0) {
          // No email - add single entry with empty email
          directoryMembers.push({
            pkey: item.PK,
            skey: item.SK,
            firstName: item.firstName || '',
            lastName: item.lastName || '',
            email: '',
            ecclesia: item.ecclesia || ''
          })
        } else {
          // Add one entry per email
          emails.forEach((email, index) => {
            directoryMembers.push({
              pkey: item.PK,
              skey: index === 0 ? item.SK : `${item.SK}#EMAIL${index}`,
              firstName: item.firstName || '',
              lastName: item.lastName || '',
              email: email,
              ecclesia: item.ecclesia || ''
            })
          })
        }
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
      directoryMembers.map(m => m.email.toLowerCase().trim()).filter(e => e)
    )
    const sesEmailSet = new Set(sesContacts)
    const sesMembersSet = new Set(sesMemberContacts)

    // Find matches and mismatches
    const matched = Array.from(directoryEmails).filter(email => sesEmailSet.has(email)).length
    const sesOnlyEmails = Array.from(sesEmailSet)
      .filter(email => !directoryEmails.has(email))
      .map(email => ({ email, hasMatch: false }))

    console.log(`✅ Sync analysis: ${directoryMembers.length} directory, ${sesContacts.length} SES total, ${sesMemberContacts.length} SES members, ${matched} matched`)

    return NextResponse.json({
      directoryMembers,
      sesOnlyEmails,
      sesAllEmails: sesContacts,
      sesMembersEmails: sesMemberContacts,
      totalDirectory: directoryMembers.length,
      totalSES: sesContacts.length,
      totalSESMembers: sesMemberContacts.length,
      matched,
      unmatched: directoryMembers.length - matched
    })

  } catch (error) {
    console.error('❌ Error fetching directory-email-sync data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync data' },
      { status: 500 }
    )
  }
}

/**
 * PATCH: Update a directory member's email address
 */
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session || !['admin', 'owner'].includes((session.user as any)?.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { pkey, skey, email } = body

    if (!pkey || !skey || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Missing required fields: pkey, skey, email' },
        { status: 400 }
      )
    }

    console.log(`📧 Updating directory email for ${skey} to ${email}`)

    // Update the directory member's email in DynamoDB
    const updateCommand = new UpdateCommand({
      TableName: 'tee-schedules',
      Key: { PK: pkey, SK: skey },
      UpdateExpression: 'SET email = :email, lastUpdated = :lastUpdated',
      ExpressionAttributeValues: {
        ':email': email,
        ':lastUpdated': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    })

    const result = await docClient.send(updateCommand)

    console.log(`✅ Updated email for ${skey}`)

    return NextResponse.json({
      success: true,
      updated: result.Attributes
    })

  } catch (error) {
    console.error('❌ Error updating directory email:', error)
    return NextResponse.json(
      { error: 'Failed to update email' },
      { status: 500 }
    )
  }
}
