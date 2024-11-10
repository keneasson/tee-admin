'use client'

import React, { useState } from 'react'
import { useSession } from 'next-auth/react'

import { Button, Heading, Paragraph, Text, YStack } from '@my/ui'

import { sendEmail } from '@my/app/provider/get-data'
import { Wrapper } from '@my/app/provider/wrapper'
import { Section } from '@my/app/features/newsletter/Section'
import { LogInUser } from '@my/app/provider/auth/log-in-user'
import { ManageContacts } from '@my/app/features/email-tester/manage-contacts'
import { emailReasons } from 'next-app/utils/email/email-send'

export const EmailTester: React.FC = () => {
  const { data: session } = useSession()

  const [email, setEmail] = useState<any>(null)

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

  const getEmail = async (reason: emailReasons) => {
    const response = await sendEmail(reason)
    setEmail(response)
  }

  return (
    <Wrapper>
      <Section space={'$4'}>
        <YStack>
          <YStack>
            <Heading size={5}>Get Emails</Heading>

            <Button onPress={() => getEmail('sunday-school')}>
              <Text>Sunday School Reminder</Text>
            </Button>
            <Button onPress={() => getEmail('recap')}>
              <Text>Memorial Reminder</Text>
            </Button>
            {email && <pre>{JSON.stringify(email, null, 2)}</pre>}
          </YStack>
          <ManageContacts />
        </YStack>
      </Section>
    </Wrapper>
  )
}
