'use client'
import { styled, XStack } from 'tamagui'

/**
 * Flex-based table layout primitives with CORRECT column alignment.
 *
 * The gotcha this solves: Tamagui's `flex={n}` sets only `flex-grow` and leaves
 * `flex-basis: auto`. So a plain `<XStack flex={n}>` "column" is sized to its
 * CONTENT and flex-grow only distributes the leftover space — a header cell and a
 * data cell with different content end up different widths, and the columns drift
 * out of alignment (a short header + a long value push the following columns
 * sideways). `TableCell` forces `flexBasis: 0` + `minWidth: 0` so every column is
 * proportional to its `flex` value (a real grid), and long content truncates
 * instead of widening the column.
 *
 * Usage — give the matching header and data cells the SAME `flex`:
 *   <TableRow>
 *     <TableCell flex={3}><Text numberOfLines={1}>{subject}</Text></TableCell>
 *     <TableCell flex={1} align="right"><Text>{count}</Text></TableCell>
 *   </TableRow>
 *
 * `TableCell` is a flex-row container, so it holds a single truncating `<Text>`,
 * badge `<XStack>`s, or a stacked `<YStack>` equally. Use the `align` variant to
 * position the cell's content (left / center / right) — pair `align="right"` on
 * both the header and data numeric columns.
 */
export const TableRow = styled(XStack, {
  alignItems: 'center',
  width: '100%',
})

export const TableCell = styled(XStack, {
  flexBasis: 0,
  minWidth: 0,
  flexShrink: 1,
  flexGrow: 1,
  alignItems: 'center',
  overflow: 'hidden',

  variants: {
    // `flex` maps to flex-GROW only. Tamagui's built-in `flex` prop would reset
    // flex-basis to `auto` (re-introducing the content-sizing bug), so we intercept
    // it here and keep flex-basis pinned at 0 — the whole point of the primitive.
    flex: {
      ':number': (n) => ({ flexGrow: n, flexBasis: 0 }),
    },
    align: {
      left: { justifyContent: 'flex-start' },
      center: { justifyContent: 'center' },
      right: { justifyContent: 'flex-end' },
    },
  } as const,

  defaultVariants: {
    align: 'left',
  },
})
