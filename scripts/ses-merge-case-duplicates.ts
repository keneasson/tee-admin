#!/usr/bin/env tsx
/**
 * Merge letter-case duplicate SES contacts onto the lower-case address (R5:
 * "SES holds no case duplicates"). OWNER-RUN. Dry run by default.
 *
 * A SEPARATE step from scripts/ses-safety-net-topics.ts, run only after that
 * switch is verified: once sends name the safety-net topic, a contact's topic
 * preferences no longer decide anything, so merging only has to keep
 * UnsubscribeAll ("stop all email") and AttributesData.
 *
 * STEPS
 *  (a) refuse unless the safety net is on (and not mid-switch), and refuse
 *      Wednesday–Saturday, Toronto time;
 *  (b) list every contact (ListContacts) and group mixed-case addresses by
 *      their lower-case form;
 *  (c) back up every contact in those groups via get-contact (TopicPreferences,
 *      AttributesData, UnsubscribeAll) to
 *      s3://tee-admin-backups/backups/<date>-ses-case-duplicates/, verified;
 *  (d) per group: create (or update) the lower-case contact FIRST, with
 *      UnsubscribeAll set if ANY variant had it, read it back, and only then
 *      delete the mixed-case variants. Safe while sends are live: the send
 *      path reads UnsubscribeAll lower-cased from every contact, so a stop is
 *      honoured at every moment (it is on a variant, the lower-case contact,
 *      or both);
 *  (e) verify: no mixed-case contact remains and every stop survived.
 *
 * Prints counts only — never an address.
 *
 * Usage (repo root):
 *   npx tsx scripts/ses-merge-case-duplicates.ts            # dry run
 *   npx tsx scripts/ses-merge-case-duplicates.ts --apply    # back up, then merge
 */

import { backupJsonToS3, loadCredentials, sleep } from '../apps/next/utils/mailing-lists/script-env'
import {
  mergeRefusals,
  planCaseDuplicates,
  type ContactSnapshot,
} from '../apps/next/utils/mailing-lists/safety-net-switch'
import { inSendWindow } from '../apps/next/utils/mailing-lists/mailing-list-ops'

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  loadCredentials()

  const { CreateContactCommand, DeleteContactCommand, GetContactCommand, ListContactsCommand, UpdateContactCommand } =
    await import('@aws-sdk/client-sesv2')
  const { mailingListRepository } = await import(
    '@my/app/provider/dynamodb/repositories/mailing-list-repository'
  )
  const { getSesClient } = await import('../apps/next/utils/email/sesClient')
  const { inputTemplate } = await import('../apps/next/utils/email/contact-lists')
  const ses = getSesClient()

  console.log(`\n=== SES letter-case duplicate merge (${apply ? 'APPLY' : 'DRY-RUN'}) ===\n`)

  // (a)
  const refusals = mergeRefusals({
    safetyNet: await mailingListRepository.getSafetyNetSetting(),
    inSendWindow: inSendWindow(),
  })

  // (b)
  const listAll = async (): Promise<Array<{ email: string; unsubscribeAll: boolean }>> => {
    const out: Array<{ email: string; unsubscribeAll: boolean }> = []
    let token: string | undefined
    do {
      const page = await ses.send(new ListContactsCommand({ ...inputTemplate, PageSize: 100, NextToken: token }))
      for (const c of page.Contacts ?? []) {
        if (c.EmailAddress) out.push({ email: c.EmailAddress, unsubscribeAll: !!c.UnsubscribeAll })
      }
      token = page.NextToken
    } while (token)
    return out
  }
  const all = await listAll()
  const mixedKeys = new Set(all.filter((c) => c.email !== c.email.toLowerCase()).map((c) => c.email.toLowerCase()))
  const affected = all.filter((c) => mixedKeys.has(c.email.toLowerCase()))
  console.log(
    JSON.stringify({ contacts: all.length, caseDuplicateAddresses: mixedKeys.size, affectedContacts: affected.length }, null, 2)
  )

  if (refusals.length > 0) {
    console.log('\nREFUSED:')
    for (const r of refusals) console.log(`  - ${r}`)
    if (apply) process.exit(1)
    return
  }
  if (mixedKeys.size === 0) {
    console.log('\nNo letter-case duplicates. Nothing to do.')
    return
  }
  if (!apply) {
    console.log('\nDRY RUN — nothing changed. Re-run with --apply (Sunday–Tuesday).\n')
    return
  }

  // (c) Full read of the affected contacts = the backup and the plan input.
  const raw: Record<string, unknown>[] = []
  const snapshot: ContactSnapshot[] = []
  for (const c of affected) {
    const full = await ses.send(new GetContactCommand({ ...inputTemplate, EmailAddress: c.email }))
    const { $metadata: _m, ...rest } = full as any
    raw.push(rest)
    snapshot.push({ email: c.email, unsubscribeAll: !!full.UnsubscribeAll, attributesData: full.AttributesData || undefined })
    await sleep(1100)
  }
  const stamp = new Date().toISOString().slice(0, 10)
  const prefix = `backups/${stamp}-ses-case-duplicates`
  backupJsonToS3(`${prefix}/ses-contacts-${Date.now()}.json`, {
    contactList: inputTemplate.ContactListName,
    takenAt: new Date().toISOString(),
    contacts: raw,
  })
  console.log(`Backed up ${raw.length} contact(s) to s3://tee-admin-backups/${prefix}/`)

  // (d) Lower-case contact first (read back), then delete the variants.
  const plan = planCaseDuplicates(snapshot)
  for (const d of plan) {
    if (!d.lowerExists) {
      await ses.send(
        new CreateContactCommand({
          ...inputTemplate,
          EmailAddress: d.email,
          UnsubscribeAll: d.unsubscribeAll,
          ...(d.attributesData ? { AttributesData: d.attributesData } : {}),
        })
      )
      await sleep(1100)
    } else if (d.unsubscribeAll) {
      await ses.send(
        new UpdateContactCommand({
          ...inputTemplate,
          EmailAddress: d.email,
          UnsubscribeAll: true,
          ...(d.attributesData ? { AttributesData: d.attributesData } : {}),
        })
      )
      await sleep(1100)
    }
    const check = await ses.send(new GetContactCommand({ ...inputTemplate, EmailAddress: d.email }))
    await sleep(1100)
    if (d.unsubscribeAll && !check.UnsubscribeAll) {
      throw new Error(
        `A lower-case contact did not keep UnsubscribeAll; its variants were NOT deleted. Stopping (backup: s3://tee-admin-backups/${prefix}/).`
      )
    }
    for (const variant of d.deleteVariants) {
      await ses.send(new DeleteContactCommand({ ...inputTemplate, EmailAddress: variant }))
      await sleep(1100)
    }
  }
  console.log(`(d) Merged ${plan.length} address(es).`)

  // (e) Verify.
  const after = await listAll()
  const problems: string[] = []
  const mixedLeft = after.filter((c) => c.email !== c.email.toLowerCase()).length
  if (mixedLeft > 0) problems.push(`${mixedLeft} mixed-case contact(s) remain`)
  const stoppedAfter = new Set(after.filter((c) => c.unsubscribeAll).map((c) => c.email))
  const lostStops = plan.filter((d) => d.unsubscribeAll && !stoppedAfter.has(d.email)).length
  if (lostStops > 0) problems.push(`${lostStops} merged address(es) lost UnsubscribeAll`)
  if (problems.length > 0) {
    console.error('\n(e) VERIFY FAILED:')
    for (const p of problems) console.error(`  - ${p}`)
    console.error(`Backup: s3://tee-admin-backups/${prefix}/`)
    process.exit(1)
  }
  console.log('\n(e) Verified: no case duplicates, every stop kept.\n')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
