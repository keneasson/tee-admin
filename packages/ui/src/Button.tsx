'use client'

import { styled, Button as TamaguiButton } from 'tamagui'

/**
 * Custom Button with proper hover/press/focus states.
 *
 * Fixes: Tamagui's default `hoverTheme: true` switches ANY colored button's
 * background to `$backgroundHover` (the page background), making it "disappear".
 *
 * This override:
 * - Disables hoverTheme/pressTheme to prevent the background swap
 * - Uses opacity for filled buttons (works with any background color)
 * - Adds a visible background fill for outlined buttons on hover
 * - Adds a focus ring for keyboard accessibility
 */
export const Button = styled(TamaguiButton, {
  // Disable Tamagui's automatic theme-switching on hover/press
  hoverTheme: false,
  pressTheme: false,

  // Filled button: darken via opacity
  hoverStyle: {
    opacity: 0.85,
  },
  pressStyle: {
    opacity: 0.7,
  },
  focusVisibleStyle: {
    outlineColor: '$primary',
    outlineStyle: 'solid',
    outlineWidth: 2,
    outlineOffset: 2,
  },

  variants: {
    variant: {
      outlined: {
        // Outlined button: show a subtle fill on hover instead of opacity
        hoverStyle: {
          opacity: 1,
          backgroundColor: '$backgroundHover',
          borderColor: '$borderColorFocus',
        },
        pressStyle: {
          opacity: 1,
          backgroundColor: '$backgroundPress',
          borderColor: '$borderColorFocus',
        },
      },
    },
  } as const,
})
