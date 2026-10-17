/**
 * Make a shared household address a person's PRIMARY (send) address, and retire
 * their old one (#267).
 *
 * The case: a couple share one inbox. It was only ONE spouse's address, so the
 * other spouse's sends (e.g. the exhorter heads-up) went to a dead work address.
 *
 * What it does, in this order (each step is safe if the next one fails):
 *   1. adds the shared address to the person as an EMAIL# row marked
 *      `loginExcluded` — mail reaches them there, it does NOT sign them in, so
 *      the spouse who already signs in with it keeps doing so (`chooseSignInHolder`);
 *   2. `changePrimaryEmail` → the shared address becomes their primary;
 *   3. the old address is kept for history as `emailType: 'archived'` with the
 *      given `sesStatus` (default `bounced`) — never primary, never a target.
 *
 * It touches ONLY the named person's items. It makes NO SES calls (contact
 * lists / topics are untouched) and sends no email.
 *
 * ⚠️ RUN ONLY AFTER the #267 resolver is DEPLOYED. Before it, two PROFILEs on
 * one address make sign-in pick a person arbitrarily. `--after-deploy` is
 * required to apply, as a deliberate acknowledgement.
 *
 * BACK UP FIRST (both people + every item referencing them) to the private
 * `tee-admin-backups` bucket. No addresses or names live in this file: they
 * are arguments.
 *
 * Usage:
 *   eval "$(aws configure export-credentials --format env)"
 *   npx tsx scripts/join-shared-household-email.ts --person <personId> \
 *     --address <shared@address> --retire <old@address> [--retire-status bounced]
 *   ...add --apply --after-deploy to write.
 */
import { personRepository } from '../packages/app/provider/dynamodb/repositories/person-repository'
import type { PersonEmailRecord } from '../packages/app/provider/dynamodb/types'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const personId = arg('person')
  const address = arg('address')?.trim().toLowerCase()
  const retire = arg('retire')?.trim().toLowerCase()
  const retireStatus = (arg('retire-status') ?? 'bounced') as PersonEmailRecord['sesStatus']
  const apply = process.argv.includes('--apply')
  if (!personId || !address || !retire) {
    throw new Error('--person, --address and --retire are required')
  }
  if (apply && !process.argv.includes('--after-deploy')) {
    throw new Error('Refusing to apply without --after-deploy (the #267 resolver must be live first)')
  }

  const person = await personRepository.getById(personId)
  if (!person) throw new Error(`No person ${personId}`)
  const emails = await personRepository.getEmails(personId)
  const holders = (await personRepository.getAllPersonsByEmail(address)).filter(
    (p) => p.personId !== personId
  )

  console.log(`Person ${personId}: primary is currently ${person.primaryEmail === retire ? '<retire address>' : '<other>'}`)
  console.log(`Other people already holding the shared address: ${holders.map((h) => h.personId).join(', ') || 'none'}`)
  const existing = emails.find((e) => e.email.toLowerCase() === address)
  const old = emails.find((e) => e.email.toLowerCase() === retire)
  console.log('Plan:')
  console.log(`  1. ${existing ? `mark existing EMAIL#${existing.emailId}` : 'add a new EMAIL# row'} for the shared address, loginExcluded=${holders.length > 0}`)
  console.log('  2. changePrimaryEmail → shared address (PROFILE.primaryEmail + gsi1pk)')
  console.log(`  3. ${old ? `EMAIL#${old.emailId}` : '(no row found)'} for the retired address → emailType=archived, sesStatus=${retireStatus}`)
  if (!apply) {
    console.log('\nDry run — nothing written. Add --apply --after-deploy to write.')
    return
  }

  // 1. Row first, flagged — harmless on its own (a secondary that can't sign in).
  const loginExcluded = holders.length > 0
  if (existing) {
    await personRepository.update(existing.pkey, existing.skey, { loginExcluded } as any)
  } else {
    await personRepository.addEmail(personId, {
      email: address,
      emailType: 'secondary',
      order: emails.length,
      verified: true,
      sesSubscribed: false,
      sesStatus: 'active',
      loginExcluded,
    })
  }

  // 2. Commit: the shared address becomes the primary (send) address.
  const { oldEmail } = await personRepository.changePrimaryEmail(personId, address)
  console.log(`changePrimaryEmail done (old primary was ${oldEmail === retire ? '<retire address>' : '<other>'})`)

  // 3. Retire the old address: history only, never a target.
  const after = await personRepository.getEmails(personId)
  const oldRow = after.find((e) => e.email.toLowerCase() === retire)
  if (oldRow) {
    await personRepository.update(oldRow.pkey, oldRow.skey, {
      emailType: 'archived',
      sesStatus: retireStatus,
      sesSubscribed: false,
    } as any)
  }

  const final = await personRepository.getEmails(personId)
  console.log('Result:')
  for (const e of final) {
    console.log(
      `  EMAIL#${e.emailId} ${e.email.toLowerCase() === address ? '<shared>' : e.email.toLowerCase() === retire ? '<retired>' : '<other>'} type=${e.emailType} sesStatus=${e.sesStatus} loginExcluded=${!!e.loginExcluded}`
    )
  }
  const resolved = await personRepository.getByEmail(address)
  console.log(`Sign-in for the shared address resolves to: ${resolved?.personId}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
