#!/usr/bin/env tsx
/**
 * Mailing-list operator commands (R5). Prints counts and person ids only —
 * never an address.
 *
 *   parity  [--topic <sesTopic>]
 *     For every bridged list (or one), compare what today's SES-topic send
 *     would mail with what the registry send would mail. Read-only.
 *
 *   cutover --topic <sesTopic> --to registry|ses [--apply]
 *     Flip one list's `sendFromRegistry`. Dry run unless --apply.
 *     --to registry refuses unless parity is EMPTY on both sides, and refuses
 *     Wednesday–Saturday (America/Toronto), the weekly send window.
 *     --to ses (rollback) is always allowed, but once the R5-finish code is
 *     deployed a list set back to SES REFUSES to send (its topic no longer
 *     receives opt-outs from /email-preferences; see registry-send.ts), so
 *     roll back only to stop a list's sends, not to keep them going.
 *
 * Usage (repo root):
 *   npx tsx apps/next/utils/mailing-lists/mailing-list-ops.ts parity
 *   npx tsx apps/next/utils/mailing-lists/mailing-list-ops.ts cutover --topic bibleClass --to registry --apply
 */

/** Wed–Sat in Toronto is the send window (Bible Class Wed, Newsletter Thu, Recap Sat). */
export function inSendWindow(now: Date = new Date()): boolean {
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Toronto' }).format(now)
  return ['Wed', 'Thu', 'Fri', 'Sat'].includes(day)
}

/** May this list be switched to registry sends, given its parity? */
export function cutoverAllowed(diff: { inSesNotInHouse: unknown[]; inHouseNotInSes: unknown[] }): boolean {
  return diff.inSesNotInHouse.length === 0 && diff.inHouseNotInSes.length === 0
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main(): Promise<void> {
  const command = process.argv[2]
  if (command !== 'parity' && command !== 'cutover') {
    throw new Error('Usage: mailing-list-ops.ts parity [--topic X] | cutover --topic X --to registry|ses [--apply]')
  }
  const { loadCredentials } = await import('./script-env')
  loadCredentials()
  ;(await import('../email/sesClient')).useThrottleTolerantSesClient()

  const { mailingListRepository } = await import(
    '@my/app/provider/dynamodb/repositories/mailing-list-repository'
  )
  const { personRepository } = await import('@my/app/provider/dynamodb/repositories/person-repository')
  const { runListParity } = await import('./parity')

  const topic = arg('--topic')
  const bridged = (await mailingListRepository.listAllLists()).filter(
    (l) => l.status === 'active' && l.sesTopic && (!topic || l.sesTopic === topic)
  )
  if (bridged.length === 0) throw new Error(topic ? `No active list carries topic "${topic}"` : 'No bridged lists — run the backfill first')

  // Person ids for diff addresses (an address with no person prints as "no-person").
  const idsFor = async (emails: string[]) =>
    Promise.all(emails.map(async (e) => (await personRepository.getByEmail(e))?.personId ?? 'no-person'))

  const results = []
  for (const list of bridged.sort((a, b) => (a.sesTopic as string).localeCompare(b.sesTopic as string))) {
    const p = await runListParity(list)
    results.push({ list, p })
    console.log(
      JSON.stringify(
        {
          topic: p.sesTopic,
          listId: p.listId,
          sendFromRegistry: list.sendFromRegistry === true,
          ses: p.diff.sesTotal,
          registry: p.diff.inHouseTotal,
          matched: p.diff.matched,
          inSesNotInRegistry: await idsFor(p.diff.inSesNotInHouse),
          inRegistryNotInSes: await idsFor(p.diff.inHouseNotInSes),
          resolverStats: p.resolverStats,
          parityEmpty: cutoverAllowed(p.diff),
        },
        null,
        2
      )
    )
  }

  if (command === 'parity') return

  const to = arg('--to')
  if (!topic || (to !== 'registry' && to !== 'ses')) throw new Error('cutover needs --topic <sesTopic> and --to registry|ses')
  const { list, p } = results[0]
  const apply = process.argv.includes('--apply')

  if (to === 'registry') {
    if (!cutoverAllowed(p.diff)) {
      throw new Error(`Refusing: parity for "${topic}" is not empty. Fix the differences (or re-run the backfill) first.`)
    }
    if (inSendWindow()) {
      throw new Error('Refusing: it is Wednesday–Saturday in Toronto (the send window). Cut over Sunday–Tuesday.')
    }
  }

  const on = to === 'registry'
  if ((list.sendFromRegistry === true) === on) {
    console.log(`\n"${topic}" already sends from ${to}. Nothing to do.`)
    return
  }
  if (!apply) {
    console.log(`\nDRY RUN — would set sendFromRegistry=${on} on list ${list.listId} ("${topic}"). Add --apply.`)
    return
  }
  await mailingListRepository.setSendFromRegistry(list.listId, on)
  console.log(`\nDone: "${topic}" (list ${list.listId}) now sends from ${to}.`)
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /mailing-list-ops\.ts$/.test(process.argv[1] || '')

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
