'use client'
import React from 'react'
import {
  DownloadButton,
  ExtLink,
  Heading,
  Paragraph,
  ProgramElement,
  Section,
  Separator,
  Text,
} from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { EventsFooter } from '@my/app/features/events/index'

export const TorontoFraternal2024: React.FC = () => {
  return (
    <Wrapper subHheader={'Toronto Fraternal Gathering'}>
      <Section
        borderTopColor={'$grey8Dark'}
        borderWidth={1}
        borderBottomColor={'$grey1Dark'}
        borderBottomWidth={2}
        marginBottom={'2rem'}
        padding={'1rem'}
      >
        {' '}
        <Heading size={5}>Toronto Annual Fraternal Gathering - 2024</Heading>
        <Paragraph size={'$5'} fontWeight={'600'}>
          Leaving Babylon with the Exiles
        </Paragraph>
        <Separator marginBottom={'2rem'} />
        <Paragraph size={'$5'} fontWeight={'bold'}>
          March 29-31, 2024
        </Paragraph>
        <DownloadButton href="/pdf/2024-Toronto-Fraternal.pdf">Download Flyer</DownloadButton>
        <ExtLink href="https://sites.google.com/view/torontofraternalgathering/home">
          Gathering Website
        </ExtLink>
        <Paragraph>
          If you plan to attend in person{' '}
          <ExtLink href="https://sites.google.com/view/torontofraternalgathering/registration">
            Please register
          </ExtLink>
        </Paragraph>
        <Paragraph size={'$5'} fontWeight={600} paddingTop={'1rem'}>
          Friday March 29 - Afternoon
        </Paragraph>
        <ProgramElement label={'Location'} content={'Anapilis Hall, Mississauga'} />
        <Paragraph>
          1:30 <Text fontWeight={600}>Leaving Babylon</Text>{' '}
        </Paragraph>
        <Paragraph>
          5:45 <Text fontWeight={600}>Roast Beef Dinner</Text>{' '}
        </Paragraph>
        <Paragraph>
          6:30 <Text fontWeight={600}>Choral Presentation</Text>{' '}
        </Paragraph>
        <Paragraph>
          7:00 - 11:00{' '}
          <Text fontWeight={600}>
            Various Activities{' '}
            <ExtLink href={'https://sites.google.com/view/torontofraternalgathering/schedule'}>
              (see Schedule)
            </ExtLink>
          </Text>{' '}
        </Paragraph>
        <Separator />
        <Paragraph size={'$5'} fontWeight={600} paddingTop={'1rem'}>
          Saturday March 30 - Afternoon
        </Paragraph>
        <ProgramElement label={'Location'} content={'UNIFOR / GALAXY 707'} />
        <Paragraph size={'$5'} fontWeight={600}>
          Young People's Theme: The Song of Moses - Deuteronomy 32
        </Paragraph>
        <Paragraph>
          2:00 <Text fontWeight={600}>Provoking God</Text>{' '}
        </Paragraph>
        <Paragraph>
          3:15 <Text fontWeight={600}>Yahweh - The Rock</Text>{' '}
        </Paragraph>
        <Paragraph size={'$5'} fontWeight={600} paddingTop={'.75rem'}>
          4:30 All Ages Arrival
        </Paragraph>
        <Paragraph>
          4:45 <Text fontWeight={600}>All Ages Greek Dinner</Text>{' '}
        </Paragraph>
        <Paragraph>
          6:30 <Text fontWeight={600}>The LORD hath done great things</Text>{' '}
        </Paragraph>
        <Paragraph>
          6:30 <Text fontWeight={400}>Children's Gym Activities @ Dash Sports</Text>{' '}
        </Paragraph>
        <Paragraph>
          8:00 - 10:00 <Text fontWeight={400}>Children's Gym Activities @ Dash Sports</Text>{' '}
        </Paragraph>
        <Separator />
        <Paragraph size={'$5'} fontWeight={600} paddingTop={'1rem'}>
          Sunday March 31 - Morning
        </Paragraph>
        <ProgramElement label={'Location'} content={'UNIFOR / GALAXY 707'} />
        <Paragraph>
          11:00am <Text fontWeight={600}>Memorial Service - Behold the Man</Text>{' '}
        </Paragraph>
      </Section>
      <EventsFooter />
    </Wrapper>
  )
}
