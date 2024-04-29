import { addContact } from '../contact'
import { ContactPreferencesProps, ContactPrefPreferences, EmailListTypeKeys, EmailListTypes } from 'app/types'

import * as contacts from '../../../data/contacts-subscribers.json'

/**
 * imports a JSON Contact list iterating over it and sending each to SES.
 */
export async function initSubscriberList() {
  const sesResponse = await Promise.all(
    contacts.map(async (contact): Promise<string> => {
      console.log('contact - from JSON', contact)
      const sesContact: ContactPreferencesProps = {
        email: contact.EmailAddress,
        preferences: Object.keys(EmailListTypes).reduce((acc, key) => {
          acc[key as EmailListTypeKeys] = !!contact.TopicPreferences.indexOf(key)
          return acc
        }, {} as ContactPrefPreferences),
      }
      await addContact({ listName: 'TEEConnect', contact: sesContact })
      return contact.EmailAddress
    })
  )
  console.log('sesResponse', sesResponse)
  return sesResponse.length
}
