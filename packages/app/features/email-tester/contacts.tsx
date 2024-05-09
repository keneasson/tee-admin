import { Text, YStack } from '@my/ui'
import { Contact } from 'app/features/email-tester/contact'
import { SimplifiedContactsByList } from 'app/types'

type ContactsProps = {
  contacts?: SimplifiedContactsByList
}

export const Contacts: React.FC<ContactsProps> = ({ contacts }) => {
  if (!contacts) {
    return (
      <YStack>
        <Text>This list is empty</Text>
      </YStack>
    )
  }
  return (
    <>
      {Object.keys(contacts).map((email, a) => (
        <YStack>
          <Contact.Wrapper
            EmailAddress={email}
            TopicPreferences={contacts[email]?.preferences}
            UnsubscribeAll={contacts[email]?.unsubscribed}
          ></Contact.Wrapper>
        </YStack>
      ))}
    </>
  )
}
