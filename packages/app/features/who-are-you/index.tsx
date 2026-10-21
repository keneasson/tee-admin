'use client'

/**
 * "Are you A or B?" (R2). Shown after signing in through an address that more
 * than one person uses (a household's shared inbox). Platform-free: the Next
 * page loads the choices and performs the switch.
 */
import React from 'react'
import { Button, Heading, LoadingState, Paragraph, Text, YStack } from '@my/ui'
import { Check } from '@tamagui/lucide-icons'

export interface WhoAreYouChoice {
  personId: string
  name: string
  ecclesia: string
}

export interface WhoAreYouProps {
  address: string | null
  choices: WhoAreYouChoice[] | null
  current: string | null
  saving: string | null
  error: string | null
  onChoose: (personId: string) => void
}

export const WhoAreYou: React.FC<WhoAreYouProps> = ({ address, choices, current, saving, error, onChoose }) => {
  return (
    <YStack gap="$4" padding="$4" maxWidth={480} width="100%" alignSelf="center">
      <YStack gap="$2">
        <Heading size="$7">Who&apos;s signing in?</Heading>
        <Paragraph theme="alt2" style={{ overflowWrap: 'anywhere' }}>
          {address
            ? `More than one person uses ${address}. Choose yourself so you see your own profile and family.`
            : 'More than one person uses this address. Choose yourself.'}
        </Paragraph>
      </YStack>

      {choices === null ? <LoadingState label="people" inline /> : null}

      {choices
        ? choices.map((c) => (
            <Button
              key={c.personId}
              size="$5"
              justifyContent="flex-start"
              theme={c.personId === current ? 'blue' : undefined}
              icon={c.personId === current ? Check : undefined}
              disabled={saving !== null}
              onPress={() => onChoose(c.personId)}
            >
              <YStack alignItems="flex-start">
                <Text fontSize="$5" fontWeight="600">
                  {saving === c.personId ? 'Switching…' : c.name}
                </Text>
                {c.ecclesia ? (
                  <Text fontSize="$2" theme="alt2">
                    {c.ecclesia}
                  </Text>
                ) : null}
              </YStack>
            </Button>
          ))
        : null}

      {error ? (
        <Text fontSize="$3" color="$red10">
          {error}
        </Text>
      ) : null}
    </YStack>
  )
}
