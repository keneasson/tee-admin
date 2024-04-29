import React, { useEffect, useState } from 'react'
import { Button, Heading, Text, YStack } from '@my/ui'
import { Contacts } from 'app/features/email-tester/contacts'
import { getContacts } from 'app/provider/get-data'

type ContactPreferences = { key: string; defaultOptIn; boolean; displayName: string }
type ContactListsProps = {
  contactLists: {
    listName: string
    lists: ContactPreferences[]
  }
}
export const ContactLists: React.FC<ContactListsProps> = ({ contactLists }) => {
  const [contacts, setContacts] = useState<any>({})

  const handleRequestContacts = async (listName: string): Promise<void> => {
    console.log('handleRequestContacts.listName', listName)
    const response = await getContacts(listName)
    setContacts({
      ...contacts,
      listName: response,
    })
  }

  useEffect(() => {
    console.log('ContactLists.useEffect', contacts)
  }, [contacts])

  return (
    <YStack>
      <Heading size={5}>{contactLists.listName}</Heading>
      {contactLists.lists.map((list, key) => {
        const listName = list.key
        console.log('listName', list)
        return (
          <YStack key={key}>
            <YStack>
              <Text>
                View {list.displayName}{' '}
                <Button onPress={() => handleRequestContacts(list.key)}>
                  <Text>Fetch</Text>
                </Button>
              </Text>
            </YStack>
            <YStack>
              {contacts && contacts[listName] && (
                <Contacts contacts={contacts[listName]}></Contacts>
              )}
            </YStack>
          </YStack>
        )
      })}
    </YStack>
  )
}
