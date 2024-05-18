import { Text, XStack } from '@my/ui'
import { Contact } from 'app/features/email-tester/contact'
import { SimplifiedContactsByList } from 'app/types'

type ContactsProps = {
  contacts?: SimplifiedContactsByList
}

export const Contacts: React.FC<ContactsProps> = ({ contacts }) => {
  if (!contacts) {
    return (
      <XStack>
        <Text>This list is empty</Text>
      </XStack>
    )
  }
  console.log('contacts', contacts)
  return (
    <>
      {Object.keys(contacts).map((email, a) => (
        <Contact.Wrapper email={email} preferences={contacts[email]}></Contact.Wrapper>
      ))}
    </>
  )
}
