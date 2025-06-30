import React from 'react'
import { ChevronDown } from '@tamagui/lucide-icons/icons/ChevronDown'
import { Accordion, ExtLink, Paragraph, Separator, Square, Text } from '@my/ui'

import { BibleClassType } from '@my/app/types'
import { Section } from '@my/app/features/newsletter/Section'

type NextBibleClassProps = {
  event: BibleClassType
}
export const NextBibleClass: React.FC<NextBibleClassProps> = ({ event }) => {
  if (!event.Speaker) {
    return (
      <Section>
        <Paragraph size={'$5'} fontWeight={600}>
          {event.Date.toString()}
        </Paragraph>
        <Paragraph>{event.Topic}</Paragraph>
      </Section>
    )
  }
  return (
    <Section>
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
            <ExtLink href="https://us02web.zoom.us/j/932385033?pwd=R1VOR3NDOTk1cXN2ZzFOdW14SnhxZz09">
              Click to Join Zoom
            </ExtLink>
            <Paragraph>Meeting ID: 932 385 033</Paragraph>
            <Paragraph>Passcode: 456345</Paragraph>
            <Separator alignSelf="stretch" borderColor={'$borderColor'} />
            <Paragraph>One tap mobile</Paragraph>
            <Paragraph>
              <ExtLink href="tel:+14388097799,,932385033#,,,,*456345#">
                +14388097799,,932385033#,,,,*456345#
              </ExtLink>{' '}
              Canada
            </Paragraph>
            <Paragraph>
              <ExtLink href="tel:+15873281099,,932385033#,,,,*456345#">
                +15873281099,,932385033#,,,,*456345#
              </ExtLink>{' '}
              Canada
            </Paragraph>
            <Separator alignSelf="stretch" borderColor={'$borderColor'} />
            <Paragraph>
              Find your local number:{' '}
              <ExtLink href="https://us02web.zoom.us/u/kbHWW6VEKW">
                https://us02web.zoom.us/u/kbHWW6VEKW
              </ExtLink>
            </Paragraph>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </Section>
  )
}
