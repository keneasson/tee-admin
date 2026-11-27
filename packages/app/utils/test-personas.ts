/**
 * Made-up test people for preview-build sign-in (#349). Placeholder data only.
 *
 * Every persona carries `isTestPersona: true` and an address on the reserved
 * `.invalid` domain (RFC 2606: it can never be registered, so mail can never
 * be delivered). The Recording Brother and Rep belong to a flagged TEST
 * ecclesia, so no real ecclesia's offices are ever touched.
 *
 * Pure: no platform imports, no I/O. The seed script, the sign-in provider and
 * the send guard all read this one list.
 */

export const TEST_PERSONA_DOMAIN = 'test-personas.invalid'
export const TEST_ECCLESIA_NAME = 'Test Ecclesia (preview)'
export const TEST_ECCLESIA_ID = 'test-ecclesia-preview'

export type TestPersonaKey =
  | 'owner'
  | 'admin'
  | 'member-toronto-east'
  | 'member-cambridge'
  | 'guest'
  | 'recording-brother'
  | 'rep'

export interface TestPersona {
  key: TestPersonaKey
  /** Shown in the sign-in picker and the banner. */
  label: string
  email: string
  firstName: string
  lastName: string
  role: 'owner' | 'admin' | 'member' | 'guest'
  memberStatus: 'member' | 'visitor'
  ecclesia: string
  /** Office held in the test ecclesia (`officeRepository` role), if any. */
  office?: 'recording-brother' | 'rep'
}

const addr = (local: string) => `${local}@${TEST_PERSONA_DOMAIN}`

export const TEST_PERSONAS: readonly TestPersona[] = [
  { key: 'owner', label: 'Owner', email: addr('owner'), firstName: 'Test', lastName: 'Owner', role: 'owner', memberStatus: 'member', ecclesia: 'Toronto East' },
  { key: 'admin', label: 'Admin', email: addr('admin'), firstName: 'Test', lastName: 'Admin', role: 'admin', memberStatus: 'member', ecclesia: 'Toronto East' },
  { key: 'member-toronto-east', label: 'Member (Toronto East)', email: addr('member-toronto-east'), firstName: 'Test', lastName: 'Member Toronto', role: 'member', memberStatus: 'member', ecclesia: 'Toronto East' },
  { key: 'member-cambridge', label: 'Member (Cambridge)', email: addr('member-cambridge'), firstName: 'Test', lastName: 'Member Cambridge', role: 'member', memberStatus: 'member', ecclesia: 'Cambridge' },
  { key: 'guest', label: 'Guest', email: addr('guest'), firstName: 'Test', lastName: 'Guest', role: 'guest', memberStatus: 'visitor', ecclesia: '' },
  { key: 'recording-brother', label: 'Recording Brother (test ecclesia)', email: addr('recording-brother'), firstName: 'Test', lastName: 'Recording Brother', role: 'member', memberStatus: 'member', ecclesia: TEST_ECCLESIA_NAME, office: 'recording-brother' },
  { key: 'rep', label: 'Rep (test ecclesia)', email: addr('rep'), firstName: 'Test', lastName: 'Rep', role: 'member', memberStatus: 'member', ecclesia: TEST_ECCLESIA_NAME, office: 'rep' },
]

export function findTestPersonaByEmail(email: string | null | undefined): TestPersona | null {
  const e = (email || '').trim().toLowerCase()
  return TEST_PERSONAS.find((p) => p.email === e) ?? null
}

/**
 * An address no mail can ever reach: the reserved `.invalid` top-level domain
 * (which includes every test persona). The send guard drops these.
 */
export function isUndeliverableAddress(email: string | null | undefined): boolean {
  const e = (email || '').trim().toLowerCase().replace(/[>\s]+$/, '')
  return e.endsWith('.invalid')
}
