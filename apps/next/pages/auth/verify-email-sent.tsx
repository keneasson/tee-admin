import React from 'react'
import Link from 'next/link'

import {
  YStack,
  Text,
  Heading,
  Button,
  Paragraph,
} from '@my/ui'


export default function VerifyEmailSentPage() {
  return (
    
      <YStack maxWidth={500} margin="auto" padding="$4" gap="$4" alignItems="center">
        <Text fontSize="$10" color="$blue10">📧</Text>
        
        <Heading size="$6" textAlign="center">Check Your Email</Heading>
        
        <Paragraph theme="alt2" textAlign="center">
          We've sent a verification email to your inbox. Please click the link in the email 
          to verify your account and complete your registration.
        </Paragraph>

        <YStack gap="$3" alignItems="center" width="100%">
          <Paragraph fontSize="$3" theme="alt2" textAlign="center">
            Didn't receive the email? Check your spam folder or:
          </Paragraph>
          
          <Link href="/auth/resend-verification" passHref>
            <Button variant="outlined" size="$4">
              Resend Verification Email
            </Button>
          </Link>
          
          <Link href="/auth/signin" passHref>
            <Button theme="blue" size="$4">
              Back to Sign In
            </Button>
          </Link>
        </YStack>

        <YStack gap="$2" alignItems="center" paddingTop="$4">
          <Text fontSize="$3" theme="alt2" textAlign="center">
            The verification link will expire in 7 days.
          </Text>
        </YStack>
      </YStack>
    
  )
}