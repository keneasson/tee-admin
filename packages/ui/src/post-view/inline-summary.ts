/**
 * The one-line reading of a block, for when it sits INSIDE prose.
 *
 * An inline value must read as part of the sentence — "First class starts at
 * **11:00 AM** in the hall" — so it collapses to the shortest phrase that still
 * carries the meaning, rather than the full stacked panel a standalone block
 * renders.
 *
 * This is also the graceful-degradation text for any consumer that cannot render
 * widgets at all (plain-text email, a summary line): `flattenMarkers` takes this
 * as its renderer, so a marker never leaks `{{time:t1}}` into an email — it
 * becomes the words a reader expects.
 *
 * Pure + I/O-free, so both the web canvas and a plain-text mail body use it.
 */

import type { Block } from '@my/app/types/post'
import { formatPersonName, formatTimeBlock, personRoleLabel } from './post-view-format'

export function inlineSummary(block: Block): string {
  switch (block.kind) {
    case 'time': {
      if (block.display) return block.display
      const { dateLine, timeLine } = formatTimeBlock(block)
      return [dateLine, timeLine].filter(Boolean).join(', ')
    }
    case 'person': {
      const names = block.people.map(formatPersonName).filter(Boolean)
      if (names.length === 0) return personRoleLabel(block.role)
      if (names.length === 1) return names[0]
      // "A, B and C" — reads as prose, not as a list widget.
      return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    }
    case 'location': {
      return (
        block.venueName ||
        block.ecclesiaRef ||
        [block.city, block.province].filter(Boolean).join(', ') ||
        'the venue'
      )
    }
    case 'link':
      return block.label || block.url || ''
    case 'text':
      return block.body ?? ''
    case 'registration':
      return block.registrationUrl ? 'Register' : ''
    case 'flyer':
      return block.document?.originalName || ''
    default:
      return ''
  }
}
