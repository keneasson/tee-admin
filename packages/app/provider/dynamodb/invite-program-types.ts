import { SCHEDULE_TYPE_KEYS, type ScheduleTypeKey } from '../../config/schedule-fields'
import type { RegistryEntry } from '../schedule-sources/types'
import { isInvitableSpeaker, type SpeakerFacts } from '../../utils/speaker-eligibility'
import {
  INVITE_TYPE_LABEL,
  INVITE_TYPE_PHRASE,
  INVITE_TYPE_SLOT,
  SPEAKER_INVITE_TYPES,
  type SpeakerInviteType,
} from './speaker-invite-types'

/**
 * Invitation programs, configured per ecclesia (docs/SPEAKER_INVITATIONS.md §3a).
 *
 *   INVITE_PROGRAM#{ecclesiaId} / {programId}   → InviteProgram   (`tee-admin`)
 *
 * The core three keep reserved ids (`memorial | bible_class | lecture`). An
 * ecclesia with nothing stored gets them as built-in defaults computed here, so
 * nothing is written to start an ecclesia off. A stored program with a reserved
 * id replaces that default (reworded, switched off, relinked).
 *
 * Pure: shared by the API, the service and the screens.
 */

export type InviteWho = 'brethren' | 'sisters' | 'anyone'
export type InviteWhere = 'ecclesia' | 'region' | 'anywhere'

export const INVITE_WHO: readonly InviteWho[] = ['brethren', 'sisters', 'anyone']
export const INVITE_WHERE: readonly InviteWhere[] = ['ecclesia', 'region', 'anywhere']

export const INVITE_WHO_LABEL: Record<InviteWho, string> = {
  brethren: 'Brethren',
  sisters: 'Sisters',
  anyone: 'Anyone',
}

export const INVITE_WHERE_LABEL: Record<InviteWhere, string> = {
  ecclesia: 'Our ecclesia',
  region: 'Our region',
  anywhere: 'Anywhere',
}

/** A registered schedule (`RegistryEntry.scheduleId`) and one of its roster fields. */
export interface InviteProgramLink {
  scheduleId: string
  field: string
}

export interface InviteProgram {
  programId: string
  /** "Bible Class": the composer picker and lists. */
  name: string
  /** "speak at our Bible Class": "An invitation to {phrase}". */
  phrase: string
  /** Hand-written line shown after the opening line. Plain text. */
  about?: string
  who: InviteWho
  where: InviteWhere
  /** No link = the inviter types dates, and there are no swaps. */
  link?: InviteProgramLink
  /** Calendar entries. */
  lengthMinutes: number
  active: boolean
  order: number
  /** Computed default for a reserved id; never stored. */
  builtIn?: boolean
  updatedBy?: string
  updatedAt?: string
}

/** Where a linked program books: the schedule kind and the roster field. */
export interface ProgramSlot {
  scheduleType: ScheduleTypeKey
  field: string
}

/**
 * Copied onto an invite at send time. Editing a program later never rewrites
 * an invite already sent, nor moves its booking to another field.
 */
export interface ProgramSnapshot {
  name: string
  phrase: string
  about?: string
  lengthMinutes: number
  who: InviteWho
  /** Absent = an unlinked program (typed dates, no swaps). */
  slot?: ProgramSlot
}

export const RESERVED_PROGRAM_IDS: readonly SpeakerInviteType[] = SPEAKER_INVITE_TYPES

export function isReservedProgramId(id: string): id is SpeakerInviteType {
  return (RESERVED_PROGRAM_IDS as readonly string[]).includes(id)
}

/** Calendar length of the core three before programs existed (old invites keep it). */
export const LEGACY_LENGTH_MINUTES: Record<SpeakerInviteType, number> = {
  memorial: 90,
  bible_class: 90,
  lecture: 60,
}

const DEFAULT_LENGTH_MINUTES = 60

function isScheduleKind(v: string): v is ScheduleTypeKey {
  return (SCHEDULE_TYPE_KEYS as string[]).includes(v)
}

/** The built-in link of a reserved id: today's INVITE_TYPE_SLOT, as a registry link. */
export function builtInLink(id: SpeakerInviteType): InviteProgramLink | undefined {
  const slot = INVITE_TYPE_SLOT[id]
  return slot ? { scheduleId: slot.scheduleType, field: slot.field } : undefined
}

/**
 * The core three with today's wording and behaviour. `where: 'anywhere'`
 * because the picker has always searched every ecclesia.
 */
export function builtInPrograms(): InviteProgram[] {
  return RESERVED_PROGRAM_IDS.map((id, order) => {
    const link = builtInLink(id)
    return {
      programId: id,
      name: INVITE_TYPE_LABEL[id],
      phrase: INVITE_TYPE_PHRASE[id],
      who: 'brethren' as const,
      where: 'anywhere' as const,
      ...(link ? { link } : {}),
      lengthMinutes: LEGACY_LENGTH_MINUTES[id],
      active: true,
      order,
      builtIn: true,
    }
  })
}

export function builtInProgram(id: string): InviteProgram | null {
  return builtInPrograms().find((p) => p.programId === id) ?? null
}

/** Stored programs win; reserved ids with nothing stored get the built-in default. */
export function mergeWithBuiltIns(stored: InviteProgram[]): InviteProgram[] {
  const ids = new Set(stored.map((p) => p.programId))
  const merged: InviteProgram[] = [
    ...stored.map(({ builtIn: _never, ...p }) => p),
    ...builtInPrograms().filter((p) => !ids.has(p.programId)),
  ]
  return merged.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

/**
 * The slot a link books into. The registry entry (when given) names the kind;
 * this round `scheduleId` is the kind (docs/ECCLESIA_SCHEDULES.md), so a
 * built-in link resolves without a registry read.
 */
export function slotForLink(link: InviteProgramLink | undefined, registry?: RegistryEntry[]): ProgramSlot | null {
  if (!link) return null
  const entry = registry?.find((e) => e.scheduleId === link.scheduleId)
  const kind = entry?.kind ?? (isScheduleKind(link.scheduleId) ? link.scheduleId : null)
  return kind ? { scheduleType: kind, field: link.field } : null
}

export function snapshotOf(program: InviteProgram, registry?: RegistryEntry[]): ProgramSnapshot {
  const slot = slotForLink(program.link, registry)
  return {
    name: program.name,
    phrase: program.phrase,
    ...(program.about?.trim() ? { about: program.about.trim() } : {}),
    lengthMinutes: program.lengthMinutes,
    who: program.who,
    ...(slot ? { slot } : {}),
  }
}

interface InviteLike {
  type: string
  programSnapshot?: ProgramSnapshot
}

export interface InviteWording {
  name: string
  phrase: string
  about?: string
  lengthMinutes: number
}

/**
 * The wording an invite was sent with. Invites from before programs existed
 * carry no snapshot and read the fixed wording of their type.
 */
export function inviteWording(invite: InviteLike): InviteWording {
  const s = invite.programSnapshot
  if (s) {
    return { name: s.name, phrase: s.phrase, ...(s.about ? { about: s.about } : {}), lengthMinutes: s.lengthMinutes }
  }
  const core = isReservedProgramId(invite.type) ? invite.type : null
  return {
    name: core ? INVITE_TYPE_LABEL[core] : invite.type,
    phrase: core ? INVITE_TYPE_PHRASE[core] : invite.type,
    lengthMinutes: core ? LEGACY_LENGTH_MINUTES[core] : DEFAULT_LENGTH_MINUTES,
  }
}

/** Where an invite books: its snapshot's slot, else the fixed slot of its (core) type. */
export function inviteSlot(invite: InviteLike): ProgramSlot | null {
  if (invite.programSnapshot) return invite.programSnapshot.slot ?? null
  const fixed = isReservedProgramId(invite.type) ? INVITE_TYPE_SLOT[invite.type] : null
  return fixed ? { scheduleType: fixed.scheduleType as ScheduleTypeKey, field: fixed.field } : null
}

/** Who a program draws from: recorded facts only (§9b), never guessed. */
export function isEligibleFor(who: InviteWho, p: SpeakerFacts | null | undefined): boolean {
  if (!p) return false
  if (who === 'brethren') return isInvitableSpeaker(p)
  if (who === 'sisters') return p.gender === 'female' && p.baptized !== false
  return true
}

/** "Jonathan Whi": a first name plus the start of another word. Widening needs this much. */
export function isSpecificName(q: string): boolean {
  return /^\S+\s+\S+/.test(q.trim())
}

// ---------------------------------------------------------------------------
// Validation (PUT /api/speaker-invites/programs)
// ---------------------------------------------------------------------------

const PROGRAM_ID_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/
const LIMITS = { name: 60, phrase: 120, about: 300 }

/** Lowercase, dashes: "Sister Class" → "sister-class". */
export function programIdFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function plain(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
}

export type ProgramInputResult = { ok: true; program: InviteProgram } | { ok: false; error: string }

/** Read one program from a request body. Shape only; links are checked by `validatePrograms`. */
export function parseProgramInput(raw: unknown, order: number): ProgramInputResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Each program must be an object.' }
  const r = raw as Record<string, unknown>
  const name = plain(r.name)
  const phrase = plain(r.phrase)
  const about = plain(r.about)
  const programId = plain(r.programId) || programIdFromName(name)
  if (!PROGRAM_ID_RE.test(programId)) return { ok: false, error: `“${name || programId}” needs a name made of letters or numbers.` }
  if (!name || name.length > LIMITS.name) return { ok: false, error: `Each program needs a name (up to ${LIMITS.name} characters).` }
  if (!phrase || phrase.length > LIMITS.phrase) {
    return { ok: false, error: `“${name}” needs an invitation phrase (up to ${LIMITS.phrase} characters).` }
  }
  if (about.length > LIMITS.about) return { ok: false, error: `“${name}”: the about line is longer than ${LIMITS.about} characters.` }
  if (!INVITE_WHO.includes(r.who as InviteWho)) return { ok: false, error: `“${name}”: choose who it invites.` }
  if (!INVITE_WHERE.includes(r.where as InviteWhere)) return { ok: false, error: `“${name}”: choose where they may come from.` }
  const length = Number(r.lengthMinutes)
  if (!Number.isInteger(length) || length < 5 || length > 600) {
    return { ok: false, error: `“${name}”: the length must be between 5 and 600 minutes.` }
  }
  let link: InviteProgramLink | undefined
  if (r.link != null) {
    const l = r.link as Record<string, unknown>
    const scheduleId = plain(l?.scheduleId)
    const field = plain(l?.field)
    if (!scheduleId || !field) return { ok: false, error: `“${name}”: choose both a schedule and a roster field, or no schedule.` }
    link = { scheduleId, field }
  }
  return {
    ok: true,
    program: {
      programId,
      name,
      phrase,
      ...(about ? { about } : {}),
      who: r.who as InviteWho,
      where: r.where as InviteWhere,
      ...(link ? { link } : {}),
      lengthMinutes: length,
      active: r.active !== false,
      order,
    },
  }
}

const sameLink = (a?: InviteProgramLink, b?: InviteProgramLink) =>
  !!a && !!b && a.scheduleId === b.scheduleId && a.field === b.field

/**
 * The ecclesia's whole program list, as it would be saved.
 *  - ids are unique;
 *  - a link names one of THIS ecclesia's registered schedules (`registry` is
 *    the ecclesia's own) and one of its fields marked "names a person";
 *    a reserved id may keep its built-in link (today's behaviour), registered or not;
 *  - no two active programs book into the same schedule field.
 */
export function validatePrograms(programs: InviteProgram[], registry: RegistryEntry[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const p of programs) {
    if (ids.has(p.programId)) errors.push(`Two programs share the name “${p.name}”.`)
    ids.add(p.programId)
    if (!p.link) continue
    if (isReservedProgramId(p.programId) && sameLink(p.link, builtInLink(p.programId))) continue
    const entry = registry.find((e) => e.scheduleId === p.link!.scheduleId)
    if (!entry) {
      errors.push(`“${p.name}” is linked to a schedule this ecclesia hasn’t connected.`)
      continue
    }
    const field = entry.mapping.fields.find((f) => f.key === p.link!.field)
    if (!field || !field.rosterRole) {
      errors.push(`“${p.name}”: ${entry.name} has no roster field “${p.link.field}” that names a person.`)
    }
  }
  const active = programs.filter((p) => p.active && p.link)
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      if (sameLink(active[i].link, active[j].link)) {
        errors.push(`“${active[i].name}” and “${active[j].name}” both fill the same schedule field. Link one elsewhere or switch one off.`)
      }
    }
  }
  return errors
}

/** The roster fields a program may link to: every registered schedule's "names a person" fields. */
export interface LinkOption {
  scheduleId: string
  scheduleName: string
  field: string
  fieldLabel: string
}

export function linkOptions(registry: RegistryEntry[]): LinkOption[] {
  return registry.flatMap((e) =>
    e.mapping.fields
      .filter((f) => f.rosterRole)
      .map((f) => ({ scheduleId: e.scheduleId, scheduleName: e.name, field: f.key, fieldLabel: f.label }))
  )
}
