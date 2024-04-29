import { GetContactListCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import { getAwsConfig } from './contact'

export const inputTemplate = { ContactListName: 'TEEAdmin' }

/**
 * returns all the Topics (Contact Lists) for the entire system
 */
export async function getContactLists(): Promise<any> {
  try {
    const client = new SESv2Client(getAwsConfig())
    console.log('client', client)
    const input = {
      ...inputTemplate,
    }
    const command = new GetContactListCommand(input)
    const awsContactList = await client.send(command)
    if (!awsContactList.ContactListName) {
      return 'Unable to find the Contact list in AWS'
    }
    if (!awsContactList.Topics) {
      return 'Your subscriber list has no Topics (Lists)'
    }
    return {
      listName: awsContactList.ContactListName,
      lists: awsContactList.Topics.map((topic) => {
        return {
          key: topic.TopicName,
          defaultOptIn: topic.DefaultSubscriptionStatus === 'OPT_IN',
          displayName: topic.DisplayName,
        }
      }),
    }
  } catch (err) {
    console.log('typeof error', typeof err)
    console.log('actual error', err)
  }
  return
}
