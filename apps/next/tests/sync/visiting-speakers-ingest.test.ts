import { describe, it, expect, vi } from 'vitest'
import {
  readVisitingSpeakers,
  syncVisitingSpeakers,
  splitSpeakerName,
  type PersonRepositoryLike,
} from '@my/app/provider/sync/visiting-speakers-ingest'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'

// ---- Fixtures ---------------------------------------------------------------

/** Minimal PersonRecord for the directory candidate list (only the fields the
 * resolver reads matter). */
function personRecord(
  personId: string,
  firstName: string,
  lastName: string,
  ecclesia: string
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
  } as PersonRecord
}

/** A GoogleSheetsService stub returning canned tab data. */
function fakeSheets(headers: string[], rows: any[][]) {
  return {
    getSheetDataWithHeaders: vi.fn(async () => ({ headers, rows })),
  } as any
}

/** A repository stub capturing create() inputs. */
function fakeRepo(existing: PersonRecord[]) {
  const createInputs: any[] = []
  const repo: PersonRepositoryLike = {
    listAll: vi.fn(async () => ({ items: existing, lastEvaluatedKey: undefined })) as any,
    create: vi.fn(async (input: any) => {
      createInputs.push(input)
      return { ...input, personId: `new-${createInputs.length}` } as PersonRecord
    }) as any,
  }
  return { repo, createInputs }
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
      { name: 'Alan Markwith', ecclesia: 'Greenaway Hamilton' },
      { name: 'Brad Stephens', ecclesia: 'Toronto East' },
    ])
  })

  it('falls back to the first column for the name when no header matches', async () => {
    const sheets = fakeSheets(
      ['Col A', 'Col B'],
      [['Alan Markwith', 'note']]
    )
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

    const result = await syncVisitingSpeakers('sheet-1', { repository: repo, sheets })

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

    const result = await syncVisitingSpeakers('sheet-1', {
      repository: repo,
      sheets,
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
})
