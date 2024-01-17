import React from 'react'
import { Anchor, styled } from 'tamagui'
import { color } from '@tamagui/themes'
import { ExternalLink } from '@tamagui/lucide-icons'

const StyledLink = styled(Anchor, {
  fontWeight: 600,
  color: color.blue11Light,
  target: '_blank',
})

type ExtLinkProps = {
  children: React.ReactNode
  href: string
}
export const ExtLink: React.FC<ExtLinkProps> = ({ href, children }) => {
  return (
    <StyledLink href={href}>
      {children} <ExternalLink size={14} />
    </StyledLink>
  )
}
