import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import { Contact } from 'app/features/email-tester/contact'
import { SimplifiedContactsByList } from 'app/types'
import { useEffect } from 'react'

type ContactsProps = {
  contacts: SimplifiedContactsByList
}

export const Contacts: React.FC<ContactsProps> = ({ contacts }) => {
  const methods = useForm()

  useEffect(() => {
    const sub = methods.watch((value, { name, type }) =>
      console.log('watching ', { value, name, type })
    )
    return () => sub.unsubscribe()
  }, [methods.watch])

  return (
    <FormProvider {...methods}>
      {Object.keys(contacts).map((email, a) => (
        <Contact.Wrapper
          key={a}
          email={email}
          preferences={contacts[email]}
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
