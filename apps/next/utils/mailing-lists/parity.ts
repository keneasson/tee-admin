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

export interface ListParity {
  listId: string
  sesTopic: string
  diff: ParityDiff
  resolverStats: Record<string, number>
}

export interface ListParityDeps {
  /** What today's SES-topic send would mail (explicit OPT_IN − UnsubscribeAll). */
  sesRecipients: (topic: string) => Promise<string[]>
  /** What the registry send would mail for this list, or null if it cannot resolve. */
  registryRecipients: (
    listId: string
  ) => Promise<{ emails: string[]; stats: Record<string, number> }>
}

/**
 * Parity for one bridged list: the SES send audience vs the registry send
 * audience, each computed by the SAME filters its send path applies. Sends and
 * mutates nothing.
 */
export async function runListParity(
  list: { listId: string; sesTopic?: string },
  deps?: ListParityDeps
): Promise<ListParity> {
  if (!list.sesTopic) throw new Error(`List ${list.listId} has no SES topic; parity needs one`)
  const d = deps ?? (await defaultListParityDeps())
  const [ses, registry] = await Promise.all([
    d.sesRecipients(list.sesTopic),
    d.registryRecipients(list.listId),
  ])
  return {
    listId: list.listId,
    sesTopic: list.sesTopic,
    diff: computeParityDiff(ses, registry.emails),
    resolverStats: registry.stats,
  }
}

async function defaultListParityDeps(): Promise<ListParityDeps> {
  const [{ getSesTopicRecipients, getSesUnsubscribedAll, applyUnsubscribeAll }, { resolveListRecipients }] =
    await Promise.all([import('./registry-send'), import('../email/resolve-list-recipients')])
  return {
    sesRecipients: getSesTopicRecipients,
    registryRecipients: async (listId) => {
      const [resolved, unsubscribedAll] = await Promise.all([
        resolveListRecipients(listId),
        getSesUnsubscribedAll(),
      ])
      const { emails, removed } = applyUnsubscribeAll(resolved, unsubscribedAll)
      return { emails, stats: { ...resolved.stats, unsubscribedAllRemoved: removed } }
    },
  }
}
