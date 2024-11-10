import { addContact, getContacts, updateContact } from '../contact'
import { ContactPrefPreferences, EmailListTypeKeys, EmailListTypes } from '@my/app/types'

import * as contacts from '../../../data/contact-subscribers4.json'

/**
 * imports a JSON Contact list iterating over it and sending each to SES.
 */
export async function initSubscriberList() {
  const oldContacts = await getContacts({})
  const emails = oldContacts?.Contacts?.map((contact) => contact.EmailAddress)
  if (!emails) {
    console.log('No Emails to add or update')
    return
  }

  const sesResponse = await Promise.all(
    contacts.map(async (contact) => {
      const email = contact.EmailAddress
      const sesContact = {
        email,
        preferences: Object.keys(EmailListTypes).reduce((acc, key) => {
          acc[key as EmailListTypeKeys] = contact.TopicPreferences.indexOf(key) !== -1
          return acc
        }, {} as ContactPrefPreferences),
      }
      if (emails.indexOf(email) === -1) {
        await addContact({ listName: 'TEEConnect', contact: sesContact })
      } else {
        await updateContact({ listName: 'TEEConnect', contact: sesContact })
      }
      return email
    })
  )

  return sesResponse.length
}
