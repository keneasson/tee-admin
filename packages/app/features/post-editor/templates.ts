/**
 * Post templates — a SCAFFOLD, not a lock (Consolidated CMS Phase 2R-1d).
 *
 * A template is a warm start: "Use Template → Obituary" drops a set of clearly-
 * annotated, movable PLACEHOLDER structures into the document. The instant it is
 * applied it is just your open document again — ordinary prose plus structured
 * blocks you can edit, reorder, copy, or delete. Nothing is locked; the template
 * only decides what lands and how it is labelled. This is deliberately the
 * composable-widgets philosophy (not rigid forms): recurring shapes like an
 * obituary have a "typical" layout, so we seed that layout while keeping the
 * canvas fully free-form. (Obituaries in particular have historically been
 * abused; gentle, labelled structure guides without constraining.)
 *
 * PURE (types + `genId`-based factories, no React/Tamagui) so it is unit-testable
 * and shared by the picker UI and any future in-toolbar entry point. Every block
 * it emits is intentionally EMPTY except for its `label`, so the document renders
 * them as faint, annotated placeholders (see BlockWidget's PlaceholderChip) until
 * the author fills them in.
 */

import type {
  Block,
  FlyerBlock,
  LocationBlock,
  PersonBlock,
  TextBlock,
  TimeBlock,
} from '@my/app/types/post'
import { genId } from '@my/ui/src/post-editor/post-reducer'

// ---- Block factories (empty-but-labelled → placeholders) --------------------

function heading(text: string): TextBlock {
  return { id: genId(), kind: 'text', body: `## ${text}`, containsPii: false }
}

function prompt(text: string): TextBlock {
  // A faint italic prose prompt the author overwrites (markdown italic).
  return { id: genId(), kind: 'text', body: `_${text}_`, containsPii: false }
}

function emptyTime(label: string): TimeBlock {
  return { id: genId(), kind: 'time', label }
}

function emptyLocation(label: string): LocationBlock {
  return { id: genId(), kind: 'location', mode: 'plain', label }
}

function emptyPerson(role: PersonBlock['role']): PersonBlock {
  // Empty `people` ⇒ placeholder; the role drives the placeholder annotation.
  return { id: genId(), kind: 'person', role, people: [] }
}

function emptyFlyer(): FlyerBlock {
  return {
    id: genId(),
    kind: 'flyer',
    document: {
      id: genId(),
      documentType: 'upload',
      fileName: '',
      originalName: '',
      fileUrl: '',
      fileSize: 0,
      mimeType: '',
      uploadedAt: new Date(0),
      uploadedBy: '',
    },
  }
}

// ---- Template model ---------------------------------------------------------

/** A toggleable, self-contained section of a template (e.g. "Visitation"). */
export interface TemplateSection {
  key: string
  label: string
  /** Checked by default when the template opens. */
  defaultOn: boolean
  /** Short line describing what the section adds (shown next to the checkbox). */
  hint: string
  /** The blocks this section drops in, in order. */
  build: () => Block[]
}

export interface TemplateDef {
  id: string
  label: string
  description: string
  /** Always-present blocks (the template's spine). */
  buildCore: () => Block[]
  /** Optional sections the author toggles before applying. */
  sections: TemplateSection[]
}

/**
 * Apply a template: core spine + every enabled section, in template order. The
 * result is a fresh, flat `Block[]` — the document seed. No template identity is
 * persisted; from here it is just an open document.
 */
export function applyTemplate(template: TemplateDef, enabledKeys: string[]): Block[] {
  const enabled = new Set(enabledKeys)
  return [
    ...template.buildCore(),
    ...template.sections.filter((s) => enabled.has(s.key)).flatMap((s) => s.build()),
  ]
}

// ---- The Obituary template --------------------------------------------------

/** A memorial "service" section: heading + date/time + location + who-it's-for. */
function serviceSection(key: string, label: string, hint: string, whoFor: string): TemplateSection {
  return {
    key,
    label,
    defaultOn: key === 'visitation' || key === 'memorial',
    hint,
    build: () => [
      heading(label),
      emptyTime(label),
      emptyLocation(label),
      prompt(whoFor),
    ],
  }
}

export const OBITUARY_TEMPLATE: TemplateDef = {
  id: 'obituary',
  label: 'Obituary',
  description:
    'A memorial announcement: a portrait, who we are remembering, a few words, and the ' +
    'service details you choose to include. Every part is a movable placeholder — fill in ' +
    'what applies, delete what does not.',
  buildCore: () => [
    emptyFlyer(),
    emptyPerson('deceased'),
    prompt('Share a few words in memory — their life, faith, and family.'),
  ],
  sections: [
    serviceSection('visitation', 'Visitation', 'Date, time & location of the visitation', 'Who is this for? (e.g. open to all)'),
    serviceSection('memorial', 'Memorial Service', 'Date, time & location of the memorial service', 'Who is this for? (e.g. open to all)'),
    serviceSection('celebration', 'Celebration of Life', 'Date, time & location of the celebration of life', 'Who is this for? (e.g. open to all)'),
    serviceSection('graveside', 'Graveside Service', 'Date, time & location of the graveside service', 'Who is this for? (often family only)'),
  ],
}

/** Registry of available templates (one for now; the picker iterates this). */
export const TEMPLATES: TemplateDef[] = [OBITUARY_TEMPLATE]
