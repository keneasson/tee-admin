import { CheckboxWithCheck, Text, XStack } from '@my/ui'
import { EmailListTypeKeys, EmailListTypes } from '@my/app/types'
import { ConnectForm } from './contacts'
import { ContactPreferences } from '../../types'

type Contact = {
  email: string
  preferences?: ContactPreferences
  index: number
}
const Wrapper: React.FC<Contact> = ({ email, preferences, index }) => {
  return (
    <XStack
      key={email}
      justifyContent={'space-between'}
      backgroundColor={index % 2 ? '$color2' : 'white'}
    >
      <Text>{email}</Text>
      {preferences ? <Preferences email={email} preferences={preferences} index={index}></Preferences> : null}
    </XStack>
  )
}

type PreferencesProps = {
  email: string
  preferences: ContactPreferences
  index: number
}
const Preferences: React.FC<PreferencesProps> = ({ email, preferences, index }) => {
  return (
    <XStack gap={'$10'}>
      {(Object.keys(EmailListTypes) as EmailListTypeKeys[]).map((emailList, key: number) => {
        return (
          <ConnectForm key={`${index}.${key}`}>
            {({ register }: { register: any }) => (
              <CheckboxWithCheck
                {...register(`${index}.${emailList}`, {
                  value: !!preferences.preferences[emailList],
                })}
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
