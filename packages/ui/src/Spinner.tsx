import { Spinner as TamaguiSpinner, SpinnerProps as TamaguiSpinnerProps } from 'tamagui'

export interface SpinnerProps extends Omit<TamaguiSpinnerProps, 'size'> {
  size?: 'small' | 'large' | number
}

/**
 * Custom Spinner with sensible size defaults.
 * - small: 14px (default)
 * - large: 14px (capped to prevent jarring large spinners)
 * - number: capped at 20px max
 */
export function Spinner({ size = 'small', ...props }: SpinnerProps) {
  // Convert size to a reasonable pixel value
  let pixelSize: number

  if (typeof size === 'number') {
    // Cap numeric sizes at 20px
    pixelSize = Math.min(size, 20)
  } else if (size === 'large') {
    // "large" is still kept small - 14px
    pixelSize = 14
  } else {
    // "small" default - 14px
    pixelSize = 14
  }

  return <TamaguiSpinner size={pixelSize} {...props} />
}
