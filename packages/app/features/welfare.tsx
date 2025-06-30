'use client'
import { Wrapper } from '@my/app/provider/wrapper'
import { Section } from '@my/app/features/newsletter/Section'
import { Heading, Paragraph } from '@my/ui'
import React from 'react'
import { useSession } from 'next-auth/react'
import { LogInUser } from '@my/app/provider/auth/log-in-user'

export const Welfare: React.FC = () => {
  const { data: session } = useSession()

  if (!(session && session.user)) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Welfare of Our Brothers and Sisters</Heading>
          <Paragraph>To access this section of our site, please sign in.</Paragraph>
          <LogInUser />
          <Paragraph></Paragraph>
        </Section>
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <Section space={'$4'}>
        <Heading size={5}>Welfare of Our Brothers and Sisters</Heading>

        <Paragraph>
          Information shared here is to help lift up and encourage one another. The information here
          is not public and should not be generally shared.
        </Paragraph>
      </Section>
    </Wrapper>
  )
}
