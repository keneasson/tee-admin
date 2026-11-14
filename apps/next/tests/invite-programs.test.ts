/**
 * Invitation programs (docs/SPEAKER_INVITATIONS.md §3a): the pure rules, the
 * repository's built-in defaults, and the picker's directory filter. Mocked
 * client; placeholder ecclesias and people only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('@aws-sdk/lib-dynamodb', () => {
  const cmd = (type: string) => vi.fn().mockImplementation((params) => ({ type, params }))
  return {
    DynamoDBDocumentClient: { from: vi.fn(() => ({ send: mockSend })) },
    QueryCommand: cmd('QueryCommand'),
    PutCommand: cmd('PutCommand'),
    GetCommand: cmd('GetCommand'),
    UpdateCommand: cmd('UpdateCommand'),
    DeleteCommand: cmd('DeleteCommand'),
    ScanCommand: cmd('ScanCommand'),
    BatchWriteCommand: cmd('BatchWriteCommand'),
    BatchGetCommand: cmd('BatchGetCommand'),
    TransactWriteCommand: cmd('TransactWriteCommand'),
  }
})
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn() }))
vi.mock('@/utils/dynamodb/locations', () => ({ listEcclesiasCached: async () => [] }))

import {
  builtInPrograms,
  inviteSlot,
  inviteWording,
  isEligibleFor,
  isSpecificName,
  mergeWithBuiltIns,
  parseProgramInput,
  snapshotOf,
  validatePrograms,
  type InviteProgram,
} from '@my/app/provider/dynamodb/invite-program-types'
import {
  INVITE_TYPE_LABEL,
  INVITE_TYPE_PHRASE,
  INVITE_TYPE_SLOT,
  speakerInviteKeys,
} from '@my/app/provider/dynamodb/speaker-invite-types'
import { InviteProgramRepository, inviteProgramRepository } from '@my/app/provider/dynamodb/repositories/invite-program-repository'
import { PATTERNS } from '@my/app/provider/dynamodb/access-patterns'
import type { RegistryEntry } from '@my/app/provider/schedule-sources/types'
import { filterCandidates } from '@/utils/speaker-invites/candidates'

const ECC = 'Example Ecclesia'

/** A registered CYC roster for the ecclesia: `speaker` names a person, `topic` doesn't. */
const CYC_ENTRY: RegistryEntry = {
  ecclesiaId: 'example-ecclesia',
  scheduleId: 'cyc',
  name: 'CYC',
  kind: 'cyc',
  active: true,
  source: { kind: 'native' },
  mapping: {
    dateColumn: 'Date',
    fields: [
      { column: 'Speaker', key: 'speaker', label: 'Speaker', rosterRole: true },
      { column: 'Topic', key: 'topic', label: 'Topic', rosterRole: false },
    ],
  },
}

function program(over: Partial<InviteProgram> = {}): InviteProgram {
  return {
    programId: 'cyc-class',
    name: 'CYC class',
    phrase: 'lead a CYC class',
    who: 'anyone',
    where: 'region',
    link: { scheduleId: 'cyc', field: 'speaker' },
    lengthMinutes: 60,
    active: true,
    order: 3,
    ...over,
  }
}

beforeEach(() => {
  mockSend.mockReset()
  mockSend.mockImplementation(async (c: any) => (c.type === 'QueryCommand' ? { Items: [] } : {}))
})

describe('built-in core three (no seeding write)', () => {
  it('keep today’s wording, links, lengths and booking keys', () => {
    const [memorial, bible, lecture] = builtInPrograms()
    expect([memorial.programId, bible.programId, lecture.programId]).toEqual(['memorial', 'bible_class', 'lecture'])
    for (const p of [memorial, bible, lecture]) {
      const id = p.programId as keyof typeof INVITE_TYPE_PHRASE
      expect(p.phrase).toBe(INVITE_TYPE_PHRASE[id])
      expect(p.name).toBe(INVITE_TYPE_LABEL[id])
      expect(p).toMatchObject({ who: 'brethren', where: 'anywhere', active: true, builtIn: true })
    }
    expect(memorial.link).toEqual({ scheduleId: 'memorial', field: 'Exhort' })
    expect(bible.link).toEqual({ scheduleId: 'bibleClass', field: 'Speaker' })
    expect(lecture.link).toBeUndefined()
    expect([memorial.lengthMinutes, bible.lengthMinutes, lecture.lengthMinutes]).toEqual([90, 90, 60])
    // The booking key of a core program is exactly today's.
    expect(speakerInviteKeys.bookingPk('Ecclesia X', 'memorial')).toBe('SPEAKER_BOOKING#Ecclesia X#memorial')
    expect(speakerInviteKeys.bookingPk('Ecclesia X', 'bible_class')).toBe('SPEAKER_BOOKING#Ecclesia X#bible_class')
  })

  it('listPrograms with nothing stored returns the defaults and writes nothing', async () => {
    const programs = await inviteProgramRepository.listPrograms(ECC)
    expect(programs.map((p) => p.programId)).toEqual(['memorial', 'bible_class', 'lecture'])
    const types = mockSend.mock.calls.map((c) => c[0].type)
    expect(types).toEqual(['QueryCommand'])
    expect(mockSend.mock.calls[0][0].params).toMatchObject({
      TableName: 'tee-admin',
      KeyConditionExpression: 'pkey = :apPk',
      ExpressionAttributeValues: { ':apPk': 'INVITE_PROGRAM#example-ecclesia' },
    })
  })

  it('a stored core program replaces its default; stored programs keep their order', async () => {
    const reworded = program({ programId: 'lecture', name: 'Interested friends', phrase: 'share a message with our interested friends', link: undefined, order: 2 })
    mockSend.mockImplementation(async (c: any) =>
      c.type === 'QueryCommand'
        ? { Items: [InviteProgramRepository.toItem('example-ecclesia', reworded), InviteProgramRepository.toItem('example-ecclesia', program())] }
        : {}
    )
    const programs = await inviteProgramRepository.listPrograms(ECC)
    expect(programs.map((p) => p.programId)).toEqual(['memorial', 'bible_class', 'lecture', 'cyc-class'])
    expect(programs.find((p) => p.programId === 'lecture')).toMatchObject({ phrase: 'share a message with our interested friends' })
    expect(programs.find((p) => p.programId === 'lecture')?.builtIn).toBeUndefined()
  })

  it('the pattern is registered with its one writer', () => {
    expect(PATTERNS.invitePrograms.pk({ ecclesiaId: 'example-ecclesia' })).toBe('INVITE_PROGRAM#example-ecclesia')
    expect(PATTERNS.invitePrograms.writer).toBe('packages/app/provider/dynamodb/repositories/invite-program-repository.ts')
  })

  it('mergeWithBuiltIns drops a stray builtIn flag from stored programs', () => {
    const merged = mergeWithBuiltIns([{ ...program(), builtIn: true }])
    expect(merged.find((p) => p.programId === 'cyc-class')?.builtIn).toBeUndefined()
  })
})

describe('validatePrograms (§3a)', () => {
  it('accepts a link to a registered roster field of the same ecclesia', () => {
    expect(validatePrograms([...builtInPrograms(), program()], [CYC_ENTRY])).toEqual([])
  })

  it('refuses a schedule the ecclesia hasn’t connected, and a field that names no person', () => {
    expect(validatePrograms([program()], [])).toEqual([expect.stringContaining('hasn’t connected')])
    expect(validatePrograms([program({ link: { scheduleId: 'cyc', field: 'topic' } })], [CYC_ENTRY])).toEqual([
      expect.stringContaining('no roster field “topic”'),
    ])
  })

  it('a core program may keep its built-in link without a registry; a custom one may not borrow it', () => {
    expect(validatePrograms(builtInPrograms(), [])).toEqual([])
    const borrowing = program({ programId: 'second-exhort', link: { scheduleId: 'memorial', field: 'Exhort' } })
    expect(validatePrograms([borrowing], [])).toEqual([expect.stringContaining('hasn’t connected')])
  })

  it('two ACTIVE programs may not fill the same schedule field; a switched-off one may', () => {
    const twin = program({ programId: 'cyc-twin', name: 'CYC twin' })
    expect(validatePrograms([program(), twin], [CYC_ENTRY])).toEqual([expect.stringContaining('both fill the same schedule field')])
    expect(validatePrograms([program(), { ...twin, active: false }], [CYC_ENTRY])).toEqual([])
  })

  it('parseProgramInput reads plain text, derives an id from the name, and refuses bad shapes', () => {
    const r = parseProgramInput({ name: ' Sister  Class ', phrase: 'share a message at our Sister Class', who: 'sisters', where: 'region', lengthMinutes: 60 }, 4)
    expect(r).toEqual({
      ok: true,
      program: { programId: 'sister-class', name: 'Sister Class', phrase: 'share a message at our Sister Class', who: 'sisters', where: 'region', lengthMinutes: 60, active: true, order: 4 },
    })
    expect(parseProgramInput({ name: 'X class', phrase: 'p', who: 'elders', where: 'region', lengthMinutes: 60 }, 0).ok).toBe(false)
    expect(parseProgramInput({ name: 'X class', phrase: 'p', who: 'anyone', where: 'region', lengthMinutes: 1 }, 0).ok).toBe(false)
    expect(parseProgramInput({ name: 'X class', phrase: '', who: 'anyone', where: 'region', lengthMinutes: 60 }, 0).ok).toBe(false)
  })
})

describe('snapshots and old invites', () => {
  it('a snapshot copies wording, length, who and the resolved slot', () => {
    expect(snapshotOf(program({ about: 'Held at the hall on Friday evenings' }), [CYC_ENTRY])).toEqual({
      name: 'CYC class',
      phrase: 'lead a CYC class',
      about: 'Held at the hall on Friday evenings',
      lengthMinutes: 60,
      who: 'anyone',
      slot: { scheduleType: 'cyc', field: 'speaker' },
    })
    expect(snapshotOf(program({ link: undefined })).slot).toBeUndefined()
  })

  it('an invite sent before programs reads its type’s fixed wording and slot', () => {
    expect(inviteWording({ type: 'bible_class' })).toEqual({ name: 'Bible Class', phrase: 'speak at our Bible Class', lengthMinutes: 90 })
    expect(inviteSlot({ type: 'memorial' })).toEqual(INVITE_TYPE_SLOT.memorial)
    expect(inviteSlot({ type: 'lecture' })).toBeNull()
    // A snapshot wins, including "no slot" on a reworded core id.
    expect(inviteSlot({ type: 'memorial', programSnapshot: { name: 'n', phrase: 'p', lengthMinutes: 30, who: 'brethren' } })).toBeNull()
  })
})

describe('WHO is recorded facts only (§9b) and never widens', () => {
  it('sisters never returns a recorded male; brethren still drops baptized === false', () => {
    expect(isEligibleFor('sisters', { gender: 'male', baptized: true })).toBe(false)
    expect(isEligibleFor('sisters', { gender: undefined, baptized: true })).toBe(false)
    expect(isEligibleFor('sisters', { gender: 'female', baptized: false })).toBe(false)
    expect(isEligibleFor('sisters', { gender: 'female' })).toBe(true)
    expect(isEligibleFor('brethren', { gender: 'male', baptized: false })).toBe(false)
    expect(isEligibleFor('brethren', { gender: 'female', baptized: true })).toBe(false)
    expect(isEligibleFor('brethren', {})).toBe(true)
    expect(isEligibleFor('anyone', { gender: 'female', baptized: false })).toBe(true)
  })
})

describe('filterCandidates — WHERE widens only for a specific name', () => {
  const regions = new Map([
    ['example ecclesia', 'canada_east' as const],
    ['nearby ecclesia', 'canada_east' as const],
    ['faraway ecclesia', 'uk' as const],
  ]) as Map<string, any>
  const people = [
    { personId: 'p-near', displayName: 'Ann Example', ecclesia: 'Nearby Ecclesia', gender: 'female' as const, baptized: true },
    { personId: 'p-far-sister', displayName: 'Ann Sample', ecclesia: 'Faraway Ecclesia', gender: 'female' as const, baptized: true },
    { personId: 'p-far-brother', displayName: 'Brad Tester', ecclesia: 'Faraway Ecclesia', gender: 'male' as const, baptized: true },
  ]
  const ctx = { who: 'brethren' as const, where: 'region' as const, ecclesia: ECC, regions }

  it('in-region matches come first; no widening while the region has some', () => {
    const r = filterCandidates(people, 'Ann Ex', { ...ctx, who: 'sisters' })
    expect(r.candidates.map((c) => c.personId)).toEqual(['p-near'])
    expect(r.outside).toEqual([])
  })

  it('nothing in the region + one word: no widening', () => {
    const r = filterCandidates(people, 'Brad', ctx)
    expect(r).toEqual({ candidates: [], outside: [] })
  })

  it('nothing in the region + first name and the start of a surname: every region, labelled', () => {
    const r = filterCandidates(people, 'Brad Tes', ctx)
    expect(r.candidates).toEqual([])
    expect(r.outside.map((c) => c.personId)).toEqual(['p-far-brother'])
    expect(r.outsideLabel).toBe('Outside Canada East')
  })

  it('widening never crosses WHO: a brethren search never offers sisters, and vice versa', () => {
    // The directory search for "Ann Sam" found only a sister (outside the region).
    expect(filterCandidates([people[1]], 'Ann Sam', ctx)).toEqual({ candidates: [], outside: [] })
    const sisters = filterCandidates([people[2]], 'Brad Tes', { ...ctx, who: 'sisters' })
    expect(sisters.outside.map((c) => c.personId)).toEqual([])
  })

  it('"our ecclesia" widens with the ecclesia as the heading; "anywhere" never needs to', () => {
    const r = filterCandidates(people, 'Ann Exa', { ...ctx, who: 'sisters', where: 'ecclesia' })
    expect(r.outside.map((c) => c.personId)).toEqual(['p-near', 'p-far-sister'])
    expect(r.outsideLabel).toBe(`Outside ${ECC}`)
    expect(filterCandidates(people, 'Brad', { ...ctx, where: 'anywhere' }).candidates.map((c) => c.personId)).toEqual(['p-far-brother'])
  })

  it('isSpecificName needs two words', () => {
    expect(isSpecificName('Jonathan')).toBe(false)
    expect(isSpecificName('Jonathan W')).toBe(true)
    expect(isSpecificName('  Ann   Ex ')).toBe(true)
  })
})
