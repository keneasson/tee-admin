import React, { useState } from 'react'

import { Button, FullDialog, Heading, Text, YStack } from '@my/ui'
import { ContactLists } from 'app/features/email-tester/contact-list'
import { addContacts, getContactsList } from 'app/provider/get-data'
import { CreateContactType, SimplifiedContactListType } from 'app/types'

import { AddUpdateList } from 'app/features/email-tester/dialogues/add-update-list'

export const ManageContacts: React.FC = () => {
  const [contactLists, setContactLists] = useState<SimplifiedContactListType | null>(null)

  const handleRequestContactList = async (): Promise<void> => {
    console.log('in here handleRequestContactList')
    const response = await getContactsList()
    console.log('response', response)
    setContactLists(response)
  }

  const handleAddContact = async (props: CreateContactType) => {
    console.log('in here handleImportContactList', props)
    const response = await addContacts(props)
    console.log('response', response)
  }

  const handleShowAddContact = async () => {}
  const handleShowAddCList = async () => {}

  return (
    <>
      <Heading>Manage Contacts</Heading>
      <YStack>
        <FullDialog content={<AddUpdateList />} trigger="Add New List"></FullDialog>
        {/*<AddUpdateContact />*/}
        <Button onPress={() => handleRequestContactList()}>
          <Text>Load Contact Lists</Text>
        </Button>
      </YStack>
      {contactLists && <ContactLists contactLists={contactLists} />}
    </>
  )
}
