import { CheckboxWithCheck, Text, XStack } from '@my/ui'
import { ContactsEmailPreferences, EmailListTypeKeys, EmailListTypes } from 'app/types'
import { ConnectForm } from './contacts'

type Contact = {
  key: number
  email: string
  preferences?: ContactsEmailPreferences
  index: number
}
const Wrapper: React.FC<Contact> = ({ key, email, preferences, index }) => {
  return (
    <XStack
      key={key}
      justifyContent={'space-between'}
      backgroundColor={index % 2 ? '$color2' : 'white'}
    >
      <Text>{email}</Text>
      {preferences && <Preferences email={email} preferences={preferences}></Preferences>}
    </XStack>
  )
}

type PreferencesProps = {
  email: string
  preferences: ContactsEmailPreferences
}
const Preferences: React.FC<PreferencesProps> = ({ email, preferences }) => {
  return (
    <XStack gap={'$10'}>
      {Object.keys(EmailListTypes).map((emailList: EmailListTypeKeys, index) => {
        return (
          <ConnectForm>
            {({ register }) => (
              <CheckboxWithCheck
                {...register(`${email}.${emailList}`, {
                  value: preferences[emailList] || false,
                })}
                rules={{ required: true }}
                size={'$5'}
              />
            )}
          </ConnectForm>
        )
      })}
    </XStack>
  )
}

export const Contact = {
  Wrapper,
  Preferences,
}
