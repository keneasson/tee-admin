'use client'
import React from 'react'
import { Heading, Paragraph, ProgramElement, Section, Separator } from '@my/ui'
import { Wrapper } from 'app/provider/wrapper'
import { EventsFooter } from 'app/features/events/index'

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
        <Separator marginBottom={'2rem'} />
        <Paragraph size={'$5'} fontWeight={'bold'}>
          March 29-31, 2024
        </Paragraph>
        {/*<ProgramElement label={'Location'} content={'Fleming College in Peterborough, Ontario'} />*/}
        <ProgramElement label={'Dates'} content={'Friday March 29, 2024'} />
        <ProgramElement label={'Dates'} content={'Saturday March 30, 2024'} />{' '}
        <ProgramElement label={'Dates'} content={'Sunday March 31, 2024'} />
        <ProgramElement label={'Speaker'} content={'Bro. John Owen'} />
        <Paragraph>Details and Flyer coming soon.</Paragraph>
      </Section>
      <EventsFooter />
    </Wrapper>
  )
}
