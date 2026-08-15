/**
 * Parity diff between the legacy SES recipient set and the in-house resolver
 * output for the SAME list. A pure set operation, extracted so it is unit-tested
 * without AWS/Dynamo and reused by the /api/admin/mailing-lists/parity route.
 *
 * DIAGNOSTIC ONLY — computing a diff sends and mutates nothing.
 */

export interface ParityDiff {
  /** addresses present in BOTH sets. */
  matched: number
  /** in SES (legacy topic) but NOT produced by the in-house resolver. */
  inSesNotInHouse: string[]
  /** produced by the in-house resolver but NOT in SES. */
  inHouseNotInSes: string[]
  sesTotal: number
  inHouseTotal: number
}

/**
 * Compare two email lists. Both sides are lowercased + de-duped before the diff,
 * so casing/duplication differences never register as a discrepancy.
 *
 * NOTE: until the prod backfill populates the registry, the in-house side is
 * empty and EVERY SES address shows up in `inSesNotInHouse` — that is expected,
 * not a bug.
 */
export function computeParityDiff(sesEmails: string[], inHouseEmails: string[]): ParityDiff {
  const ses = new Set(sesEmails.map((e) => e.toLowerCase()))
  const inHouse = new Set(inHouseEmails.map((e) => e.toLowerCase()))

  const matched = [...ses].filter((e) => inHouse.has(e)).length
  const inSesNotInHouse = [...ses].filter((e) => !inHouse.has(e)).sort()
  const inHouseNotInSes = [...inHouse].filter((e) => !ses.has(e)).sort()

  return {
    matched,
    inSesNotInHouse,
    inHouseNotInSes,
    sesTotal: ses.size,
    inHouseTotal: inHouse.size,
  }
}
