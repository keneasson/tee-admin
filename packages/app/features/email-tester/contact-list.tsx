import React, { useState } from 'react'
import { Button, Heading, Separator, Text, XStack, YStack } from '@my/ui'
import { Contacts } from 'app/features/email-tester/contacts'
import { getContacts } from 'app/provider/get-data'
import { Contact } from '@aws-sdk/client-sesv2'
import {
  ContactPrefPreferences,
  EmailListTypeKeys,
  EmailListTypes,
  SimplifiedContactListType,
  SimplifiedContacts,
  SimplifiedContactsByList,
} from 'app/types'

/**
 * inputs an empty ContactList with name,
 * @param contactLists
 * @constructor
 */
export const ContactLists: React.FC<{ contactLists: SimplifiedContactListType }> = ({
  contactLists,
}) => {
  const [allLists, setAllLists] = useState<SimplifiedContacts>()
  const [nextToken, setNextToken] = useState<{ [key: string]: string } | false>(false)

  const handleRequestContacts = async (listName: EmailListTypeKeys): Promise<void> => {
    const { nextToken: newNextToken, contacts } = await getContacts(listName, nextToken?.[listName])
    const next = newNextToken ?? 'DONE'
    setNextToken({ ...nextToken, [listName]: next })

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
      <Heading size={5}>{contactLists.listName}</Heading>
      {contactLists.lists.map((list, key) => {
        const listName = list.key
        const hasMoreString = nextToken?.[listName] ? `Fetch More ${listName}` : 'Fetch'
        console.log('listName, nextToken, hasMoreString', {
          listName,
          nextToken: nextToken?.[listName],
          hasMoreString,
        })
        return (
          <YStack key={key}>
            <YStack>
              <Heading>View {listName}</Heading>
              {nextToken?.[listName] === 'DONE' ? (
                <Text color="$green10Light">All Contacts Loaded</Text>
              ) : (
                <Button onPress={() => handleRequestContacts(listName)}>
                  <Text>{hasMoreString}</Text>
                </Button>
              )}
              <YStack marginHorizontal={20}>
                {allLists?.subscribed && allLists.subscribed[listName] && (
                  <>
                    <XStack justifyContent={'space-between'}>
                      <Text>Email</Text>
                      <XStack gap={'$10'}>
                        <Text>Sunday School</Text>
                        <Text>Newsletter</Text>
                        <Text>Memorial</Text>
                        <Text>Bible Class</Text>
                      </XStack>
                    </XStack>
                    <Contacts contacts={allLists.subscribed[listName]}></Contacts>
                  </>
                )}
              </YStack>
            </YStack>
            <Separator />
          </YStack>
        )
      })}
    </YStack>
  )
}

type PrefBuilder = { preferences: ContactPrefPreferences; lists: string[] }

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
      console.log('a.subscribed')
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
