import React from 'react'
import { Anchor, ExtLink, Paragraph, Text, YStack, XStack } from '@my/ui'
import { MapPin, Video, Radio } from '@tamagui/lucide-icons'
import type { AttendOption } from '@my/app/types'

/**
 * "Ways to attend" list for a single service occurrence.
 *
 * Phase 2 of per-occurrence overrides: an occurrence can offer several
 * simultaneous access methods (e.g. a Toronto West live stream AND a Toronto
 * East Zoom). When present, this supersedes the hardcoded single-Zoom block.
 */
type AttendOptionsProps = {
  options?: AttendOption[]
}

export const AttendOptions: React.FC<AttendOptionsProps> = ({ options }) => {
  if (!options || options.length === 0) return null

  return (
    <YStack gap="$2" marginTop="$2">
      <Paragraph fontWeight={700}>Ways to attend:</Paragraph>
      {options.map((opt) => (
        <YStack
          key={opt.id}
          gap="$1"
          padding="$3"
          backgroundColor="$backgroundHover"
          borderRadius="$3"
          borderLeftWidth={4}
          borderLeftColor="$blue9"
        >
          <XStack gap="$2" alignItems="center">
            {opt.mode === 'in_person' ? <MapPin size={16} /> : null}
            {opt.mode === 'stream' ? <Radio size={16} /> : null}
            {opt.mode === 'online' ? <Video size={16} /> : null}
            <Paragraph fontWeight={700}>
              {opt.label}
              {opt.hostEcclesia ? ` — ${opt.hostEcclesia}` : ''}
            </Paragraph>
          </XStack>

          {opt.mode === 'in_person' ? (
            <YStack paddingLeft="$5" gap="$1">
              {opt.address ? <Paragraph>{opt.address}</Paragraph> : null}
              {opt.mapsUrl ? (
                <Anchor href={opt.mapsUrl} target="_blank">
                  <Text color="$blue10" fontWeight={600}>View on Google Maps</Text>
                </Anchor>
              ) : null}
            </YStack>
          ) : (
            <YStack paddingLeft="$5" gap="$1">
              {opt.url ? (
                <ExtLink href={opt.url}>
                  <Text color="$blue10" fontWeight={600}>
                    {opt.mode === 'stream' ? 'Watch the stream' : 'Join online'}
                  </Text>
                </ExtLink>
              ) : null}
              {opt.meetingId ? <Paragraph>Meeting ID: {opt.meetingId}</Paragraph> : null}
              {opt.password ? <Paragraph>Passcode: {opt.password}</Paragraph> : null}
              {opt.dialInNumber ? <Paragraph>Dial-in: {opt.dialInNumber}</Paragraph> : null}
            </YStack>
          )}
        </YStack>
      ))}
    </YStack>
  )
}
