import { randomUUID } from 'crypto'
import { ListContactsResponse, SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
// import { getSesClient, SendEmailCommand } from './MockSesSendEmail'
import { getSesClient } from './sesClient'
import { getContacts } from './contact'
import { chunkArray } from '../chunkArray'
import { generateEcclesiaUpdateUrl } from './ecclesia-token'
import { addUtmParameters } from './utm-links'
import { sendRecordRepository } from '@my/app/provider/dynamodb/repositories/send-record-repository'

const adminMailDomain = '@tee-admin.com'

const SES_RATE_LIMIT = 14

// Re-export EmailReasonType from shared types for backward compatibility
export { type EmailReasonType as emailReasons } from '@my/app/types'
import { type EmailReasonType, type EmailSubReason } from '@my/app/types'
type emailReasons = EmailReasonType // Local alias for use in this file

// All outbound mail uses a single From: address to concentrate sender reputation,
// and a single Reply-To routing every reply to the Recording Brother.
const SENDER_EMAIL = 'communications'
const REPLY_TO = 'teerecbro@gmail.com'

const senders = {
  'sunday-school': {
    name: 'Toronto East Sunday School',
    email: SENDER_EMAIL,
    subject: 'Sunday School Tomorrow',
    contactList: 'sundaySchool',
    replyTo: REPLY_TO,
  },
  newsletter: {
    name: 'Toronto East Ecclesia',
    email: SENDER_EMAIL,
    subject: 'Toronto East Christadelphian Ecclesia Newsletter',
    contactList: 'newsletter',
    replyTo: REPLY_TO,
  },
  'bible-class': {
    name: 'Toronto East Ecclesia',
    email: SENDER_EMAIL,
    subject: 'Bible Class Tonight!',
    contactList: 'bibleClass',
    replyTo: REPLY_TO,
  },
  recap: {
    name: 'Toronto East Ecclesia',
    email: SENDER_EMAIL,
    subject: 'Memorial Service Tomorrow',
    contactList: 'memorial',
    replyTo: REPLY_TO,
  },
  'business-meeting': {
    name: 'Toronto East Ecclesia',
    email: SENDER_EMAIL,
    subject: 'Business Meeting Details',
    contactList: 'members',
    replyTo: REPLY_TO,
  },
  custom: {
    name: 'Toronto East Ecclesia',
    email: SENDER_EMAIL,
    subject: 'Toronto East Communications',
    contactList: 'testList', // Safe default - will be overridden by customList parameter
    replyTo: REPLY_TO,
  },
  'event-announcement': {
    name: 'Toronto East Ecclesia',
    email: SENDER_EMAIL,
    subject: 'Event Announcement',
    contactList: 'newsletter', // Default - will be overridden by customList parameter
    replyTo: REPLY_TO,
  },
  'inter-ecclesia': {
    name: 'Toronto East Ecclesia',
    email: SENDER_EMAIL,
    subject: 'Inter-Ecclesia Announcement',
    contactList: 'interEcclesia',
    replyTo: REPLY_TO,
  },
}

export type emailSendProps = {
  reason: emailReasons
  emailHtml: string
  emailText: string
  test?: boolean
  customList?: string // For custom emails to specify which list to send to
  customSubject?: string // For custom emails to specify subject
  subReason?: EmailSubReason // Categorization for per-send tracking
  description?: string // Free-text description for the send record
  sentBy?: string // Email of the user who triggered the send
}

type Sends = { sends: string[]; skips: string[] }
type SendResult = Sends & { campaignId: string }

async function getAllContacts({
  listTopic,
  nextPageToken,
}: {
  listTopic: string
  nextPageToken?: string
}): Promise<ListContactsResponse['Contacts']> {
  const contacts = await getContacts({ listTopic, nextPageToken })
  if (!contacts.Contacts) {
    return []
  }
  if (contacts.NextToken) {
    const next = await getAllContacts({ listTopic, nextPageToken: contacts.NextToken })
    return next ? [...contacts.Contacts, ...next] : contacts.Contacts
  }
  return contacts.Contacts
}

export const emailSend = async function ({
  reason,
  emailHtml,
  emailText,
  test = false,
  customList,
  customSubject,
  subReason = 'general',
  description,
  sentBy,
}: emailSendProps): Promise<SendResult | Error> {
  if (Object.keys(senders).findIndex((r) => r === reason) === -1) {
    throw new Error(`${reason} is not a valid email type`)
  }

  const campaignId = randomUUID()

  try {
    // For custom emails, use the provided list, otherwise use the default for that reason
    const listTopic = test === true ? 'testList' : (customList || senders[reason].contactList)
    const sesClient = getSesClient()

    console.log('why test=false sends test', { test, listTopic })
    const contacts = await getAllContacts({ listTopic, nextPageToken: undefined })
    if (!contacts) {
      return { sends: [], skips: [], campaignId }
    }

    const senderEmails = contacts
      .filter((contact) => contact.EmailAddress !== undefined && contact.UnsubscribeAll === false)
      .map((contact) => contact.EmailAddress as string)

    // Format date in Toronto timezone to avoid UTC date issues when sending in evening EST
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })

    const from = `"${senders[reason].name}" <${senders[reason].email}${adminMailDomain}>`
    // For custom emails, use the provided subject, otherwise use the default
    const defaultSubject = customSubject || senders[reason].subject
    const subject = `${test ? '[TEST] ' : ''}${defaultSubject} ${today}`

    const sendChunks = chunkArray(senderEmails, SES_RATE_LIMIT)
    const replyTo = senders[reason].replyTo
    let allSent: Sends = { sends: [], skips: [] }
    for (let i = 0; i < sendChunks.length; i++) {
      const sends = await sendDeferred({
        toArray: sendChunks[i],
        from,
        subject,
        listTopic,
        emailText,
        emailHtml,
        reason,
        sesClient,
        replyTo,
        campaignId,
      })
      allSent = {
        sends: [...allSent.sends, ...sends.sends],
        skips: [...allSent.skips, ...sends.skips],
      }
    }

    console.log('total sent', allSent.sends.length)

    // Create send record for per-email tracking (best-effort, don't fail the send)
    try {
      await sendRecordRepository.createSendRecord({
        campaignId,
        reason,
        subReason,
        subject,
        description,
        recipientCount: senderEmails.length,
        sentCount: allSent.sends.length,
        failedCount: allSent.skips.length,
        sentBy,
      })
    } catch (recordError) {
      console.error('Failed to create send record (non-fatal):', recordError)
    }

    return { ...allSent, campaignId }
  } catch (error) {
    console.error('SES Sending Email command', error)
    throw error
  }
}

type SingleSendProps = {
  from: string
  toArray: string[]
  subject: string
  listTopic: string
  emailText: string
  emailHtml: string
  reason: string
  sesClient: SESv2Client
  replyTo?: string
  campaignId: string
}

/**
 *
 * @param sendToChunk up to Rate Limit emails for one batch of sends.
 * @return Promise<Sent>
 */
async function sendDeferred(sendToChunk: SingleSendProps): Promise<Sends> {
  const [_, sent] = await Promise.all([
    setTimeoutAsync(1000), // SES Rate Limits sending per RATE_LIMIT/Second.
    chunkSend(sendToChunk),
  ])
  const failed = sendToChunk.toArray.filter((ok) => !sent.includes(ok))
  return { sends: sent, skips: failed }
}

/**
 * Returns when all the emails in toArray are sent
 * @param toArray Email[]
 * @param from Email
 * @param subject string
 * @param listTopic SES List Topic
 * @param emailText
 * @param emailHtml
 * @param reason - selects audience and template to send
 * @param sesClient
 */
async function chunkSend({
  toArray,
  from,
  subject,
  listTopic,
  emailText,
  emailHtml,
  reason,
  sesClient,
  replyTo,
  campaignId,
}: SingleSendProps): Promise<string[]> {
  const sent = []
  try {
    for (let i = 0; i < toArray.length; i++) {
      const recipientEmail = toArray[i]

      // Personalize email content for inter-ecclesia emails
      let personalizedHtml = emailHtml
      let personalizedText = emailText

      if (reason === 'inter-ecclesia') {
        // Generate token URL for this recipient (token maps to email → PersonRecord)
        const updateUrl = await generateEcclesiaUpdateUrl(recipientEmail)
        personalizedHtml = emailHtml.replace(/\{\{ecclesiaUpdateUrl\}\}/g, updateUrl)
        personalizedText = emailText.replace(/\{\{ecclesiaUpdateUrl\}\}/g, updateUrl)
      }

      // Add UTM tracking parameters to all tee-admin.com links
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
      personalizedHtml = addUtmParameters(personalizedHtml, reason, today)

      const emailCmd = new SendEmailCommand({
        FromEmailAddress: from,
        ReplyToAddresses: replyTo ? [replyTo] : undefined,
        Destination: {
          ToAddresses: [recipientEmail],
        },
        ListManagementOptions: {
          ContactListName: 'TEEAdmin',
          TopicName: listTopic,
        },
        ConfigurationSetName: 'tee-email-tracking',
        EmailTags: [
          {
            Name: 'Reason',
            Value: reason,
          },
          {
            Name: 'Campaign',
            Value: campaignId,
          },
        ],
        Content: {
          Simple: {
            Subject: {
              Data: subject,
            },
            Body: {
              Text: {
                Data: personalizedText,
              },
              Html: {
                Data: personalizedHtml,
              },
            },
          },
        },
      })
      await sesClient.send(emailCmd as any)
      sent.push(recipientEmail)
    }
    return sent
  } catch (error) {
    console.log('chunkSend error sending', error)
    return sent
  }
}

async function setTimeoutAsync(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('1')
    }, milliseconds)
  })
}
