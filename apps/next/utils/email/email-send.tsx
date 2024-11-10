import { SendEmailCommand, type SendEmailCommandInput, SESv2Client } from '@aws-sdk/client-sesv2'

const adminMailDomain = '@tee-admin.com'

const SES_RATE_LIMIT = 15

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
    email: 'Memorial recap',
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

export const emailSend = async function ({
  reason,
  emailHtml,
  emailText,
  test = false,
}: emailSendProps): Promise<Sends | Error> {
  if (Object.keys(senders).findIndex((r) => r === reason) === -1) {
    throw new Error('reason is not a valid email type')
  }
  try {
    if (test) {
      senders[reason].contactList = 'testList'
    }
    console.log('reason, email, test', { reason, emailText, test })
    throw new Error('not ready')
    //
    // const listTopic = senders[reason].contactList
    // const sesClient = getSesClient()
    // const result = { sends: [], skips: [] }
    // let hasMoreContacts: string | undefined, contacts: ListContactsResponse['Contacts']
    // const { Contacts, NextToken } = await getContacts({ listTopic })
    // hasMoreContacts = NextToken
    // contacts = Contacts
    // if (!contacts) {
    //   return result
    // }
    // while (hasMoreContacts) {
    //   const more = await getContacts({ listTopic, nextPageToken: NextToken })
    //   hasMoreContacts = more.NextToken
    //   if (more.Contacts) {
    //     contacts = [...contacts, ...more.Contacts]
    //   }
    // }
    // const senderEmails = contacts
    //   .filter((contact) => contact.EmailAddress !== undefined && contact.UnsubscribeAll === false)
    //   .map((contact) => contact.EmailAddress as string)
    //
    // const from = `"${senders[reason].name}" <${senders[reason].email}${adminMailDomain}>`
    // const subject = senders[reason].subject
    //
    // const sendChunks = chunkArray(senderEmails, SES_RATE_LIMIT)
    // let allSent: Sends = { sends: [], skips: [] }
    // for (let i = 0; i < sendChunks.length; i++) {
    //   const sends = await sendDeferred({
    //     toArray: sendChunks[i],
    //     from,
    //     subject,
    //     listTopic,
    //     emailText,
    //     emailHtml,
    //     sesClient,
    //   })
    //   allSent = {
    //     sends: [...allSent.sends, ...sends.sends],
    //     skips: [...allSent.skips, ...sends.skips],
    //   }
    // }
    //
    // console.log('total sent', allSent.sends.length)
    // return allSent
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
  sesClient: SESv2Client
}

/**
 *
 * @param sendToChunk up to Rate Limit emails for one batch of sends.
 * @return Promise<Sent>
 */
async function sendDeferred(sendToChunk: SingleSendProps): Promise<Sends> {
  console.log('sendChunk begin', { start: new Date().getTime() })
  const [_, sends] = await Promise.all([
    setTimeoutAsync(1000), // SES Rate Limits sending per RATE_LIMIT/Second.
    chunkSend(sendToChunk),
  ])
  console.log('sendChunk done', {
    chunkCount: sendToChunk.toArray.length,
    start: new Date().getTime(),
  })
  return sends
}

/**
 * Returns when all the emails in toArray are sent
 * @param toArray
 * @param from
 * @param subject
 * @param listTopic
 * @param emailText
 * @param emailHtml
 * @param sesClient
 */
async function chunkSend({
  toArray,
  from,
  subject,
  listTopic,
  emailText,
  emailHtml,
  sesClient,
}: SingleSendProps): Promise<Sends> {
  const start = new Date().getTime()
  console.log('timestart', start)
  const sentTo = await Promise.all(
    toArray.map(async (to) => {
      const emailInput: SendEmailCommandInput = {
        FromEmailAddress: from,
        Destination: {
          ToAddresses: [to],
        },
        ListManagementOptions: {
          ContactListName: 'TEEAdmin',
          TopicName: listTopic,
        },
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
      }
      const emailCmd = new SendEmailCommand(emailInput)
      await sesClient.send(emailCmd)
      console.log('to', to)
      return to
    })
  )
  const end = new Date().getTime()
  console.log('timeend', { end, diff: end - start })
  return { sends: sentTo, skips: [] }
}

async function setTimeoutAsync(milliseconds: number) {
  console.log('setTimeoutAsync', { milliseconds, start: new Date().getTime() })
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('setTimeoutAsync resolve', { end: new Date().getTime(), milliseconds })
      resolve('1')
    }, milliseconds)
  })
}
