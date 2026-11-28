/**
 * Seed the made-up TEST people and the flagged test ecclesia used by preview
 * test sign-in (#349). Placeholder data only: every address is on the reserved
 * `.invalid` domain, every person is `isTestPersona: true`, and the Recording
 * Brother and Rep belong to "Test Ecclesia (preview)" (`isTest: true`), so no
 * real person, ecclesia or office is ever touched.
 *
 * Idempotent: it reads what exists and plans only what is missing. A second
 * run plans nothing. If a persona address already belongs to a record that is
 * NOT flagged as a test persona, the run stops with an error and writes nothing.
 *
 * DRY RUN BY DEFAULT: prints the plan (counts and persona labels, no real data)
 * and writes nothing. Reading is the only thing a dry run does.
 *
 *   npx tsx scripts/seed-test-personas.ts            # dry run
 *   npx tsx scripts/seed-test-personas.ts --apply    # write (owner approves first, backup first)
 *
 * Run --apply only after the owner approves, with a backup of the tee-admin
 * table in the private tee-admin-backups bucket. It is a one-shared-database
 * system: the new rows are flagged and hidden from every list, but they are real
 * rows in the production table.
 *
 * Credentials: AWS_* env vars if set, else the default CLI profile. Refuses to
 * run against any account other than 911911532459.
 */
import { execSync } from 'node:child_process'
import {
  TEST_ECCLESIA_ID,
  TEST_ECCLESIA_NAME,
  TEST_PERSONAS,
  type TestPersona,
} from '../packages/app/utils/test-personas'

const EXPECTED_ACCOUNT = '911911532459'

export interface SeedState {
  ecclesiaExists: boolean
  /** email → existing record (or null when there is none). */
  people: Record<string, { personId: string; isTestPersona?: boolean } | null>
  /** Office role ('rb' | 'rep#1') → whether it exists and who holds it. */
  offices: Record<string, { exists: boolean; holderPersonId?: string } | undefined>
}

export type SeedAction =
  | { op: 'createEcclesia'; name: string }
  | { op: 'createPerson'; persona: TestPersona }
  | { op: 'createOffice'; role: 'rb' | 'rep#1' }
  | { op: 'assignOffice'; role: 'rb' | 'rep#1'; personEmail: string }

export interface SeedPlan {
  actions: SeedAction[]
  errors: string[]
}

const officeRole = (o: 'recording-brother' | 'rep'): 'rb' | 'rep#1' => (o === 'rep' ? 'rep#1' : 'rb')

/** What is missing, given what exists. Pure. */
export function planSeed(state: SeedState): SeedPlan {
  const actions: SeedAction[] = []
  const errors: string[] = []

  if (!state.ecclesiaExists) actions.push({ op: 'createEcclesia', name: TEST_ECCLESIA_NAME })

  const personWillExist = new Set<string>()
  for (const persona of TEST_PERSONAS) {
    const existing = state.people[persona.email]
    if (!existing) {
      actions.push({ op: 'createPerson', persona })
    } else if (existing.isTestPersona !== true) {
      errors.push(`"${persona.label}": the address already belongs to a record that is not flagged as a test persona. Nothing was planned.`)
    }
    personWillExist.add(persona.email)
  }

  for (const persona of TEST_PERSONAS) {
    if (!persona.office) continue
    const role = officeRole(persona.office)
    const office = state.offices[role]
    if (!office?.exists) actions.push({ op: 'createOffice', role })
    const existingPerson = state.people[persona.email]
    // Holder is assigned when the office is new/vacant, or held by someone else.
    if (!office?.exists || !office.holderPersonId || (existingPerson && office.holderPersonId !== existingPerson.personId)) {
      actions.push({ op: 'assignOffice', role, personEmail: persona.email })
    }
  }

  return { actions: errors.length ? [] : actions, errors }
}

function describe(a: SeedAction): string {
  switch (a.op) {
    case 'createEcclesia':
      return `create test ecclesia "${a.name}" (isTest, id ${TEST_ECCLESIA_ID})`
    case 'createPerson':
      return `create test person "${a.persona.label}" (${a.persona.role}, ${a.persona.email})`
    case 'createOffice':
      return `create the ${a.role === 'rb' ? 'Recording Brother' : 'Rep'} office of the test ecclesia`
    case 'assignOffice':
      return `make ${a.personEmail} hold the ${a.role === 'rb' ? 'Recording Brother' : 'Rep'} office of the test ecclesia`
  }
}

function loadCredentials() {
  if (!process.env.AWS_ACCESS_KEY_ID) {
    const creds = JSON.parse(execSync('aws configure export-credentials --format process', { encoding: 'utf8' }))
    process.env.AWS_ACCESS_KEY_ID = creds.AccessKeyId
    process.env.AWS_SECRET_ACCESS_KEY = creds.SecretAccessKey
    if (creds.SessionToken) process.env.AWS_SESSION_TOKEN = creds.SessionToken
  }
  const account = execSync('aws sts get-caller-identity --query Account --output text', {
    encoding: 'utf8',
    env: process.env,
  }).trim()
  if (account !== EXPECTED_ACCOUNT) {
    throw new Error(`Refusing to run: AWS account is ${account}, expected ${EXPECTED_ACCOUNT}`)
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  loadCredentials()

  const { personRepository } = await import('../packages/app/provider/dynamodb/repositories/person-repository')
  const { officeRepository, repOfficeId, OFFICE_ROLES } = await import(
    '../packages/app/provider/dynamodb/repositories/office-repository'
  )
  const { getEcclesiaByName, createEcclesia } = await import('../apps/next/utils/dynamodb/locations')

  const ecclesia = await getEcclesiaByName(TEST_ECCLESIA_NAME)
  const people: SeedState['people'] = {}
  for (const p of TEST_PERSONAS) {
    const rec = await personRepository.getByEmail(p.email)
    people[p.email] = rec ? { personId: rec.personId, isTestPersona: rec.isTestPersona } : null
  }
  const offices: SeedState['offices'] = {}
  if (ecclesia) {
    for (const role of ['rb', 'rep#1'] as const) {
      const o = await officeRepository.getOffice(TEST_ECCLESIA_ID, role === 'rb' ? OFFICE_ROLES.RECORDING_BROTHER : repOfficeId(1))
      offices[role] = o ? { exists: true, holderPersonId: o.holderPersonId } : { exists: false }
    }
  }

  const plan = planSeed({ ecclesiaExists: !!ecclesia, people, offices })
  console.log(`\n=== Seed test personas (${apply ? 'APPLY' : 'DRY RUN'}) ===\n`)
  for (const e of plan.errors) console.log(`ERROR: ${e}`)
  if (plan.errors.length) process.exit(1)
  if (plan.actions.length === 0) console.log('Nothing to do: everything already exists.')
  for (const a of plan.actions) console.log(`  + ${describe(a)}`)

  if (!apply) {
    console.log(`\nDRY RUN: nothing written. ${plan.actions.length} change(s) would be made. Re-run with --apply (after owner approval and a backup).\n`)
    return
  }

  for (const a of plan.actions) {
    if (a.op === 'createEcclesia') {
      await createEcclesia({ name: TEST_ECCLESIA_NAME, ecclesiaId: TEST_ECCLESIA_ID, country: 'CA', province: 'ON', city: 'Testville', isTest: true })
    } else if (a.op === 'createPerson') {
      const p = a.persona
      const created = await personRepository.create({
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        ecclesia: p.ecclesia,
        memberStatus: p.memberStatus,
        role: p.role,
        provider: 'credentials',
        isTestPersona: true,
      })
      await personRepository.markEmailVerified(created.personId)
      people[p.email] = { personId: created.personId, isTestPersona: true }
    } else if (a.op === 'createOffice') {
      if (a.role === 'rb') await officeRepository.ensureRecordingBrotherOffice(TEST_ECCLESIA_ID)
      else await officeRepository.addRepOffice(TEST_ECCLESIA_ID)
    } else if (a.op === 'assignOffice') {
      const holder = people[a.personEmail]
      if (!holder) throw new Error('internal: holder was not created')
      await officeRepository.assignHolder(
        TEST_ECCLESIA_ID,
        a.role === 'rb' ? OFFICE_ROLES.RECORDING_BROTHER : repOfficeId(1),
        holder.personId
      )
    }
  }
  console.log(`\nApplied ${plan.actions.length} change(s).\n`)
}

if (/seed-test-personas\.ts$/.test(process.argv[1] || '')) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
