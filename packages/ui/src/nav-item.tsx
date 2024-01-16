import { styled, XStack } from 'tamagui'

export const NavItem = styled(XStack, {
  borderBottomColor: 'grey',
  borderBottomWidth: 1,
  alignContent: 'center',
  margin: 5,
  padding: 10,
  paddingTop: 15,
  hoverStyle: { backgroundColor: '#ccaa32' },
  pressStyle: { backgroundColor: '#ccaa32' },
})
