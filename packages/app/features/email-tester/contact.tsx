import { Header, Text, XStack } from '@my/ui'
import { Contact as SESContact } from '@aws-sdk/client-sesv2'

const Wrapper: React.FC<SESContact> = ({ EmailAddress, TopicPreferences, UnsubscribeAll }) => {
  return (
    <XStack>
      <Header>
        <Text>{EmailAddress}</Text>
      </Header>
      {/*{UnsubscribeAll ? (*/}
      {/*  <Text>Unsubscribed</Text>*/}
      {/*) : (*/}
      {/*  // <Preferences EmailAddress={EmailAddress} TopicPreferences={TopicPreferences}></Preferences>*/}
      {/*)}*/}
    </XStack>
  )
}
//
// const Preferences: React.FC<Omit<ContactPreferencesProps, 'UnsubscribeAll'>> = ({
//   EmailAddress,
//   TopicPreferences,
// }) => {
//   const [preference, setPreference] = useState<ContactPrefPreferences>(TopicPreferences)
//
//   const updateContact = (contactListKey: EmailListTypeKeys, optin: boolean) => {
//     setPreference({
//       ...preference,
//       [contactListKey]: optin,
//     })
//   }
//
//   useEffect(() => {
//     console.log('TopicPreferences', { TopicPreferences, EmailListTypes })
//   }, [])
//
//   return (
//     <YStack>
//       {Object.keys(EmailListTypes).map((emailList: EmailListTypeKeys, index) => (
//         <XStack key={index}>
//           <Checkbox
//             checked={preference[emailList]}
//             onCheckedChange={(checkedState: boolean) => {
//               updateContact(emailList, checkedState)
//             }}
//           />
//         </XStack>
//       ))}
//     </YStack>
//   )
// }

export const Contact = {
  Wrapper,
  // Preferences,
}
