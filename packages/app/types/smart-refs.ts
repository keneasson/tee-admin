/**
 * Smart references (plan §0 R6, ADR-0006 §7, ADR-0005).
 *
 * A post stores a REFERENCE — a person id or an ecclesia id — never a copy of
 * that person's email/phone or that ecclesia's address. At render the server
 * resolves every reference in one batch and shapes each one for the viewer:
 * the floor (always safe) plus whatever this viewer may see, and, for every
 * field it withheld, WHY, so the view can offer the right action (ADR-0005
 * contract rule 5). A withheld value never reaches the client.
 *
 * Shared by `POST /api/smart-refs` and the server-side post render; the editor
 * widgets (CMS #221 / #263 / #256) render from these shapes.
 */

export type SmartRefType = 'person' | 'ecclesia'

export interface SmartRef {
  type: SmartRefType
  id: string
}

/**
 * Why a field was withheld from this viewer (ADR-0005 rule 5):
 *  - `sign-in`: assurance gap — we do not know who the reader is.
 *  - `scope`:   we know who they are, but the person's privacy does not reach
 *               them (e.g. another ecclesia). Escalation is "request access"
 *               (#256, future); `canRequestContact` says whether it is open.
 * A field nothing could reveal (e.g. a deceased person's contact) is simply
 * absent and not listed — it is not "withheld from you".
 */
export type SmartWithheldReason = 'sign-in' | 'scope'

export type SmartPersonField = 'lastName' | 'email' | 'phone'
export type SmartOfficeField = 'email' | 'phone' | 'postalAddress'
export type SmartEcclesiaField = 'address' | 'postalCode'

export interface SmartWithheld<F extends string> {
  field: F
  reason: SmartWithheldReason
}

/** A person, shaped for one viewer. `firstName` is the floor and is always present. */
export interface SmartPerson {
  type: 'person'
  /**
   * The person id. Present for a top-level reference (the caller sent it). For
   * an office holder it is carried only to an identified viewer, like every
   * other directory linkage (`redact-post.ts`).
   */
  id?: string
  found: true
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  withheld: Array<SmartWithheld<SmartPersonField>>
  /** Whether the person accepts contact requests (the `scope` escalation). Only sent when something was withheld for scope. */
  canRequestContact?: boolean
}

export interface SmartOfficePostalAddress {
  street1: string
  street2?: string
  city: string
  province: string
  postalCode: string
  country?: string
}

/** An ecclesia office (Recording Brother, a Rep, Treasurer, …): its own channels plus its holder. */
export interface SmartOffice {
  /** The office id within its ecclesia (`OFFICE#<officeId>`), e.g. `rb`, `rep#2`, `treasurer`. */
  officeId: string
  /** `rb`, `rep`, or another office kind slug. */
  kind: string
  title: string
  email?: string
  phone?: string
  postalAddress?: SmartOfficePostalAddress
  withheld: Array<SmartWithheld<SmartOfficeField>>
  /** The current holder, through the same person tiers. `null` when the office is vacant (or the holder's card is missing). */
  holder: SmartPerson | null
}

export interface SmartEcclesiaLocation {
  venue?: string
  city?: string
  province?: string
  country?: string
  /** location-precise: identified viewers only. */
  address?: string
  postalCode?: string
}

/** An ecclesia, shaped for one viewer. Name, city and offices' titles are the floor. */
export interface SmartEcclesia {
  type: 'ecclesia'
  id: string
  found: true
  name: string
  location: SmartEcclesiaLocation
  website?: string
  timezone?: string
  /** Recording Brother first, then Reps by slot, then any other office. */
  offices: SmartOffice[]
  withheld: Array<SmartWithheld<SmartEcclesiaField>>
}

export interface SmartNotFound {
  type: SmartRefType
  id: string
  found: false
}

export type SmartRefResult = SmartPerson | SmartEcclesia | SmartNotFound

/** Most references one request may resolve (one BatchGetItem holds 100 keys). */
export const MAX_SMART_REFS = 50
