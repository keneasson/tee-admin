import React, { useEffect, useState } from 'react'
import { Button, Heading, Text, YStack } from '@my/ui'
import { Contacts } from 'app/features/email-tester/contacts'
import { getContacts } from 'app/provider/get-data'
import { Contact } from '@aws-sdk/client-sesv2'
import { EmailListTypeKeys, SimplifiedContactListType, SimplifiedContacts } from 'app/types'

/**
 * inputs an empty ContactList with name,
 * @param contactLists
 * @constructor
 */
export const ContactLists: React.FC<{ contactLists: SimplifiedContactListType }> = ({
  contactLists,
}) => {
  const [allLists, setAllLists] = useState<SimplifiedContacts>()
  const [nextToken, setNextToken] = useState<string | false>(false)

  const handleRequestContacts = async (listName: EmailListTypeKeys): Promise<void> => {
    console.log('handleRequestContacts.listName', listName)
    const sesContacts = await getContacts(listName, nextToken)
    if (!sesContacts.Contacts) {
      setAllLists({
        ...allLists,
        [listName]: null,
      })
      return
    }
    setAllLists({
      ...allLists,
      [listName]: simplifyPreferences(sesContacts.Contacts),
    })
    const next = sesContacts.NextToken ?? false
    console.log('ContactLists.handleRequestContacts().next', { next })
    setNextToken(next)
  }

  useEffect(() => {
    console.log('ContactLists.useEffect', allLists)
    console.log('ContactLists.useEffect', { nextToken })
  }, [allLists])

  return (
    <YStack>
      <Heading size={5}>{contactLists.listName}</Heading>
      {contactLists.lists.map((list, key) => {
        const listName = list.key
        const hasMoreString = !!nextToken ? 'Fetch' : 'Fetch More'
        console.log('listName, nextToken', { listName, nextToken, hasMoreString })
        return (
          <YStack key={key}>
            <YStack>
              <Text>View {listName}</Text>
              <Button onPress={() => handleRequestContacts(list.key)}>
                <Text>{hasMoreString}</Text>
              </Button>
              <YStack>
                {allLists && allLists[listName] && (
                  <Contacts contacts={allLists[listName]}></Contacts>
                )}
              </YStack>
            </YStack>
          </YStack>
        )
      })}
    </YStack>
  )
}

export function simplifyPreferences(contacts: Contact[]): SimplifiedContacts | null {
  if (!contacts) {
    return null
  }
  return contacts.reduce((acc: SimplifiedContacts, contact: Contact) => {
    return {
      ...acc,
      [contact.EmailAddress as string]: {
        unsubscribed: contact.UnsubscribeAll,
        preferences: contact.TopicPreferences
          ? contact.TopicPreferences.reduce((p, pref) => {
              return {
                ...p,
                [pref.TopicName as EmailListTypeKeys]: pref.SubscriptionStatus === 'OPT_IN',
              }
            }, {})
          : null,
      },
    }
  }, {})
}
