import { CheckboxWithCheck, Text, XStack } from '@my/ui'
import { ContactPreferences, EmailListTypeKeys, EmailListTypes } from 'app/types'
import { useEffect, useState } from 'react'

type Contact = {
  email: string
  preferences?: ContactPreferences
}
const Wrapper: React.FC<Contact> = ({ email, preferences }) => {
  console.log('preferences', preferences)
  return (
    <>
      <XStack justifyContent={'space-between'}>
        <Text>{email}</Text>
        {preferences && <Preferences email={email} preferences={preferences}></Preferences>}
      </XStack>
    </>
  )
}

type PreferencesProps = {
  email: string
  preferences: ContactPreferences
}
const Preferences: React.FC<PreferencesProps> = ({ email, preferences }) => {
  const [preference, setPreference] = useState<ContactPreferences>(preferences)

  const updateContact = (contactListKey: EmailListTypeKeys, optIn: boolean) => {
    setPreference({
      ...preference,
      [contactListKey]: optIn,
    })
  }

  useEffect(() => {
    console.log('preference', { preference })
  }, [])

  return (
    <>
      {Object.keys(EmailListTypes).map((emailList: EmailListTypeKeys, index) => {
        console.log('emailList', { emailList, isOptIn: preference[emailList] })
        return (
          <XStack key={index}>
            <CheckboxWithCheck
              checked={preference[emailList]}
              onCheckedChange={(checkedState: boolean) => {
                updateContact(emailList, checkedState)
              }}
              label={emailList}
              size={'$5'}
            />
          </XStack>
        )
      })}
    </>
  )
}

export const Contact = {
  Wrapper,
  Preferences,
}
