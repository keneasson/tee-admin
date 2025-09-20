'use client'

import React, { useState } from 'react'
import { useSession } from 'next-auth/react'

import { Button, Checkbox, Heading, Paragraph, Text, XStack, YStack } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { Section } from '@my/app/features/newsletter/Section'
import { LogInUser } from '@my/app/provider/auth/log-in-user'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { ManageContacts } from './manage-contacts'
import { emailReasons } from 'next-app/utils/email/email-send'
import { Check } from '@tamagui/lucide-icons/icons/Check'
import { sendEmail } from '../../provider/get-data'
// import { setRole } from '../../provider/auth/setRole'

export const EmailTester: React.FC = () => {
  const { data: session } = useSession()

  const [email, setEmail] = useState<any>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [test, setTest] = useState<boolean>(false)
  const [buttonResponce, setButtonResponce] = useState<string>()

  // const handleButtonPress = async () => {
  //   try {
  //     const res = await setRole({ email: 'ken.easson@gmail.com' })
  //     console.log('res', res)
  //     setButtonResponce(JSON.stringify(res))
  //   } catch (error) {
  //     if (error instanceof Error) {
  //       console.log('handleButtonPress Error', error.message)
  //       setButtonResponce(error.message)
  //     } else {
  //       console.error('error', { error })
  //       setButtonResponce(error)
  //     }
  //   }
  // }

  const handleCheckTest = () => {
    setTest(!test)
  }

  if (!(session && session.user)) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Email management</Heading>
          <Paragraph>To access this section of our site, please sign in.</Paragraph>
          <LogInUser />
        </Section>
      </Wrapper>
    )
  }

  // Check if user has admin or owner role
  const userRole = session.user.role
  if (userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Access Denied</Heading>
          <Paragraph>You need admin or owner permissions to access the Email Tester.</Paragraph>
          <Paragraph>Current role: {userRole || 'None'}</Paragraph>
        </Section>
      </Wrapper>
    )
  }

  const getEmail = async (reason: emailReasons) => {
    console.log('getEmail - test', test)
    setReason(reason)
    const response = await sendEmail(reason, test)
    setEmail(response)
    setReason(null)
  }

  return (
    <Wrapper>
      <Section gap={'$4'}>
        <YStack>
          <YStack>
            <Heading size={5}>Get Emails</Heading>
            <XStack>
              {'Test Mode: '}
              <Checkbox
                onCheckedChange={handleCheckTest}
                checked={test}
                aria-label={'Check for Test Mode'}
              >
                <Checkbox.Indicator>
                  <Check />
                </Checkbox.Indicator>
              </Checkbox>
            </XStack>
            {reason ? (
              <YStack
                width={'100%'}
                height={'$20'}
                jc={'center'}
                ac={'center'}
                borderColor={'gray'}
                borderWidth={'$1.5'}
              >
                <Text textAlign={'center'}>{reason} is Sending</Text>
              </YStack>
            ) : (
              <YStack gap={'$size.2'} justifyContent={'space-evenly'} margin={'$size.2'}>
                <Button onPress={() => getEmail('newsletter')} size="$3">
                  <Text>Newsletter</Text>
                </Button>
                <Button onPress={() => getEmail('recap')} size="$3">
                  <Text>Memorial Info</Text>
                </Button>
                <Button onPress={() => getEmail('bible-class')} size="$3">
                  <Text>Bible Class Info</Text>
                </Button>
                <Button onPress={() => getEmail('sunday-school')} size="$3">
                  <Text>Sunday School Info</Text>
                </Button>
              </YStack>
            )}
            {email && (
              <YStack borderColor={'$green9'} borderWidth={'$1'} gap={'$2'}>
                <Button onPress={() => setEmail(null)}>
                  <Text>Hide Response</Text>
                </Button>
                <pre>{JSON.stringify(email, null, 2).replaceAll('/n', '<br />')}</pre>
              </YStack>
            )}
          </YStack>
          <ManageContacts />
          {/* <br />
          <Button onPress={() => handleButtonPress()}>
            <Text>Add Role for Ken Easson</Text>
          </Button> */}
          {buttonResponce && <Text>{buttonResponce}</Text>}
        </YStack>
      </Section>
    </Wrapper>
  )
}
