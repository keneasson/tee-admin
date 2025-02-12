import React, { useState } from 'react'

import { Button, Heading, Text, YStack } from '@my/ui'
import { getContactsList } from '@my/app/provider/get-data'
import { SimplifiedContactListType } from '@my/app/types'
import { ContactLists } from './contact-list'
import { AddUpdateList } from './dialogues/add-update-list'
import { AddUpdateContact } from './dialogues/add-update-contact'

export const ManageContacts: React.FC = () => {
  const [contactLists, setContactLists] = useState<SimplifiedContactListType>()

  const handleRequestContactList = async (): Promise<void> => {
    console.log('in here handleRequestContactList')
    const response = await getContactsList()
    setContactLists(response)
  }

  return (
    <>
      <Heading>Manage Contacts</Heading>
      <YStack gap={'$4'}>
        <AddUpdateList />
        <AddUpdateContact />

        <Button onPress={() => handleRequestContactList()}>
          <Text>Load Contact Lists</Text>
        </Button>
      </YStack>
      {contactLists && <ContactLists contactLists={contactLists} />}
    </>
  )
}
