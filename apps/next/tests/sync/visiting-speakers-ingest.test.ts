import { describe, it, expect, vi } from 'vitest'
import {
  readVisitingSpeakers,
  syncVisitingSpeakers,
  splitSpeakerName,
  type PersonRepositoryLike,
  type PrivacyRepositoryLike,
} from '@my/app/provider/sync/visiting-speakers-ingest'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'

// ---- Fixtures ---------------------------------------------------------------

/** Minimal PersonRecord for the directory candidate list (only the fields the
 * resolver + backfill guard read matter). */
function personRecord(
  personId: string,
  firstName: string,
  lastName: string,
  ecclesia: string,
  overrides: Partial<PersonRecord> = {}
): PersonRecord {
  return {
    pkey: `PERSON#${personId}`,
    skey: 'PROFILE',
    gsi1pk: `NOEMAIL#${personId}`,
    gsi1sk: 'PERSON',
    gsi2pk: `ECCLESIA#${ecclesia}`,
    gsi2sk: `${lastName}#${firstName}#${personId}`.toLowerCase(),
    gsi3pk: `NAME#${lastName}`.toLowerCase(),
    gsi3sk: `${firstName}#${personId}`.toLowerCase(),
    personId,
    primaryEmail: '',
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    ecclesia,
    memberStatus: 'member',
    ...overrides,
  } as PersonRecord
}

/** A record shaped like one WE auto-created: emailless schedule-import visitor. */
function scheduleImportVisitor(
  personId: string,
  firstName: string,
  lastName: string,
  ecclesia: string,
  overrides: Partial<PersonRecord> = {}
): PersonRecord {
  return personRecord(personId, firstName, lastName, ecclesia, {
    memberStatus: 'visitor',
    source: 'schedule-import',
    sourceRef: 'visiting-speakers:sheet-1',
    ...overrides,
  })
}

/** A GoogleSheetsService stub returning canned tab data. */
function fakeSheets(headers: string[], rows: any[][]) {
  return {
    getSheetDataWithHeaders: vi.fn(async () => ({ headers, rows })),
  } as any
}

/**
 * A repository stub capturing every mutation. `phonesByPerson` seeds getPhones
 * so the phone-idempotency guard can be exercised.
 */
function fakeRepo(
  existing: PersonRecord[],
  phonesByPerson: Record<string, any[]> = {}
) {
  const createInputs: any[] = []
  const addEmailCalls: any[] = []
  const addPhoneCalls: any[] = []
  const updatePersonCalls: any[] = []
  const repo: PersonRepositoryLike = {
    listAll: vi.fn(async () => ({ items: existing, lastEvaluatedKey: undefined })) as any,
    create: vi.fn(async (input: any) => {
      createInputs.push(input)
      return { ...input, personId: `new-${createInputs.length}` } as PersonRecord
    }) as any,
    addEmail: vi.fn(async (personId: string, email: any) => {
      addEmailCalls.push({ personId, ...email })
      return { emailId: `email-${addEmailCalls.length}`, ...email } as any
    }) as any,
    addPhone: vi.fn(async (personId: string, phone: any) => {
      addPhoneCalls.push({ personId, ...phone })
      return { phoneId: `phone-${addPhoneCalls.length}`, ...phone } as any
    }) as any,
    getPhones: vi.fn(async (personId: string) => phonesByPerson[personId] ?? []) as any,
    updatePerson: vi.fn(async (personId: string, updates: any) => {
      updatePersonCalls.push({ personId, ...updates })
      return { personId, ...updates } as any
    }) as any,
  }
  return { repo, createInputs, addEmailCalls, addPhoneCalls, updatePersonCalls }
}

/** A privacy stub capturing createPrivacySettings calls. */
function fakePrivacy() {
  const privacyCalls: any[] = []
  const privacy: PrivacyRepositoryLike = {
    createPrivacySettings: vi.fn(async (email: string, settings: any) => {
      privacyCalls.push({ email, settings })
    }) as any,
  }
  return { privacy, privacyCalls }
}

// ---- splitSpeakerName -------------------------------------------------------

describe('splitSpeakerName', () => {
  it('strips honorifics, preserves casing, keeps last token as surname', () => {
    expect(splitSpeakerName('Bro. Alan Markwith')).toEqual({
      firstName: 'Alan',
      lastName: 'Markwith',
    })
    expect(splitSpeakerName('John Michael Smith')).toEqual({
      firstName: 'John',
      lastName: 'Smith',
    })
    expect(splitSpeakerName('Madonna')).toEqual({ firstName: 'Madonna', lastName: '' })
  })
})

// ---- readVisitingSpeakers ---------------------------------------------------

describe('readVisitingSpeakers', () => {
  it('reads name + ecclesia columns by header', async () => {
    const sheets = fakeSheets(
      ['Speaker', 'Home Ecclesia'],
      [
        ['Alan Markwith', 'Greenaway Hamilton'],
        ['  ', 'Ignored'], // blank name → dropped
        ['Brad Stephens', 'Toronto East'],
      ]
    )
    const out = await readVisitingSpeakers('sheet-1', sheets)
    expect(out).toEqual([
      { name: 'Alan Markwith', ecclesia: 'Greenaway Hamilton', email: undefined, phone: undefined },
      { name: 'Brad Stephens', ecclesia: 'Toronto East', email: undefined, phone: undefined },
    ])
  })

  it('captures email + phone, lowercasing the email and trimming both', async () => {
    const sheets = fakeSheets(
      ['Name', 'Ecclesia', 'E-mail', 'Mobile'],
      [
        ['Alan Markwith', 'Greenaway Hamilton', '  Alan.Markwith@Example.COM ', ' 416 555 1234 '],
        ['Brad Stephens', 'Toronto East', '', ''], // blank contact cells → undefined
      ]
    )
    const out = await readVisitingSpeakers('sheet-1', sheets)
    expect(out[0]).toEqual({
      name: 'Alan Markwith',
      ecclesia: 'Greenaway Hamilton',
      email: 'alan.markwith@example.com',
      phone: '416 555 1234',
    })
    expect(out[1].email).toBeUndefined()
    expect(out[1].phone).toBeUndefined()
  })

  it('falls back to the first column for the name when no header matches', async () => {
    const sheets = fakeSheets(['Col A', 'Col B'], [['Alan Markwith', 'note']])
    const out = await readVisitingSpeakers('sheet-1', sheets)
    expect(out[0].name).toBe('Alan Markwith')
    expect(out[0].ecclesia).toBeUndefined()
  })
})

// ---- syncVisitingSpeakers ---------------------------------------------------

const ROWS = [
  ['Brad Stephens', 'Toronto East'], // already in directory → skipped
  ['Bro. Alan Markwith', 'Greenaway Hamilton'], // not-found → created
  ['TBD', 'Somewhere'], // placeholder → skipped
  ['Charlie Newman', ''], // not-found but no ecclesia → skipped
  ['David Owens', 'Book Road'], // not-found → created
  ['David Owens', 'Book Road'], // duplicate in same batch → skipped (idempotent)
]

function existingDirectory() {
  return [personRecord('p1', 'Brad', 'Stephens', 'Toronto East')]
}

describe('syncVisitingSpeakers', () => {
  it('creates confident not-found visitors, skips the rest, and is idempotent', async () => {
    const sheets = fakeSheets(['Name', 'Ecclesia'], ROWS)
    const { repo, createInputs } = fakeRepo(existingDirectory())
    const { privacy } = fakePrivacy()

    const result = await syncVisitingSpeakers('sheet-1', { repository: repo, sheets, privacy })

    expect(result.dryRun).toBe(false)
    expect(result.totalRows).toBe(6)

    // Only Alan + David created (David's duplicate resolves to the just-created
    // record and is skipped — no duplicate).
    expect(result.created.map((c) => c.name)).toEqual([
      'Bro. Alan Markwith',
      'David Owens',
    ])
    expect(createInputs).toHaveLength(2)

    // Real writes: emailless visitor / guest with provenance, correct ecclesia.
    expect(createInputs[0]).toMatchObject({
      firstName: 'Alan',
      lastName: 'Markwith',
      ecclesia: 'Greenaway Hamilton',
      memberStatus: 'visitor',
      role: 'guest',
      source: 'schedule-import',
      sourceRef: 'visiting-speakers:sheet-1',
    })
    expect(createInputs[0].email).toBeUndefined()
    expect(result.created[0].emailless).toBe(true)

    // Skips carry a reason.
    const skipReasons = Object.fromEntries(result.skipped.map((s) => [s.name, s.reason]))
    expect(skipReasons['Brad Stephens']).toMatch(/already in directory/)
    expect(skipReasons['TBD']).toMatch(/placeholder/)
    expect(skipReasons['Charlie Newman']).toMatch(/no home ecclesia/)
    expect(skipReasons['David Owens']).toMatch(/already in directory/)

    // Created records carry a real personId.
    expect(result.created[0].personId).toBeTruthy()
  })

  it('dryRun reports what WOULD be created without calling create()', async () => {
    const sheets = fakeSheets(['Name', 'Ecclesia'], ROWS)
    const { repo, createInputs } = fakeRepo(existingDirectory())
    const { privacy } = fakePrivacy()

    const result = await syncVisitingSpeakers('sheet-1', {
      repository: repo,
      sheets,
      privacy,
      dryRun: true,
    })

    expect(result.dryRun).toBe(true)
    expect(createInputs).toHaveLength(0)
    // Same set as a real run, but no personId (nothing written).
    expect(result.created.map((c) => c.name)).toEqual([
      'Bro. Alan Markwith',
      'David Owens',
    ])
    expect(result.created.every((c) => c.personId === undefined)).toBe(true)
  })

  // ---- Change 2: create WITH contact info -----------------------------------

  it('creates a not-found visitor WITH email (normal create path), phone, and privacy', async () => {
    const sheets = fakeSheets(
      ['Name', 'Ecclesia', 'Email', 'Phone'],
      [['Bro. Alan Markwith', 'Greenaway Hamilton', 'alan@example.com', '4165551234']]
    )
    const { repo, createInputs, addPhoneCalls } = fakeRepo(existingDirectory())
    const { privacy, privacyCalls } = fakePrivacy()

    const result = await syncVisitingSpeakers('sheet-1', { repository: repo, sheets, privacy })

    // create() called WITH the email → getByEmail can find them.
    expect(createInputs).toHaveLength(1)
    expect(createInputs[0].email).toBe('alan@example.com')
    expect(result.created[0].emailless).toBe(false)
    expect(result.created[0].email).toBe('alan@example.com')

    // Phone stored.
    expect(addPhoneCalls).toHaveLength(1)
    expect(addPhoneCalls[0]).toMatchObject({ number: '4165551234', type: 'mobile', isPrimary: true })
    expect(result.created[0].phone).toBe('4165551234')

    // Privacy set to ecclesia_and_connections for every sensitive field.
    expect(privacyCalls).toHaveLength(1)
    expect(privacyCalls[0].email).toBe('alan@example.com')
    expect(privacyCalls[0].settings).toEqual({
      showName: 'ecclesia_and_connections',
      showEmail: 'ecclesia_and_connections',
      showPhone: 'ecclesia_and_connections',
      showAddress: 'ecclesia_and_connections',
      showFamily: 'ecclesia_and_connections',
    })
    expect(result.created[0].privacy).toBe('ecclesia_and_connections')
  })

  it('creates an EMAILLESS visitor when the sheet has no email (keeps NOEMAIL# path)', async () => {
    const sheets = fakeSheets(
      ['Name', 'Ecclesia', 'Email', 'Phone'],
      [['Bro. Alan Markwith', 'Greenaway Hamilton', '', '']]
    )
    const { repo, createInputs, addPhoneCalls } = fakeRepo(existingDirectory())
    const { privacy, privacyCalls } = fakePrivacy()

    const result = await syncVisitingSpeakers('sheet-1', { repository: repo, sheets, privacy })

    expect(createInputs).toHaveLength(1)
    // No email key handed to create() → falls back to the emailless sentinel.
    expect(createInputs[0].email).toBeUndefined()
    expect(result.created[0].emailless).toBe(true)
    expect(result.created[0].privacy).toBeUndefined()
    // No phone, no privacy record for an emailless visitor.
    expect(addPhoneCalls).toHaveLength(0)
    expect(privacyCalls).toHaveLength(0)
  })

  // ---- Change 3: backfill onto an existing auto-created visitor -------------

  it('backfills email + phone + privacy onto an existing schedule-import visitor', async () => {
    const visitor = scheduleImportVisitor('v1', 'Alan', 'Markwith', 'Greenaway Hamilton')
    const sheets = fakeSheets(
      ['Name', 'Ecclesia', 'Email', 'Phone'],
      [['Bro. Alan Markwith', 'Greenaway Hamilton', 'Alan@Example.com', '4165551234']]
    )
    const { repo, createInputs, addEmailCalls, addPhoneCalls, updatePersonCalls } = fakeRepo([visitor])
    const { privacy, privacyCalls } = fakePrivacy()

    const result = await syncVisitingSpeakers('sheet-1', { repository: repo, sheets, privacy })

    // No new record created — the existing one is reconciled in place.
    expect(createInputs).toHaveLength(0)
    expect(result.created).toHaveLength(0)

    // Email added as primary + PROFILE sentinel flipped so getByEmail works.
    expect(addEmailCalls).toHaveLength(1)
    expect(addEmailCalls[0]).toMatchObject({
      personId: 'v1',
      email: 'alan@example.com',
      emailType: 'primary',
    })
    expect(updatePersonCalls).toHaveLength(1)
    expect(updatePersonCalls[0]).toEqual({
      personId: 'v1',
      gsi1pk: 'EMAIL#alan@example.com',
      primaryEmail: 'alan@example.com',
    })

    // Phone added.
    expect(addPhoneCalls).toHaveLength(1)
    expect(addPhoneCalls[0]).toMatchObject({ personId: 'v1', number: '4165551234' })

    // Privacy set on the backfilled record.
    expect(privacyCalls).toHaveLength(1)
    expect(privacyCalls[0].email).toBe('alan@example.com')
    expect(privacyCalls[0].settings.showEmail).toBe('ecclesia_and_connections')

    // Report reflects the backfill.
    expect(result.backfilled).toHaveLength(1)
    expect(result.backfilled[0]).toEqual({
      name: 'Bro. Alan Markwith',
      ecclesia: 'Greenaway Hamilton',
      personId: 'v1',
      addedEmail: 'alan@example.com',
      addedPhone: '4165551234',
      privacy: 'ecclesia_and_connections',
    })
  })

  it('dryRun reports a backfill WITHOUT writing', async () => {
    const visitor = scheduleImportVisitor('v1', 'Alan', 'Markwith', 'Greenaway Hamilton')
    const sheets = fakeSheets(
      ['Name', 'Ecclesia', 'Email', 'Phone'],
      [['Bro. Alan Markwith', 'Greenaway Hamilton', 'alan@example.com', '4165551234']]
    )
    const { repo, addEmailCalls, addPhoneCalls, updatePersonCalls } = fakeRepo([visitor])
    const { privacy, privacyCalls } = fakePrivacy()

    const result = await syncVisitingSpeakers('sheet-1', {
      repository: repo,
      sheets,
      privacy,
      dryRun: true,
    })

    // Nothing written.
    expect(addEmailCalls).toHaveLength(0)
    expect(addPhoneCalls).toHaveLength(0)
    expect(updatePersonCalls).toHaveLength(0)
    expect(privacyCalls).toHaveLength(0)

    // But the intended backfill is reported.
    expect(result.backfilled).toHaveLength(1)
    expect(result.backfilled[0].addedEmail).toBe('alan@example.com')
    expect(result.backfilled[0].addedPhone).toBe('4165551234')
    expect(result.backfilled[0].privacy).toBe('ecclesia_and_connections')
  })

  it('does NOT add a phone when the visitor already has one (idempotent)', async () => {
    const visitor = scheduleImportVisitor('v1', 'Alan', 'Markwith', 'Greenaway Hamilton', {
      primaryEmail: 'alan@example.com', // already backfilled email
    })
    const sheets = fakeSheets(
      ['Name', 'Ecclesia', 'Email', 'Phone'],
      [['Bro. Alan Markwith', 'Greenaway Hamilton', 'alan@example.com', '4165551234']]
    )
    const { repo, addEmailCalls, addPhoneCalls } = fakeRepo([visitor], {
      v1: [{ phoneId: 'existing', number: '4165551234' }],
    })
    const { privacy } = fakePrivacy()

    const result = await syncVisitingSpeakers('sheet-1', { repository: repo, sheets, privacy })

    // Email already present, phone already present → nothing to do.
    expect(addEmailCalls).toHaveLength(0)
    expect(addPhoneCalls).toHaveLength(0)
    expect(result.backfilled).toHaveLength(0)
    expect(result.skipped.some((s) => /up to date/.test(s.reason))).toBe(true)
  })

  // ---- Change 3 (CRITICAL SAFETY): never touch a real member ---------------

  it('NEVER modifies a real member even when the sheet carries their email + phone', async () => {
    // Brad is a genuine member (no source, memberStatus 'member').
    const member = personRecord('p1', 'Brad', 'Stephens', 'Toronto East')
    const sheets = fakeSheets(
      ['Name', 'Ecclesia', 'Email', 'Phone'],
      [['Brad Stephens', 'Toronto East', 'brad@personal.com', '9055559999']]
    )
    const { repo, createInputs, addEmailCalls, addPhoneCalls, updatePersonCalls } = fakeRepo([member])
    const { privacy, privacyCalls } = fakePrivacy()

    const result = await syncVisitingSpeakers('sheet-1', { repository: repo, sheets, privacy })

    // Absolutely no writes of any kind against the real member.
    expect(createInputs).toHaveLength(0)
    expect(addEmailCalls).toHaveLength(0)
    expect(addPhoneCalls).toHaveLength(0)
    expect(updatePersonCalls).toHaveLength(0)
    expect(privacyCalls).toHaveLength(0)
    expect(result.backfilled).toHaveLength(0)

    // Left untouched, reported as already present.
    expect(result.skipped).toEqual([{ name: 'Brad Stephens', reason: 'already in directory' }])
  })
})
