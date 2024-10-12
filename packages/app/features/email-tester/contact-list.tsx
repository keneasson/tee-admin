import React, { useState } from 'react'
import { Button, Heading, Separator, Text, XStack, YStack } from '@my/ui'
import { Contacts } from 'app/features/email-tester/contacts'
import { getContacts } from 'app/provider/get-data'
import { Contact } from '@aws-sdk/client-sesv2'
import {
  EmailListTypeKeys,
  EmailListTypes,
  SimplifiedContactListType,
  SimplifiedContacts,
  SimplifiedContactsByList,
} from 'app/types'

const ALL_CONTACTS_LOADED = 'DONE'

/**
 * inputs an empty ContactList with name,
 * @param contactLists
 * @constructor
 */
export const ContactLists: React.FC<{ contactLists: SimplifiedContactListType }> = ({
  contactLists,
}) => {
  const [allLists, setAllLists] = useState<SimplifiedContacts>()
  const [nextToken, setNextToken] = useState<string>()

  console.log('ContactLists.contactLists', contactLists)

  const handleRequestContacts = async (): Promise<void> => {
    if (nextToken === ALL_CONTACTS_LOADED) {
      return
    }
    const { nextToken: newNextToken, contacts } = await getContacts(nextToken)
    setNextToken(newNextToken ?? ALL_CONTACTS_LOADED)

    if (!contacts) {
      return
    }

    const simpleContacts = simplifyPreferences(contacts)
    if (!simpleContacts) {
      setAllLists(undefined)
      return
    }
    const mergedList = mergeLists(allLists?.subscribed, simpleContacts.subscribed)
    console.log('mergedList', mergedList)
    setAllLists({
      unsubscribed: [...(allLists?.unsubscribed ?? []), ...(simpleContacts.unsubscribed ?? [])],
      subscribed: mergedList ?? {},
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
      {contactLists.lists.map((list, index) => {
        const listName = list.key
        const contacts = allLists?.subscribed[listName]
        if (!contacts) {
          return (
            <YStack key={index}>
              <Text>{listName} is empty</Text>
            </YStack>
          )
        }
        return (
          <>
            <YStack key={index}>
              <XStack alignItems={'center'} gap={'$5'}>
                <Heading>View {listName}</Heading>
                <Text>{Object.keys(contacts).length}</Text>
              </XStack>
            </YStack>
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
              <Contacts contacts={contacts}></Contacts>
              <Separator />
            </YStack>
          </>
        )
      })}
    </YStack>
  )
}

export function simplifyPreferences(contacts: Contact[]): SimplifiedContacts | null {
  if (!contacts) {
    return null
  }
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
    }, {})
    const lists = contact.TopicPreferences.filter((t) => t.SubscriptionStatus === 'OPT_IN')
    return lists.reduce((a, topic): SimplifiedContacts => {
      const listName = topic.TopicName as string
      return {
        ...a,
        subscribed: {
          ...a.subscribed,
          [listName]: {
            ...(a.subscribed?.[listName] ? a.subscribed[listName] : {}),
            [email]: preferences,
          },
        },
      }
    }, acc)
  }, {} as SimplifiedContacts)
}

const mergeLists = (
  old: { [K in EmailListTypeKeys]?: SimplifiedContactsByList } | undefined,
  fetched: { [K in EmailListTypeKeys]?: SimplifiedContactsByList }
): { [K in EmailListTypeKeys]?: SimplifiedContactsByList } | undefined => {
  if (!old) {
    return fetched
  }
  return Object.keys(EmailListTypes).reduce((acc, key) => {
    return {
      ...acc,
      [key]: { ...(old[key] || {}), ...(fetched?.[key] || {}) },
    }
  }, {})
}
