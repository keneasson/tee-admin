import { registerBlock } from './registry'
import { FileText, Clock, Users, MapPin, FileImage, ClipboardCheck, Link2 } from '@tamagui/lucide-icons'
import { TextBlockEditor, makeTextBlock } from './blocks/text-block-editor'
import { TimeBlockEditor, makeTimeBlock } from './blocks/time-block-editor'
import { PersonBlockEditor, makePersonBlock } from './blocks/person-block-editor'
import { LocationBlockEditor, makeLocationBlock } from './blocks/location-block-editor'
import { FlyerBlockEditor, makeFlyerBlock } from './blocks/flyer-block-editor'
import { RegistrationBlockEditor, makeRegistrationBlock } from './blocks/registration-block-editor'
import { LinkBlockEditor, makeLinkBlock } from './blocks/link-block-editor'

/**
 * Register all default block editors (Consolidated CMS Phase 2a + 2b).
 * Idempotent so it is safe to call from module scope in the editor AND from
 * tests. Registration order = toolbar order.
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

  registerBlock('person', {
    label: 'Person',
    icon: Users,
    make: makePersonBlock,
    Editor: PersonBlockEditor,
  })

  registerBlock('location', {
    label: 'Location',
    icon: MapPin,
    make: makeLocationBlock,
    Editor: LocationBlockEditor,
  })

  registerBlock('flyer', {
    label: 'Flyer',
    icon: FileImage,
    make: makeFlyerBlock,
    Editor: FlyerBlockEditor,
  })

  registerBlock('registration', {
    label: 'Registration',
    icon: ClipboardCheck,
    make: makeRegistrationBlock,
    Editor: RegistrationBlockEditor,
  })

  registerBlock('link', {
    label: 'Link',
    icon: Link2,
    make: makeLinkBlock,
    Editor: LinkBlockEditor,
  })
}
