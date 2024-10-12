import React, { useState } from 'react'

import { Button, FullDialog, Heading, Text, YStack } from '@my/ui'
import { ContactLists } from 'app/features/email-tester/contact-list'
import { getContactsList } from 'app/provider/get-data'
import { SimplifiedContactListType } from 'app/types'

import { AddUpdateList } from 'app/features/email-tester/dialogues/add-update-list'
import { AddUpdateContact } from './dialogues/add-update-contact'

export const ManageContacts: React.FC = () => {
  const [contactLists, setContactLists] = useState<SimplifiedContactListType | null>(null)

  const handleRequestContactList = async (): Promise<void> => {
    console.log('in here handleRequestContactList')
    const response = await getContactsList()
    console.log('response', response)
    setContactLists(response)
  }

  return (
    <>
      <Heading>Manage Contacts</Heading>
      <YStack>
        <FullDialog content={<AddUpdateList />} trigger="Add New List"></FullDialog>
        <FullDialog content={<AddUpdateContact />} trigger="Add New Contact"></FullDialog>
        <Button onPress={() => handleRequestContactList()}>
          <Text>Load Contact Lists</Text>
        </Button>
      </YStack>
      {contactLists && <ContactLists contactLists={contactLists} />}
    </>
  )
}
