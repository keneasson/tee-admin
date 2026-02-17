import { NextApiRequest, NextApiResponse } from 'next'
import { addContact, getContacts, updateContact } from '../../../utils/email/contact'
import { CreateContactType, DirectoryType } from '@my/app/types'
import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'

/**
 * Main API Endpoint for sending an Email for a Specific Reason
 * reasons include: Newsletter, Memorial, Sunday School and Bible Class
 *
 * takes a query param ?reason=
 * @param req NextApiRequest
 * @param res NextApiResponse
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  try {
    /**
     * ***************************************
     * ADD a Contact to SES Subscriber list
     * unless specified, the list will have default Topics.
     * ***************************************
     */
    if (req.method === 'POST') {
      const contact = JSON.parse(req.body) as CreateContactType

      const result = await addContact(contact)
      console.log('API POST.addContact body', { contact })
      return res.status(200).json(result)
    }

    /**
     * ***************************************
     * UPDATE a Contact to SES Subscriber list
     * unless specified, the list will have default Topics.
     * ***************************************
     */
    if (req.method === 'PATCH') {
      const contact = JSON.parse(req.body) as CreateContactType

      const result = await updateContact(contact)
      console.log('API PATCH.addContact body', { contact, result })
      return res.status(200).json(result)
    }
    /**
     * ***************************************
     * GET the next set of Contacts from SES Subscriber List
     * Enriched with directory data (names and member status)
     * ***************************************
     */
    if (req.method === 'GET') {
      const nextPageToken = checkNextPageToken(req.query)
      const contactResponse = await getContacts({ nextPageToken })

      // Fetch directory data to enrich contacts with names and member status
      const scheduleService = new ScheduleService()
      const directoryMap = new Map<string, { firstName: string; lastName: string; ecclesia: string }>()

      try {
        const directoryResponse = await scheduleService.getDirectoryData()

        if (directoryResponse && directoryResponse.content) {
          // Content is an array of arrays: [headers, ...rows]
          // Headers: ['LastName', 'FirstName', 'Address', 'Phone', 'Email', 'Children', 'ecclesia']
          const rows = directoryResponse.content.slice(1) // Skip header row

          rows.forEach((row: any[]) => {
            const [lastName, firstName, address, phone, email, children, ecclesia] = row
            if (email && typeof email === 'string') {
              directoryMap.set(email.toLowerCase().trim(), {
                firstName: firstName || '',
                lastName: lastName || '',
                ecclesia: ecclesia || ''
              })
            }
          })

          console.log(`📋 Fetched ${rows.length} directory entries for enrichment`)
          console.log(`📧 Created directory map with ${directoryMap.size} email entries`)
        }
      } catch (error) {
        console.warn('Failed to fetch directory data for contact enrichment:', error)
        // Continue without enrichment if directory fetch fails
      }

      // Enrich contacts with directory data
      let enrichedCount = 0
      const enrichedContacts = contactResponse.Contacts?.map((contact: any) => {
        const email = contact.EmailAddress?.toLowerCase().trim()
        const directoryEntry = email ? directoryMap.get(email) : undefined

        if (directoryEntry) {
          // Store enriched data in AttributesData as JSON
          const attributes = {
            firstName: directoryEntry.firstName || '',
            lastName: directoryEntry.lastName || '',
            displayName: `${directoryEntry.firstName} ${directoryEntry.lastName}`.trim(),
            isMember: directoryEntry.ecclesia?.toLowerCase() === 'tee'
          }

          enrichedCount++
          return {
            ...contact,
            AttributesData: JSON.stringify(attributes)
          }
        }

        return contact
      }) || []

      console.log(`✅ Enriched ${enrichedCount} of ${contactResponse.Contacts?.length || 0} contacts with directory data`)

      // Log a sample enriched contact for debugging
      if (enrichedCount > 0) {
        const sampleEnriched = enrichedContacts.find((c: any) => c.AttributesData)
        if (sampleEnriched) {
          console.log('📝 Sample enriched contact:', {
            email: sampleEnriched.EmailAddress,
            attributes: sampleEnriched.AttributesData
          })
        }
      }

      const nextToken = contactResponse.NextToken
        ? encodeURIComponent(contactResponse.NextToken)
        : undefined
      return res.status(200).json({ contacts: enrichedContacts, nextToken })
    }
  } catch (e) {
    console.log('getContacts error', e)
    const failed = {
      message: 'Failed in outside catch',
      error: e,
    }
    return res.status(500).json({ failed })
  }
}

/**
 * When we pass the NextToken Back from the Front-end it get's mashed so
 * we url encode it before packing it up. This function checks for it
 * then decodes it, so it works.
 * @param query the NextApiRequest Query String
 */
function checkNextPageToken(query: NextApiRequest['query']): string | undefined {
  if (!query?.['NextToken']) {
    return undefined
  }
  return decodeURIComponent(query['NextToken'] as string)
}
