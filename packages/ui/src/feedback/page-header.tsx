import type { ReactNode } from 'react'
import { XStack, Heading } from 'tamagui'

/**
 * The ONE admin page header: a title on the left, page actions on the right,
 * wrapping sanely on narrow screens (ADR 0003).
 */
export interface PageHeaderProps {
  title: string
  /** Right-aligned actions — save status, mode toggles, primary buttons. */
  actions?: ReactNode
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
      <Heading size="$7">{title}</Heading>
      {actions ? (
        <XStack alignItems="center" gap="$3">
          {actions}
        </XStack>
      ) : null}
    </XStack>
  )
}
