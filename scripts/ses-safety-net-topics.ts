#!/usr/bin/env tsx
/**
 * Switch SES to the safety-net topics (R5). OWNER-RUN. Dry run by default.
 *
 * WHAT IT DOES
 *  The 7 per-email-type SES topics (newsletter, memorial, …) are replaced by
 *  the safety-net topic(s) configured in
 *  apps/next/utils/mailing-lists/safety-net.ts (today one: safetyNetDefault,
 *  default OPT_IN). After this, the registry alone decides who gets which list;
 *  SES only drops mail to contacts who opted out of the safety net, set
 *  UnsubscribeAll, or are on the suppression list.
 *
 * WHY IT IS DANGEROUS
 *  `update-contact-list` REPLACES the topic list and WIPES every contact's
 *  TopicPreferences (CLAUDE.md; it zeroed the list on 2026-07-04). That is
 *  intended here — subscriptions now live in the registry — but only after
 *  every list sends from the registry and a full backup exists.
 *
 * STEPS
 *  (a) refuse unless every bridged list has sendFromRegistry on and its parity
 *      is empty (run mailing-list-ops.ts parity / cutover first);
 *  (b) refuse Wednesday–Saturday, Toronto time (the weekly send window);
 *  (c) back up to s3://tee-admin-backups/backups/<date>-ses-safety-net/: every
 *      contact via get-contact (TopicPreferences, AttributesData,
 *      UnsubscribeAll), the topic list, the suppression list, every LIST# item
 *      and the safety-net setting; each upload is verified before going on;
 *  (d) replace the topic list with ONLY the safety-net topic(s), default
 *      OPT_IN, in ONE update-contact-list call;
 *  (e) UnsubscribeAll must survive: one fast ListContacts pass (100 contacts
 *      a page, it returns UnsubscribeAll) finds every previously stopped
 *      contact that lost it; each is re-applied with update-contact; then a
 *      second ListContacts pass must show EVERY previously stopped contact
 *      still stopped, or the script REFUSES to go on to (f). (SES documents
 *      UnsubscribeAll as contact-level, so the expected result is 0 lost.)
 *  (f) only then flip the stored setting so sends name the safety-net topic;
 *  (g) verify by reading back: the topic list is exactly the safety nets with
 *      OPT_IN defaults, the setting is on, every UnsubscribeAll survived.
 *
 *  THE GAP between (d) and (f) is FAIL-CLOSED: just before (d) the stored
 *  setting is marked `switching`, and while it is, EVERY send refuses
 *  (registry-send.ts; the cron marks it failed and retries later) — nobody is
 *  mailed, not even on a list with no SES topic. A bridged-list send that read
 *  the setting just before would name its old topic, which no longer exists,
 *  and SES fails it. That is why (e)
 *  runs before (f): if the topic edit had cleared UnsubscribeAll, flipping
 *  first would let live sends reach people who chose "stop all email". (d)–(f)
 *  run back-to-back (seconds, plus ~1s per contact that needs re-applying);
 *  (b) keeps the weekly crons out of it. Do not send manually while this runs.
 *  If (e) refuses, `switching` stays on and every send keeps refusing until
 *  the owner fixes the contacts or rolls back (below).
 *
 *  Letter-case duplicate SES contacts (R5's "no case duplicates") are NOT
 *  touched here: that is a separate, later step,
 *  scripts/ses-merge-case-duplicates.ts, run once the safety net is verified.
 *
 *  Re-running after success does nothing (the setting is already on). Prints
 *  counts only — never an address.
 *
 * ROLLBACK (if something is wrong after (d)): restore the topic list from the
 * backup's ses-topic-list JSON with update-contact-list, set the setting off
 * (MAILING_LIST_SETTINGS / SAFETY_NET enabled=false, switching=false), then restore contacts'
 * TopicPreferences from ses-contacts JSON (update-contact per contact).
 *
 * Usage (repo root):
 *   npx tsx scripts/ses-safety-net-topics.ts            # dry run: checks + plan
 *   npx tsx scripts/ses-safety-net-topics.ts --apply    # back up, then switch
 */

import { backupJsonToS3, loadCredentials, sleep } from '../apps/next/utils/mailing-lists/script-env'
import {
  lostUnsubscribeAll,
  safetyNetTopicList,
  switchRefusals,
  topicListProblems,
  type ContactSnapshot,
} from '../apps/next/utils/mailing-lists/safety-net-switch'
import { SAFETY_NET_TOPICS } from '../apps/next/utils/mailing-lists/safety-net'
import { cutoverAllowed, inSendWindow } from '../apps/next/utils/mailing-lists/mailing-list-ops'

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  loadCredentials()

  // Imported after credentials are in the environment (the clients read them at load).
  const {
    GetContactCommand,
    GetContactListCommand,
    ListContactsCommand,
    ListSuppressedDestinationsCommand,
    UpdateContactCommand,
    UpdateContactListCommand,
  } = await import('@aws-sdk/client-sesv2')
  const { mailingListRepository } = await import(
    '@my/app/provider/dynamodb/repositories/mailing-list-repository'
  )
  const { getSesClient, useThrottleTolerantSesClient } = await import('../apps/next/utils/email/sesClient')
  useThrottleTolerantSesClient()
  const { inputTemplate } = await import('../apps/next/utils/email/contact-lists')
  const { runListParity } = await import('../apps/next/utils/mailing-lists/parity')
  const ses = getSesClient()
  const topicNames = SAFETY_NET_TOPICS.map((t) => t.name)

  console.log(`\n=== SES safety-net switch (${apply ? 'APPLY' : 'DRY-RUN'}) ===\n`)

  const setting = await mailingListRepository.getSafetyNetSetting()
  if (setting.enabled) {
    console.log(`The safety net is already on (topics: ${setting.topics.join(', ')}). Nothing to do.`)
    return
  }
  if (setting.switching) {
    console.error(
      'A previous run stopped mid-switch (setting.switching is on, so every send is refused). ' +
        'Check UnsubscribeAll against that run\'s backup and see ROLLBACK in this header. Nothing changed.'
    )
    process.exit(1)
  }

  // (a) + (b)
  const lists = await mailingListRepository.listAllLists()
  const parityEmpty = new Map<string, boolean>()
  for (const l of lists.filter((x) => x.status === 'active' && x.sesTopic)) {
    const p = await runListParity(l)
    parityEmpty.set(l.listId, cutoverAllowed(p.diff))
    console.log(
      `  list "${l.key}": sendFromRegistry=${l.sendFromRegistry === true}, parity ses=${p.diff.sesTotal} registry=${p.diff.inHouseTotal} empty=${cutoverAllowed(p.diff)}`
    )
  }
  const refusals = switchRefusals({ lists, parityEmpty, inSendWindow: inSendWindow() })

  // Every contact, in full (also the backup). ~1 call/sec (SES limit).
  const emails: string[] = []
  let NextToken: string | undefined
  do {
    const page = await ses.send(new ListContactsCommand({ ...inputTemplate, PageSize: 100, NextToken }))
    for (const c of page.Contacts ?? []) if (c.EmailAddress) emails.push(c.EmailAddress)
    NextToken = page.NextToken
  } while (NextToken)
  console.log(`\nReading ${emails.length} SES contact(s) (about ${Math.ceil(emails.length * 1.1)}s)…`)
  const rawContacts: Record<string, unknown>[] = []
  const snapshot: ContactSnapshot[] = []
  for (const email of emails) {
    const full = await ses.send(new GetContactCommand({ ...inputTemplate, EmailAddress: email }))
    const { $metadata: _m, ...raw } = full as any
    rawContacts.push(raw)
    snapshot.push({ email, unsubscribeAll: !!full.UnsubscribeAll, attributesData: full.AttributesData || undefined })
    await sleep(1100)
  }
  const topicListBefore = await ses.send(new GetContactListCommand(inputTemplate))
  const stopped = snapshot.filter((c) => c.unsubscribeAll)

  console.log(
    JSON.stringify(
      {
        topicsNow: (topicListBefore.Topics ?? []).map((t) => t.TopicName),
        topicsAfter: topicNames,
        contacts: snapshot.length,
        contactsWithTopicPreferencesToBeCleared: rawContacts.filter(
          (c: any) => Array.isArray(c.TopicPreferences) && c.TopicPreferences.length > 0
        ).length,
        contactsWithUnsubscribeAll: stopped.length,
      },
      null,
      2
    )
  )

  if (refusals.length > 0) {
    console.log('\nREFUSED:')
    for (const r of refusals) console.log(`  - ${r}`)
    if (apply) process.exit(1)
    return
  }
  if (!apply) {
    console.log('\nDRY RUN — nothing changed. Checks pass; re-run with --apply (Sunday–Tuesday).\n')
    return
  }

  // (c) Back up everything this touches, verified, before the first write.
  const stamp = new Date().toISOString().slice(0, 10)
  const prefix = `backups/${stamp}-ses-safety-net`
  const run = Date.now()
  const takenAt = new Date().toISOString()
  const suppressed: unknown[] = []
  let supToken: string | undefined
  do {
    const page = await ses.send(new ListSuppressedDestinationsCommand({ NextToken: supToken, PageSize: 100 }))
    suppressed.push(...(page.SuppressedDestinationSummaries ?? []))
    supToken = page.NextToken
  } while (supToken)
  const { $metadata: _tm, ...topicListRaw } = topicListBefore as any
  console.log(`\nBacking up to s3://tee-admin-backups/${prefix}/ …`)
  backupJsonToS3(`${prefix}/ses-contacts-${run}.json`, { contactList: inputTemplate.ContactListName, takenAt, contacts: rawContacts })
  backupJsonToS3(`${prefix}/ses-topic-list-${run}.json`, { takenAt, topicList: topicListRaw })
  backupJsonToS3(`${prefix}/ses-suppression-list-${run}.json`, { takenAt, suppressed })
  backupJsonToS3(`${prefix}/mailing-lists-${run}.json`, { takenAt, lists, setting })
  console.log(`Backed up ${rawContacts.length} contacts, the topic list, ${suppressed.length} suppressed, ${lists.length} lists.`)

  // Reading took minutes: re-check the window and the setting right before acting.
  if (inSendWindow()) throw new Error('Refusing: the send window started while reading. Nothing changed.')
  const settingNow = await mailingListRepository.getSafetyNetSetting()
  if (settingNow.enabled || settingNow.switching) {
    throw new Error('Refusing: someone else started the safety-net switch meanwhile. Nothing changed.')
  }

  // Fail closed for the whole switch: while `switching` is on EVERY send
  // refuses — also a list with no SES topic, which names no topic and so would
  // not be stopped by the old topics being gone.
  await mailingListRepository.setSafetyNetSetting({ enabled: false, switching: true, topics: [] })
  console.log('\n(d-) Setting "switching" on: every send refuses until (f).')

  // (d) ONE call: the topic list becomes the safety nets only.
  await ses.send(
    new UpdateContactListCommand({
      ContactListName: inputTemplate.ContactListName,
      Topics: safetyNetTopicList(),
      ...(topicListBefore.Description ? { Description: topicListBefore.Description } : {}),
    })
  )
  console.log('\n(d) Topic list replaced.')

  // Every contact's UnsubscribeAll by exact address, from ListContacts
  // (100 a page): fast, so the fail-closed gap before (f) stays short.
  const listUnsubscribeAll = async (): Promise<Map<string, boolean>> => {
    const out = new Map<string, boolean>()
    let token: string | undefined
    do {
      const page = await ses.send(new ListContactsCommand({ ...inputTemplate, PageSize: 100, NextToken: token }))
      for (const c of page.Contacts ?? []) if (c.EmailAddress) out.set(c.EmailAddress, !!c.UnsubscribeAll)
      token = page.NextToken
    } while (token)
    return out
  }

  // (e) UnsubscribeAll must survive — BEFORE (f), so sends stay failed-closed meanwhile.
  const lost = lostUnsubscribeAll(stopped, await listUnsubscribeAll())
  for (const email of lost) {
    const c = stopped.find((s) => s.email === email)
    await ses.send(
      new UpdateContactCommand({
        ...inputTemplate,
        EmailAddress: email,
        UnsubscribeAll: true,
        ...(c?.attributesData ? { AttributesData: c.attributesData } : {}),
      })
    )
    await sleep(1100)
  }
  const stillLost = lost.length > 0 ? lostUnsubscribeAll(stopped, await listUnsubscribeAll()) : []
  console.log(
    `(e) UnsubscribeAll: ${stopped.length - lost.length} unchanged by the topic edit, ${lost.length - stillLost.length} re-applied, ${stillLost.length} still missing.`
  )
  if (stillLost.length > 0) {
    console.error(
      `\nREFUSED to switch the setting on: ${stillLost.length} contact(s) that had UnsubscribeAll do not have it.` +
        '\nEvery send keeps REFUSING (closed) meanwhile: the setting stays "switching".' +
        `\nFix those contacts (backup: s3://tee-admin-backups/${prefix}/) and re-run, or roll back (header).`
    )
    process.exit(1)
  }

  // (f) Only now: sends name the safety-net topic.
  await mailingListRepository.setSafetyNetSetting({ enabled: true, switching: false, topics: topicNames })
  console.log('(f) Setting on ("switching" off): sends name the safety-net topic.')

  // (g) Read back.
  const problems: string[] = []
  const topicListAfter = await ses.send(new GetContactListCommand(inputTemplate))
  problems.push(...topicListProblems(topicListAfter.Topics))
  const settingAfter = await mailingListRepository.getSafetyNetSetting()
  if (!settingAfter.enabled) problems.push('The safety-net setting is not on')
  const lostAfter = lostUnsubscribeAll(stopped, await listUnsubscribeAll())
  if (lostAfter.length > 0) problems.push(`${lostAfter.length} contact(s) lost UnsubscribeAll`)

  if (problems.length > 0) {
    console.error('\n(g) VERIFY FAILED:')
    for (const p of problems) console.error(`  - ${p}`)
    console.error(`Backup: s3://tee-admin-backups/${prefix}/ (see ROLLBACK in this script's header).`)
    process.exit(1)
  }
  console.log(`\n(g) Verified: topics = ${topicNames.join(', ')} (OPT_IN), setting on, UnsubscribeAll intact.`)
  console.log('\n=== Done. Next: npx tsx scripts/ses-merge-case-duplicates.ts (dry run), then scripts/retire-ses-topic-fields.ts. ===\n')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
