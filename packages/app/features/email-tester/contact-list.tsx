import React, { useEffect, useState } from 'react'
import { Button, Separator, Text, XStack, YStack } from '@my/ui'
import { Contacts } from '@my/app/features/email-tester/contacts'
import { getContacts } from '@my/app/provider/get-data'
import { Contact } from '@aws-sdk/client-sesv2'
import type {
  ContactPreferences,
  EmailListTypeKeys,
  SimplifiedContactListType,
  SimplifiedContacts,
} from '@my/app/types'

const ALL_CONTACTS_LOADED = 'DONE'

type ContactListsProps = {
  contactLists?: SimplifiedContactListType
}

/**
 * Display all contact lists
 * @constructor
 */
export const ContactLists: React.FC<ContactListsProps> = ({ contactLists }) => {
  const [allLists, setAllLists] = useState<SimplifiedContacts>({ subscribed: {}, unsubscribed: [] })
  const [nextToken, setNextToken] = useState<string>()

  useEffect(() => {
    console.log(ContactLists, { contactLists, allLists })
  }, [contactLists, allLists])

  const handleRequestContacts = async (): Promise<void> => {
    if (nextToken === ALL_CONTACTS_LOADED) {
      return
    }
    const { nextToken: newNextToken, contacts } = await getContacts(nextToken)
    setNextToken(newNextToken ?? ALL_CONTACTS_LOADED)

    const simpleContacts = simplifyPreferences(contacts)

    if (!simpleContacts) {
      return
    }
    setAllLists({
      ...allLists,
      subscribed: { ...allLists.subscribed, ...simpleContacts.subscribed },
    })
  }

  return (
    <YStack>
      {nextToken === ALL_CONTACTS_LOADED ? (
        <Text color="$green10Light">All Contacts Loaded</Text>
      ) : (
        <Button onPress={() => handleRequestContacts()}>
          <Text>{nextToken ? 'Load More Contacts' : 'Load Contacts'}</Text>
        </Button>
      )}

      <YStack>
        <XStack justifyContent={'space-between'}>
          <Text>Email</Text>
          <XStack gap={'$10'}>
            <Text>Sunday School</Text>
            <Text>Newsletter</Text>
            <Text>Memorial</Text>
            <Text>Bible Class</Text>
            <Text>Test List</Text>
          </XStack>
        </XStack>
        <Contacts contacts={allLists}></Contacts>
        <Separator />
      </YStack>
    </YStack>
  )
}

export function simplifyPreferences(contacts: Contact[]): SimplifiedContacts | null {
  return contacts.reduce((acc: SimplifiedContacts, contact: Contact): SimplifiedContacts => {
    const email = contact.EmailAddress as string
    if (contact.UnsubscribeAll) {
      return {
        ...acc,
        unsubscribed: [...acc.unsubscribed, email],
      }
    }
    if (!contact.TopicPreferences) {
      return acc
    }
    const preferences = contact.TopicPreferences.reduce((p, pref) => {
      return {
        ...p,
        [pref.TopicName as EmailListTypeKeys]: pref.SubscriptionStatus === 'OPT_IN',
      }
    }, {} as ContactPreferences)
    return {
      ...acc,
      subscribed: { ...acc.subscribed, [email]: preferences },
    }
  }, {} as SimplifiedContacts)
}
