import { Section, Text, XStack, YStack, Heading } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { useEffect, useState } from 'react'
import { getUserFromLegacyDirectory } from '@my/app/provider/auth/get-user-from-legacy'
import { DirectoryType } from '@my/app/types'

type ProfileType = {}
export const Profile: React.FC<ProfileType> = ({}) => {
  const [user, setUser] = useState<DirectoryType>()
  useEffect(() => {
    async function getUser() {
      const user = await getUserFromLegacyDirectory({ email: 'ken.easson@gmail.com' })
      console.log('get user', user)
      setUser(user)
    }
    getUser()
  }, [])

  return (
    <Wrapper>
      <Section gap={'$4'}>
        <YStack>
          <YStack>
            <Heading size={5}>Profile</Heading>
            {user &&
              Object.keys(user).map((key) => {
                return (
                  <XStack>
                    <Text>{key}: </Text>
                    <Text>{user[key]}</Text>
                  </XStack>
                )
              })}
          </YStack>
        </YStack>
      </Section>
    </Wrapper>
  )
}
