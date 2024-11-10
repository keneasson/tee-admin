import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import { Contact } from '@my/app/features/email-tester/contact'
import { SimplifiedContacts } from '@my/app/types'
import { useEffect, useState } from 'react'
import { updateContacts } from '../../provider/get-data'
import { ContactsEmailPreferences } from '../../types'

type ContactsProps = {
  contacts: SimplifiedContacts
}

export const Contacts: React.FC<ContactsProps> = ({ contacts }) => {
  const methods = useForm()
  const [subscribers, setSubscribers] = useState<string[]>()

  useEffect(() => {
    setSubscribers(Object.keys(contacts.subscribed))
  }, [contacts])

  useEffect(() => {
    const sub = methods.watch((value, { name }) => {
      if (subscribers && name) {
        const [key] = name.split('.')
        const email = subscribers[key]
        const preference = value[key] as ContactsEmailPreferences
        const response = updateContacts({ email, lists: preference })
        console.log('fixing ', { email, preference, response })
      }
    })
    return () => sub.unsubscribe()
  }, [subscribers, methods.watch])

  if (!subscribers) {
    return null
  }

  return (
    <FormProvider {...methods}>
      {subscribers.map((email, a) => (
        <Contact.Wrapper
          key={a}
          email={email}
          preferences={contacts.subscribed[email]}
          index={a}
        ></Contact.Wrapper>
      ))}
    </FormProvider>
  )
}

export const ConnectForm = ({ children }) => {
  const methods = useFormContext()

  return children({ ...methods })
}
