/**
 * Ecclesia offices for the Next.js app (R3, docs/legacy-people-retirement-plan.md §0).
 *
 * Every reader that needs "the Recording Brother of X" — reply-to, RB
 * notifications, nomination checks, the ecclesia pages — calls this module.
 * It reads the OFFICE items (`officeRepository`) and resolves each holder from
 * their PROFILE. Nothing reads a copied RB name/email on the ECCLESIA item,
 * except the one fenced pre-cutover fallback below.
 *
 * Pre-cutover fallback: an ecclesia with NO Recording Brother office item yet
 * falls back to the legacy copy (`legacyRecordingBrotherCopies`), but only
 * until the owner-confirmed assignments are applied (`OFFICES#META / ASSIGNED`).
 * Once an RB office exists for an ecclesia, even a vacant one, the office decides.
 */
import {
  OFFICE_ROLES,
  officeRepository,
  type OfficeView,
} from '@my/app/provider/dynamodb/repositories/office-repository'
import { ecclesiaIdOf } from '@my/app/provider/dynamodb/people-index'
import { legacyRecordingBrotherCopies, type EcclesiaData } from './dynamodb/locations'

export interface RecordingBrotherContact {
  /** The holder's person id, when the office has a holder. */
  personId?: string
  /** The holder's display name. Never stored on the office. */
  name?: string
  /** The office inbox, else the holder's primary address. */
  email?: string
  source: 'office' | 'legacy'
}

/** One office as an API/page shows it (holder by reference + resolved name). */
export interface OfficeSummary {
  officeId: string
  kind: string
  title: string
  email?: string
  phone?: string
  /** Where `email` came from: the office's own inbox, or its holder's primary address. */
  emailVia: 'office' | 'holder' | 'none'
  holderPersonId?: string
  holderName?: string
  holderSince?: string
}

const holderName = (view: OfficeView) =>
  view.holder?.displayName?.trim() ||
  [view.holder?.firstName, view.holder?.lastName].filter(Boolean).join(' ').trim() ||
  undefined

export function toOfficeSummary(view: OfficeView): OfficeSummary {
  return {
    officeId: view.office.role,
    kind: view.office.kind,
    title: view.office.title,
    email: view.email || undefined,
    phone: view.office.phone,
    emailVia: view.via,
    holderPersonId: view.office.holderPersonId,
    holderName: holderName(view),
    holderSince: view.office.holderSince,
  }
}

/** ecclesiaId → its offices (RB first, then Reps), one Query per ecclesia + one BatchGet of holders. */
export async function officesOf(ecclesias: EcclesiaData[]): Promise<Map<string, OfficeSummary[]>> {
  const views = await officeRepository.listOfficeViews(ecclesias.map((e) => ecclesiaIdOf(e)))
  return new Map([...views].map(([id, list]) => [id, list.map(toOfficeSummary)]))
}

/** ecclesiaId → its Recording Brother contact, or null when the office is vacant with no inbox. */
export async function recordingBrothersOf(
  ecclesias: EcclesiaData[]
): Promise<Map<string, RecordingBrotherContact | null>> {
  const views = await officeRepository.listOfficeViews(ecclesias.map((e) => ecclesiaIdOf(e)))
  const out = new Map<string, RecordingBrotherContact | null>()
  const withoutOffice: EcclesiaData[] = []
  for (const ecclesia of ecclesias) {
    const id = ecclesiaIdOf(ecclesia)
    const rb = (views.get(id) || []).find((v) => v.office.kind === OFFICE_ROLES.RECORDING_BROTHER)
    if (!rb) {
      withoutOffice.push(ecclesia)
      out.set(id, null)
      continue
    }
    out.set(
      id,
      rb.email || rb.holder
        ? { personId: rb.office.holderPersonId, name: holderName(rb), email: rb.email || undefined, source: 'office' }
        : null
    )
  }
  if (withoutOffice.length > 0 && !(await officeRepository.officesAssigned())) {
    const legacy = await legacyRecordingBrotherCopies(withoutOffice)
    for (const [id, copy] of legacy) out.set(id, { ...copy, source: 'legacy' })
  }
  return out
}

export async function recordingBrotherOf(ecclesia: EcclesiaData | null | undefined): Promise<RecordingBrotherContact | null> {
  if (!ecclesia) return null
  return (await recordingBrothersOf([ecclesia])).get(ecclesiaIdOf(ecclesia)) || null
}
