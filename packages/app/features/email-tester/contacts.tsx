import { YStack } from '@my/ui'
import { Contact, ContactProps } from 'app/features/email-tester/contact'

type ContactsProps = {
  contacts: ContactProps[]
}

export const Contacts: React.FC<ContactsProps> = ({ contacts }) => {
  return (
    <YStack>
      {contacts.map((contact) => (
        <YStack>
          <Contact.Wrapper contact={contact}></Contact.Wrapper>
        </YStack>
      ))}
    </YStack>
  )
}
