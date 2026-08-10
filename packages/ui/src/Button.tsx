'use client'

import { styled, Button as TamaguiButton } from 'tamagui'

/**
 * Custom Button with proper hover/press/focus states AND semantic, theme-correct
 * variants so callers never hand-roll `backgroundColor` again.
 *
 * Why this exists:
 * - Tamagui's default `hoverTheme: true` swaps ANY colored button's background to
 *   `$backgroundHover` (the page background) on hover, making it "disappear".
 * - A bare Tamagui button inherits a near-white themed fill, so on our light
 *   surfaces it renders white-on-white and looks like an input, not a button.
 *
 * The fix — drop in a variant, get a correct button in BOTH light and dark:
 *   <Button variant="action">Save</Button>       // primary CTA (brand navy → bright blue in dark)
 *   <Button variant="secondary">…</Button>        // gold, for a secondary emphasis
 *   <Button variant="danger">Delete</Button>      // destructive
 *   <Button variant="outlined">…</Button>         // quiet, bordered, transparent fill
 *   <Button>…</Button>                            // neutral: visible surface + border, never invisible
 *
 * Every colour is a brand semantic token (`$primary`, `$primaryForeground`, …) that
 * is already defined for both themes in packages/config/tee-themes.ts — so a variant
 * is automatically legible and on-brand in light and dark without per-call overrides.
 */
export const Button = styled(TamaguiButton, {
  // Disable Tamagui's automatic theme-switching on hover/press (the "disappearing" bug)
  hoverTheme: false,
  pressTheme: false,

  // Neutral default: a visible surface with a real border so a bare <Button> is
  // NEVER an invisible white-on-white box. Callers wanting a prominent CTA use
  // variant="action"; the props still win if a caller overrides explicitly.
  backgroundColor: '$backgroundStrong',
  borderColor: '$borderColor',
  borderWidth: 1,
  color: '$color',

  // Filled buttons darken via opacity (works regardless of the fill colour)
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
      // Primary call-to-action. THE "drop-in action button" — brand navy in light,
      // bright blue in dark, with the matching accessible foreground each way.
      action: {
        backgroundColor: '$primary',
        borderColor: '$primary',
        color: '$primaryForeground',
        hoverStyle: {
          opacity: 1,
          backgroundColor: '$primaryHover',
          borderColor: '$primaryHover',
        },
        pressStyle: {
          opacity: 1,
          backgroundColor: '$primaryPress',
          borderColor: '$primaryPress',
        },
      },

      // Secondary emphasis — brand gold.
      secondary: {
        backgroundColor: '$secondary',
        borderColor: '$secondary',
        color: '$secondaryForeground',
        hoverStyle: { opacity: 0.9 },
        pressStyle: { opacity: 0.8 },
      },

      // Destructive — brand error red.
      danger: {
        backgroundColor: '$error',
        borderColor: '$error',
        color: '$errorForeground',
        hoverStyle: { opacity: 0.9 },
        pressStyle: { opacity: 0.8 },
      },

      // Quiet, bordered choice — transparent fill, neutral border+text, subtle fill on hover.
      outlined: {
        backgroundColor: 'transparent',
        borderColor: '$borderColor',
        color: '$color',
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
