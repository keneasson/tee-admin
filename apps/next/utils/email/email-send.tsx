import { ListContactsResponse, SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
// import { getSesClient, SendEmailCommand } from './MockSesSendEmail'
import { getSesClient } from './sesClient'
import { getContacts } from './contact'
import { chunkArray } from '../chunkArray'

const adminMailDomain = '@tee-admin.com'

const SES_RATE_LIMIT = 14

export type emailReasons = 'sunday-school' | 'newsletter' | 'bible-class' | 'recap'

const senders = {
  'sunday-school': {
    name: 'Toronto East Sunday School',
    email: 'sunday.school',
    subject: 'Sunday School Tomorrow',
    contactList: 'sundaySchool',
  },
  newsletter: {
    name: 'Toronto East Ecclesia',
    email: 'newsletter',
    subject: 'Toronto East Christadelphian Ecclesia Newsletter',
    contactList: 'newsletter',
  },
  'bible-class': {
    name: 'Toronto East Ecclesia',
    email: 'bible.class',
    subject: 'Bible Class Tonight!',
    contactList: 'bibleClass',
  },
  recap: {
    name: 'Toronto East Ecclesia',
    email: 'memorial.recap',
    subject: 'Memorial Service Tomorrow',
    contactList: 'memorial',
  },
}

export type emailSendProps = {
  reason: emailReasons
  emailHtml: string
  emailText: string
  test?: boolean
}

type Sends = { sends: string[]; skips: string[] }

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
}: emailSendProps): Promise<Sends | Error> {
  if (Object.keys(senders).findIndex((r) => r === reason) === -1) {
    throw new Error(`${reason} is not a valid email type`)
  }
  try {
    const listTopic = test === true ? 'testList' : senders[reason].contactList
    const sesClient = getSesClient()
    const result = { sends: [], skips: [] }

    console.log('why test=false sends test', { test, listTopic })
    const contacts = await getAllContacts({ listTopic, nextPageToken: undefined })
    if (!contacts) {
      return result
    }
    const senderEmails = contacts
      .filter((contact) => contact.EmailAddress !== undefined && contact.UnsubscribeAll === false)
      .map((contact) => contact.EmailAddress as string)

    const date = new Date()
    const today = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()

    const from = `"${senders[reason].name}" <${senders[reason].email}${adminMailDomain}>`
    const subject = `${test ? '[TEST] ' : ''}${senders[reason].subject} ${today}`

    const sendChunks = chunkArray(senderEmails, SES_RATE_LIMIT)
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
      })
      allSent = {
        sends: [...allSent.sends, ...sends.sends],
        skips: [...allSent.skips, ...sends.skips],
      }
    }

    console.log('total sent', allSent.sends.length)
    return allSent
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
}: SingleSendProps): Promise<string[]> {
  const sent = []
  try {
    for (let i = 0; i < toArray.length; i++) {
      const emailCmd = new SendEmailCommand({
        FromEmailAddress: from,
        Destination: {
          ToAddresses: [toArray[i]],
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
        ],
        Content: {
          Simple: {
            Subject: {
              Data: subject,
            },
            Body: {
              Text: {
                Data: emailText,
              },
              Html: {
                Data: emailHtml,
              },
            },
          },
        },
      })
      await sesClient.send(emailCmd as any)
      sent.push(toArray[i])
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
