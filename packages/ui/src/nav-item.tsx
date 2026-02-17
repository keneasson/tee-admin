import { styled, XStack } from 'tamagui'

export const NavHeading = styled(XStack, {
  borderBottomColor: '$borderColor',
  borderBottomWidth: 0,
  alignItems: 'center',
  padding: '$3',
  borderRadius: '$2',
  cursor: 'pointer',
})

export const NavItem = styled(NavHeading, {
  hoverStyle: { backgroundColor: '$backgroundHover' },
  pressStyle: { backgroundColor: '$backgroundPress' },
})
