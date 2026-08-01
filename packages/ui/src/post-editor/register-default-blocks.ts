import { registerBlock } from './registry'
import { FileText, Clock } from '@tamagui/lucide-icons'
import { TextBlockEditor, makeTextBlock } from './blocks/text-block-editor'
import { TimeBlockEditor, makeTimeBlock } from './blocks/time-block-editor'

/**
 * Register the reference block editors (the two hardest shapes: free-prose Text
 * and UTC-storing Time). Idempotent so it is safe to call from module scope in
 * the editor AND from tests. Remaining block editors (Person, Location, Flyer,
 * Registration, Link) are 2b — they register the same way with no editor changes.
 */
let registered = false

export function registerDefaultBlocks(): void {
  if (registered) return
  registered = true

  registerBlock('text', {
    label: 'Text',
    icon: FileText,
    make: makeTextBlock,
    Editor: TextBlockEditor,
  })

  registerBlock('time', {
    label: 'Date & time',
    icon: Clock,
    make: makeTimeBlock,
    Editor: TimeBlockEditor,
  })
}
