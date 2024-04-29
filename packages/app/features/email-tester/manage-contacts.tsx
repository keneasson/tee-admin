import { Button, Header, Text, YStack } from '@my/ui'
import { ContactLists } from 'app/features/email-tester/contact-list'
import React, { useState } from 'react'
import { addContacts, getContactsList } from 'app/provider/get-data'
import { ContactListProps } from 'app/types'

export const ManageContacts: React.FC = () => {
  const [contactLists, setContactLists] = useState<any>(null)
  const [allContacts, setAllContacts] = useState<string>('0')

  const handleRequestContactList = async () => {
    console.log('in here handleRequestContactList')
    const response = await getContactsList()
    console.log('response', response)
    setContactLists(response)
  }

  const handleImportContactList = async () => {
    console.log('in here handleImportContactList')
    const newContact: ContactListProps = {
      listName: 'TEEAdmin',
      contact: {
        email: 'email@address.com',
        preferences: {
          sundaySchool: true,
          memorial: true,
          newsletter: true,
          bibleClass: true,
        },
      },
    }
    const response = await addContacts(newContact)
    console.log('response', response)
    setAllContacts(response)
  }

  return (
    <>
      <Header>Manage Contacts</Header>
      <YStack>
        <Button onPress={() => handleRequestContactList()}>
          <Text>View Contact Lists</Text>
        </Button>
        <Button onPress={() => handleImportContactList()}>
          <Text>Bulk import</Text>
        </Button>
        <Text>response of bulk import: {allContacts}</Text>
      </YStack>
      {contactLists && <ContactLists contactLists={contactLists} />}
    </>
  )
}
