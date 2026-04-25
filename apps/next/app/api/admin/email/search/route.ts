import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { getContacts } from '@/utils/email/contact'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ListSuppressedDestinationsCommand } from '@aws-sdk/client-sesv2'
import { getSesClient } from '@/utils/email/sesClient'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'

// DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ca-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
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

type EmailStatus = 'active' | 'archived'

type EmailResult = {
  email: string
  inSES: boolean
  inDirectory: boolean
  isPrimary: boolean
  status: EmailStatus
  isBounced?: boolean
  bounceReason?: string
  sesLists?: {
    sundaySchool?: boolean
    newsletter?: boolean
    memorial?: boolean
    bibleClass?: boolean
    members?: boolean
    testList?: boolean
  }
}

type PersonResult = {
  pkey: string
  baseSkey: string
  firstName: string
  lastName: string
  displayName: string
  isMember: boolean
  emails: EmailResult[]
  directoryData?: {
    address?: string
    phone?: string
    children?: string
    ecclesia?: string
  }
  isPotentialDuplicate?: boolean
  hasStaleLink?: boolean // SES contact has dynamodbSK but directory record not found
  staleLinkSK?: string // The stale dynamodbSK value
}

/**
 * GET: Search for contacts across both SES and DynamoDB directory
 * Query param: ?q=search_term
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session || !['admin', 'owner'].includes((session.user as any)?.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const searchTerm = searchParams.get('q')?.toLowerCase().trim()

    if (!searchTerm || searchTerm.length < 2) {
      return NextResponse.json(
        { error: 'Search term must be at least 2 characters' },
        { status: 400 }
      )
    }

    console.log(`🔍 Searching for: "${searchTerm}"`)

    // Fetch SES suppression list (bounced/complained emails)
    const suppressedEmails = new Map<string, string>() // email -> reason
    try {
      const sesClient = getSesClient()
      let suppressionNextToken: string | undefined
      do {
        const suppressionCommand = new ListSuppressedDestinationsCommand({
          PageSize: 100,
          ...(suppressionNextToken && { NextToken: suppressionNextToken }),
        })
        const suppressionResponse = await sesClient.send(suppressionCommand)

        if (suppressionResponse.SuppressedDestinationSummaries) {
          for (const item of suppressionResponse.SuppressedDestinationSummaries) {
            if (item.EmailAddress) {
              suppressedEmails.set(item.EmailAddress.toLowerCase(), item.Reason || 'BOUNCE')
            }
          }
        }
        suppressionNextToken = suppressionResponse.NextToken
      } while (suppressionNextToken)

      console.log(`📧 Found ${suppressedEmails.size} suppressed emails`)
    } catch (error) {
      console.error('Failed to fetch suppression list:', error)
      // Continue without bounce data
    }

    // Person Results Map - keyed by baseSkey
    const personsMap = new Map<string, PersonResult>()
    // Email to Person mapping for SES-only contacts
    const sesOnlyEmails = new Map<string, PersonResult>()

    // 1. Search DynamoDB Directory
    console.log('📋 Searching directory...')
    const queryCommand = new QueryCommand({
      TableName: 'tee-schedules',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'DIRECTORY#MEMBERS',
      },
    })

    const directoryResponse = await docClient.send(queryCommand)

    if (directoryResponse.Items) {
      directoryResponse.Items.forEach((record: any) => {
        const item = record as DirectoryRecord
        const firstName = item.firstName || ''
        const lastName = item.lastName || ''
        const emailField = item.email || ''
        const fullName = `${firstName} ${lastName}`.toLowerCase().trim()

        // Split multiple emails (semicolon, comma, pipe, or space separated)
        const emails = emailField
          .split(/[;,|\s]/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.length > 0)

        // Check if search term matches name or any email
        const matchesName =
          firstName.toLowerCase().includes(searchTerm) ||
          lastName.toLowerCase().includes(searchTerm) ||
          fullName.includes(searchTerm)

        const matchesEmail = emails.some((email) => email.includes(searchTerm))

        if (matchesName || matchesEmail) {
          // Get base SK (without #EMAIL suffix)
          const baseSkey = item.SK.split('#EMAIL')[0]

          // Get or create person entry
          let person = personsMap.get(baseSkey)
          if (!person) {
            person = {
              pkey: item.PK,
              baseSkey,
              firstName,
              lastName,
              displayName: `${firstName} ${lastName}`.trim(),
              isMember: HOME_ECCLESIA.isHomeEcclesia(item.ecclesia),
              emails: [],
              directoryData: {
                address: item.address,
                phone: item.phone,
                children: item.children,
                ecclesia: item.ecclesia,
              },
            }
            personsMap.set(baseSkey, person)
          }

          // Add emails from this record (unlimited, but only first 2 are active)
          emails.forEach((email, index) => {
            // Check if this email already exists for this person
            if (!person!.emails.find((e) => e.email === email)) {
              // First email in the directory record is primary
              const isPrimary = index === 0
              // First 2 emails are active, rest are archived
              const status: EmailStatus = person!.emails.length < 2 ? 'active' : 'archived'
              // Check if email is bounced
              const bounceReason = suppressedEmails.get(email.toLowerCase())
              person!.emails.push({
                email,
                inSES: false, // Will update when we search SES
                inDirectory: true,
                isPrimary,
                status,
                isBounced: !!bounceReason,
                bounceReason,
                sesLists: {},
              })
            }
          })
        }
      })
    }

    console.log(`📋 Found ${personsMap.size} people in directory`)

    // Collect all emails from directory persons for SES lookup
    const directoryEmails = new Set<string>()
    personsMap.forEach((person) => {
      person.emails.forEach((emailData) => {
        directoryEmails.add(emailData.email.toLowerCase())
      })
    })
    console.log(`📧 Directory emails to look up in SES: ${directoryEmails.size}`)

    // 2. Search SES Contacts
    console.log('📧 Searching SES...')
    let nextToken: string | undefined = undefined
    let sesSearchCount = 0
    let sesLinkedCount = 0

    do {
      const response = await getContacts({ nextPageToken: nextToken })

      if (response.Contacts) {
        response.Contacts.forEach((contact) => {
          const email = contact.EmailAddress?.toLowerCase().trim()
          if (!email) return

          // Parse attributes data
          let firstName = ''
          let lastName = ''
          let displayName = ''
          let isMember = false

          const contactWithAttributes = contact as any
          if (contactWithAttributes.AttributesData) {
            try {
              const attributes = JSON.parse(contactWithAttributes.AttributesData)
              firstName = attributes.firstName || ''
              lastName = attributes.lastName || ''
              displayName = attributes.displayName || `${firstName} ${lastName}`.trim()
              isMember = attributes.isMember || false
            } catch (e) {
              // Parsing failed
            }
          }

          const fullName = `${firstName} ${lastName}`.toLowerCase().trim()

          // Check if search term matches email or name
          const matchesEmail = email.includes(searchTerm)
          const matchesName =
            firstName.toLowerCase().includes(searchTerm) ||
            lastName.toLowerCase().includes(searchTerm) ||
            fullName.includes(searchTerm) ||
            displayName.toLowerCase().includes(searchTerm)

          // CRITICAL: Also include SES contacts whose emails are in directory records
          // This ensures we link SES data even if email doesn't match search term
          const isDirectoryEmail = directoryEmails.has(email)

          if (matchesEmail || matchesName || isDirectoryEmail) {
            if (matchesEmail || matchesName) {
              sesSearchCount++ // Count as search result
            }
            if (isDirectoryEmail) {
              sesLinkedCount++ // Count as directory link
            }

            // Parse topic preferences
            const sesLists: any = {}
            if (contact.TopicPreferences) {
              contact.TopicPreferences.forEach((pref) => {
                const topicName = pref.TopicName
                if (topicName) {
                  sesLists[topicName] = pref.SubscriptionStatus === 'OPT_IN'
                }
              })
            }

            // Try to find this email in existing directory persons
            // Method 1: Check if SES has dynamodbSK link (authoritative)
            let foundInDirectory = false
            const contactWithAttributes = contact as any
            let attributes: any = null

            if (contactWithAttributes.AttributesData) {
              try {
                attributes = JSON.parse(contactWithAttributes.AttributesData)
              } catch (e) {
                // AttributesData parsing failed
              }
            }

            // If SES contact has dynamodbSK, use that to find directory person
            if (attributes?.dynamodbSK) {
              const linkedBaseSkey = attributes.dynamodbSK.split('#EMAIL')[0]
              const linkedPerson = personsMap.get(linkedBaseSkey)

              if (linkedPerson) {
                // Find or create email entry for this person
                let emailInPerson = linkedPerson.emails.find((e) => e.email === email)
                if (emailInPerson) {
                  // Update existing email with SES data
                  emailInPerson.inSES = true
                  emailInPerson.sesLists = sesLists
                } else {
                  // Add email from SES (first 2 active, rest archived)
                  const status: EmailStatus = linkedPerson.emails.length < 2 ? 'active' : 'archived'
                  const bounceReason = suppressedEmails.get(email.toLowerCase())
                  linkedPerson.emails.push({
                    email,
                    inSES: true,
                    inDirectory: false, // Email exists in SES but not in DynamoDB
                    isPrimary: false,
                    status,
                    isBounced: !!bounceReason,
                    bounceReason,
                    sesLists,
                  })
                }
                foundInDirectory = true
              } else {
                console.warn(
                  `⚠️ SES contact ${email} has dynamodbSK=${attributes.dynamodbSK} but directory record not found (stale link)`
                )
              }
            }

            // Method 2: Fall back to exact email match (case-insensitive)
            if (!foundInDirectory) {
              for (const person of personsMap.values()) {
                const emailInPerson = person.emails.find((e) => e.email === email)
                if (emailInPerson) {
                  // Update existing email with SES data
                  emailInPerson.inSES = true
                  emailInPerson.sesLists = sesLists
                  foundInDirectory = true
                  break
                }
              }
            }

            // If not in directory, create SES-only person entry
            if (!foundInDirectory) {
              // Check if email is unsubscribed from all lists
              const isUnsubscribed =
                !sesLists ||
                Object.keys(sesLists).length === 0 ||
                Object.values(sesLists).every((v) => !v)

              const bounceReason = suppressedEmails.get(email.toLowerCase())
              sesOnlyEmails.set(email, {
                pkey: `SES#${email}`,
                baseSkey: `SES#${email}`,
                firstName,
                lastName,
                displayName: displayName || email,
                isMember,
                emails: [
                  {
                    email,
                    inSES: true,
                    inDirectory: false,
                    isPrimary: true,
                    status: isUnsubscribed ? 'archived' : 'active',
                    isBounced: !!bounceReason,
                    bounceReason,
                    sesLists,
                  },
                ],
                // Flag if this SES contact has a stale link
                hasStaleLink: attributes?.dynamodbSK ? true : false,
                staleLinkSK: attributes?.dynamodbSK,
              })
            }
          }
        })
      }

      nextToken = response.NextToken
    } while (nextToken)

    console.log(
      `📧 Found ${sesSearchCount} SES search matches, linked ${sesLinkedCount} directory emails`
    )

    // 3. Combine directory persons and SES-only persons
    const allPersons = [...personsMap.values(), ...sesOnlyEmails.values()]

    // 4. Detect potential duplicates (same name)
    const nameCount = new Map<string, number>()
    allPersons.forEach((person) => {
      const fullName = `${person.firstName} ${person.lastName}`.toLowerCase().trim()
      if (fullName) {
        nameCount.set(fullName, (nameCount.get(fullName) || 0) + 1)
      }
    })

    allPersons.forEach((person) => {
      const fullName = `${person.firstName} ${person.lastName}`.toLowerCase().trim()
      if (nameCount.get(fullName)! > 1) {
        person.isPotentialDuplicate = true
      }
    })

    // 5. Sort by name
    allPersons.sort((a, b) => {
      const nameA = a.displayName || a.emails[0]?.email || ''
      const nameB = b.displayName || b.emails[0]?.email || ''
      return nameA.localeCompare(nameB)
    })

    console.log(`✅ Total unique persons: ${allPersons.length}`)

    return NextResponse.json({
      searchTerm,
      totalResults: allPersons.length,
      results: allPersons,
    })
  } catch (error) {
    console.error('❌ Error searching contacts:', error)
    return NextResponse.json({ error: 'Failed to search contacts' }, { status: 500 })
  }
}
