import React from 'react'
import { ChevronDown } from '@tamagui/lucide-icons'
import { Accordion, Anchor, Paragraph, Separator, Square, Text, YStack } from '@my/ui'

import { BibleClassType } from 'app/types'

type NextBibleClassProps = {
  event: BibleClassType
}
export const NextBibleClass: React.FC<NextBibleClassProps> = ({ event }) => {
  if (!event.Speaker) {
    return (
      <YStack
        borderTopColor={'$grey8Dark'}
        borderWidth={1}
        borderBottomColor={'$grey1Dark'}
        borderBottomWidth={2}
        marginBottom={'2rem'}
        padding={'1rem'}
      >
        <Paragraph size={'$5'} fontWeight={600}>
          {event.Date.toString()}
        </Paragraph>
        <Paragraph>{event.Topic}</Paragraph>
      </YStack>
    )
  }
  return (
    <YStack
      borderTopColor={'$grey8Dark'}
      borderWidth={1}
      borderBottomColor={'$grey1Dark'}
      borderBottomWidth={2}
      marginBottom={'2rem'}
      padding={'1rem'}
    >
      <Paragraph size={'$5'} fontWeight={600}>
        {event.Date.toString()}
      </Paragraph>
      <Paragraph size={'$5'} fontWeight={600}>
        Bible Class at 7:30pm
      </Paragraph>
      <Paragraph>
        <Text fontWeight={600}>Presiding:</Text> {event.Presider}
      </Paragraph>
      <Paragraph>
        <Text fontWeight={600}>Leader:</Text> {event.Speaker}
      </Paragraph>
      {/*<Paragraph><Text fontWeight={600}>Organist</Text> {event.Organist}</Paragraph>*/}
      {event.Topic && <Paragraph fontWeight={600}>{event.Topic}</Paragraph>}
      <Accordion overflow="hidden" type="multiple">
        <Accordion.Item value="a1">
          <Accordion.Trigger flexDirection="row" justifyContent="space-between">
            {({ open }) => (
              <>
                <Paragraph>Zoom Info - Click to open</Paragraph>
                <Square animation="quick" rotate={open ? '180deg' : '0deg'}>
                  <ChevronDown size="$1" />
                </Square>
              </>
            )}
          </Accordion.Trigger>
          <Accordion.Content>
            <Paragraph fontWeight={600}>Join Zoom Meeting</Paragraph>
            <Anchor
              href="https://us02web.zoom.us/j/932385033?pwd=R1VOR3NDOTk1cXN2ZzFOdW14SnhxZz09"
              target={'_blank'}
            >
              Click to Join Zoom
            </Anchor>
            <Paragraph>Meeting ID: 932 385 033</Paragraph>
            <Paragraph>Passcode: 456345</Paragraph>
            <Separator alignSelf="stretch" borderColor={'$borderColor'} />
            <Paragraph>One tap mobile</Paragraph>
            <Paragraph>
              <Anchor href="tel:+14388097799,,932385033#,,,,*456345#" target={'_blank'}>
                +14388097799,,932385033#,,,,*456345#
              </Anchor>{' '}
              Canada
            </Paragraph>
            <Paragraph>
              <Anchor href="tel:+15873281099,,932385033#,,,,*456345#" target={'_blank'}>
                +15873281099,,932385033#,,,,*456345#
              </Anchor>{' '}
              Canada
            </Paragraph>
            <Separator alignSelf="stretch" borderColor={'$borderColor'} />
            <Paragraph>
              Find your local number:{' '}
              <Anchor href="https://us02web.zoom.us/u/kbHWW6VEKW">
                https://us02web.zoom.us/u/kbHWW6VEKW
              </Anchor>
            </Paragraph>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </YStack>
  )
}
