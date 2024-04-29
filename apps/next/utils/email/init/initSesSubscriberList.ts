import {
  CreateContactListCommand,
  CreateContactListCommandOutput,
  SESv2Client,
  SubscriptionStatus,
} from '@aws-sdk/client-sesv2'
import { inputTemplate } from '../contact-lists'
import { getAwsConfig } from '../contact'

/**
 * This basically an initialization code and only needs to be run once... maybe
 * not sure how to update a ContactList
 *
 * A Contact list is good for many Email Topics and unifies unsubscribes verse Opt out from a specific email.
 */
export async function createList(): Promise<CreateContactListCommandOutput> {
  const client = new SESv2Client(getAwsConfig())
  const input = {
    ...inputTemplate,
    Topics: [
      // Topics
      {
        TopicName: 'memorial', // required
        DisplayName: 'Memorial', // required
        DefaultSubscriptionStatus: SubscriptionStatus.OPT_IN, // required
      },
      {
        TopicName: 'bibleClass', // required
        DisplayName: 'Bible Class', // required
        DefaultSubscriptionStatus: SubscriptionStatus.OPT_IN, // required
      },
      {
        TopicName: 'newsletter', // required
        DisplayName: 'Newsletter', // required
        DefaultSubscriptionStatus: SubscriptionStatus.OPT_IN, // required
      },
      {
        TopicName: 'sundaySchool', // required
        DisplayName: 'Sunday School', // required
        DefaultSubscriptionStatus: SubscriptionStatus.OPT_OUT, // required
      },
    ],
    Description: 'General Mailing lists for TEE Members, Friends and Family',
  }
  const command = new CreateContactListCommand(input)
  return await client.send(command)
}
