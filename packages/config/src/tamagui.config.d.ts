import { config } from './tamagui.config'

export type Conf = typeof config

// Font size token type from Inter font
type FontSizeTokens =
  | '$1' | '$2' | '$3' | '$4' | '$5' | '$6' | '$7' | '$8'
  | '$9' | '$10' | '$11' | '$12' | '$13' | '$14' | '$15' | '$16'
  | '$true'

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {}

  // Override GetThemeValueForKey to include font size tokens
  interface ThemeValueFallbackFontSize {
    fontSize: FontSizeTokens | number | 'unset'
  }
}
