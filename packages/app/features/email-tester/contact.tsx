import { Checkbox, Header, XStack, YStack } from '@my/ui'
import {
  ContactPreferencesProps,
  ContactPrefPreferences,
  EmailListTypeKeys,
  EmailListTypes,
} from 'app/types'
import { useState } from 'react'

const Wrapper: React.FC<ContactPreferencesProps> = ({ email, preferences }) => {
  return (
    <XStack>
      <Header>{email}</Header>
      <Preferences email={email} preferences={preferences} />
    </XStack>
  )
}

const Preferences: React.FC<ContactPreferencesProps> = ({ email, preferences }) => {
  const [preference, setPreference] = useState<ContactPrefPreferences>(preferences)
  const updateContact = (contactListKey: EmailListTypeKeys, optin: boolean) => {
    setPreference({
      ...preference,
      [contactListKey]: optin,
    })
  }
  return (
    <YStack key={email}>
      {Object.keys(EmailListTypes).map((emailList: EmailListTypeKeys) => (
        <XStack>
          <Checkbox
            checked={preference[emailList]}
            onCheckedChange={(checkedState: boolean) => {
              updateContact(emailList, checkedState)
            }}
          />
        </XStack>
      ))}
    </YStack>
  )
}

export const Contact = {
  Wrapper,
  Preferences,
}
