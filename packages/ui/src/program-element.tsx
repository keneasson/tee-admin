import React from 'react'
import { Paragraph, Text } from 'tamagui'

type ProgramElementProps = {
  label: string
  content: string
}
export const ProgramElement: React.FC<ProgramElementProps> = ({ label, content }) => {
  return (
    <Paragraph>
      <Text fontWeight="bold">{label}:</Text> {content}
    </Paragraph>
  )
}
