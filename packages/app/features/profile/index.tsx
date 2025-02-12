import { Section, YStack, Heading } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { useEffect, useState } from 'react'
import { getGoogleSheet } from '@my/app/provider/get-google-sheet'

type ProfileType = {}
export const Profile: React.FC<ProfileType> = ({}) => {
  const [directory, setDirectory] = useState()
  useEffect(() => {
    getGoogleSheet('directory').then(setDirectory)
  }, [])

  return (
    <Wrapper>
      <Section gap={'$4'}>
        <YStack>
          <YStack>
            <Heading size={5}>Profile</Heading>
            <pre>{JSON.stringify(directory)}</pre>
          </YStack>
        </YStack>
      </Section>
    </Wrapper>
  )
}
