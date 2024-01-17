import { styled, XStack } from 'tamagui'

export const NavHeading = styled(XStack, {
  borderBottomColor: 'grey',
  borderBottomWidth: 1,
  alignContent: 'center',
  margin: 1,
  padding: 10,
  paddingTop: 15,
})

export const NavItem = styled(NavHeading, {
  hoverStyle: { backgroundColor: '#ccaa32' },
  pressStyle: { backgroundColor: '#ccaa32' },
})
