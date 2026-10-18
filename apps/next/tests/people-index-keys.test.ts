import { describe, it, expect } from 'vitest'
import {
  derivePersonProjections,
  deriveEcclesiaProjections,
  diffProjections,
  ecclesiaIdOf,
  isProjectionKey,
  nameTokens,
  slugifyEcclesia,
} from '@my/app/provider/dynamodb/people-index/keys'

const profile = {
  pkey: 'PERSON#p1',
  skey: 'PROFILE',
  personId: 'p1',
  primaryEmail: 'A@Example.org',
  firstName: 'Zoë',
  lastName: "O'Brien-Smith",
  displayName: "Zoë O'Brien-Smith",
  ecclesia: 'Toronto East Ecclesia',
  role: 'member',
  memberStatus: 'member',
}

describe('people-index keys', () => {
  it('folds names into distinct search tokens', () => {
    expect(nameTokens('Zoë', "O'Brien-Smith")).toEqual(['zoe', 'obrien', 'smith'])
    expect(nameTokens('  ', null, undefined)).toEqual([])
    expect(nameTokens('Ann', 'ann')).toEqual(['ann'])
  })

  it('derives a stable ecclesia id from the stored id, else the name slug', () => {
    expect(slugifyEcclesia('Detroit (Milford Rd.)')).toBe('detroit-milford-rd')
    expect(slugifyEcclesia("Schooley's Mountain Ecclesia")).toBe('schooleys-mountain-ecclesia')
    expect(slugifyEcclesia('')).toBe('none')
    expect(ecclesiaIdOf({ name: 'New Name', ecclesiaId: 'old-name' })).toBe('old-name')
    expect(ecclesiaIdOf({ name: 'Toronto East Ecclesia' })).toBe('toronto-east-ecclesia')
  })

  it('derives a CARD with the roster and ecclesia index entries', () => {
    const items = derivePersonProjections({
      profile,
      emails: [
        { skey: 'EMAIL#b', email: 'Second@x.org', emailType: 'secondary', order: 1 },
        { skey: 'EMAIL#a', email: 'a@example.org', emailType: 'primary', order: 0, sesStatus: 'active' },
      ],
      phones: [
        { skey: 'PHONE#2', number: '(905) 555-0002', order: 1 },
        { skey: 'PHONE#1', number: '416-555-0001', order: 0, isPrimary: true },
      ],
      ecclesiaId: 'toronto-east-ecclesia',
    })
    const card = items.find((i) => i.skey === 'CARD')!
    expect(card).toMatchObject({
      pkey: 'PERSON#p1',
      personId: 'p1',
      primaryEmail: 'a@example.org',
      primaryPhone: '416-555-0001',
      phoneDigits: ['4165550001', '9055550002'],
      ecclesiaId: 'toronto-east-ecclesia',
      gsi4pk: 'PEOPLE#ALL',
      gsi4sk: 'obrien-smith#zoe#p1',
      gsi2pk: 'ECCPEOPLE#toronto-east-ecclesia',
    })
    expect(card.emails.map((e: any) => e.email)).toEqual(['a@example.org', 'second@x.org'])
  })

  it('writes one NAMETOK item per name word, keyed on its first two letters', () => {
    const tokens = derivePersonProjections({ profile, emails: [], phones: [], ecclesiaId: 'e' }).filter((i) =>
      i.skey.startsWith('NAMETOK#')
    )
    expect(tokens.map((t) => [t.skey, t.gsi3pk, t.gsi3sk])).toEqual([
      ['NAMETOK#zoe', 'NAMEPFX#ALL#zo', 'zoe#p1'],
      ['NAMETOK#obrien', 'NAMEPFX#ALL#ob', 'obrien#p1'],
      ['NAMETOK#smith', 'NAMEPFX#ALL#sm', 'smith#p1'],
    ])
    // Narrow: the name floor only, never contact details.
    expect(Object.keys(tokens[0]).sort()).toEqual(
      ['displayName', 'ecclesia', 'gsi3pk', 'gsi3sk', 'personId', 'pkey', 'role', 'schemaVersion', 'skey', 'tokens', 'type'].sort()
    )
  })

  it('writes REP office references (both directions) only for a rep', () => {
    const none = derivePersonProjections({ profile, emails: [], phones: [], ecclesiaId: 'e1' })
    expect(none.some((i) => i.skey.startsWith('OFFICE#'))).toBe(false)
    const rep = derivePersonProjections({
      profile: { ...profile, isInterEcclesiaRep: true },
      emails: [],
      phones: [],
      ecclesiaId: 'e1',
    })
    const refs = rep.filter((i) => i.type === 'OFFICE_REF').map((i) => [i.pkey, i.skey])
    expect(refs).toEqual([
      ['ECCLESIA_ID#e1', 'OFFICE#REP#p1'],
      ['PERSON#p1', 'OFFICE#e1#REP'],
    ])
  })

  it('derives the ecclesia alias/directory entry and the RB office reference', () => {
    const items = deriveEcclesiaProjections(
      {
        pkey: 'ECCLESIA#CA|ON',
        skey: 'Toronto#Toronto East Ecclesia',
        name: 'Toronto East Ecclesia',
        country: 'CA',
        province: 'ON',
        city: 'Toronto',
        recordingBrotherPersonId: 'p9',
        recordingBrotherEmail: 'RB@Example.org',
      },
      'toronto-east-ecclesia'
    )
    expect(items[0]).toMatchObject({
      pkey: 'ECCLESIA_ID#toronto-east-ecclesia',
      skey: 'ECCLESIA',
      ecclesiaPkey: 'ECCLESIA#CA|ON',
      ecclesiaSkey: 'Toronto#Toronto East Ecclesia',
      gsi2pk: 'ECCLESIAS',
      gsi2sk: 'CA|ON|Toronto#Toronto East Ecclesia',
      gsi1pk: 'RBEMAIL#rb@example.org',
      gsi1sk: 'ECCLESIA',
    })
    expect(items.slice(1).map((i) => [i.pkey, i.skey])).toEqual([
      ['ECCLESIA_ID#toronto-east-ecclesia', 'OFFICE#RB#p9'],
      ['PERSON#p9', 'OFFICE#toronto-east-ecclesia#RB'],
    ])
    // No RB email → no sign-in index entry.
    const bare = deriveEcclesiaProjections({ pkey: 'ECCLESIA#CA|ON', skey: 'X#X', name: 'X' }, 'x')
    expect(bare[0].gsi1pk).toBeUndefined()
  })

  it('treats only projection keys as writable', () => {
    for (const source of [
      { pkey: 'PERSON#p1', skey: 'PROFILE' },
      { pkey: 'PERSON#p1', skey: 'EMAIL#e' },
      { pkey: 'PERSON#p1', skey: 'PHONE#x' },
      { pkey: 'PERSON#p1', skey: 'TOKEN#otp#1' },
      { pkey: 'ECCLESIA#CA|ON', skey: 'Toronto#Toronto East Ecclesia' },
      { pkey: 'USER#a@b.c', skey: 'USER' },
    ]) {
      expect(isProjectionKey(source)).toBe(false)
    }
    for (const proj of [
      { pkey: 'PERSON#p1', skey: 'CARD' },
      { pkey: 'PERSON#p1', skey: 'NAMETOK#zoe' },
      { pkey: 'PERSON#p1', skey: 'OFFICE#e#REP' },
      { pkey: 'PERSON#p1', skey: 'OFFICE#e#RB' },
      { pkey: 'ECCLESIA_ID#e', skey: 'ECCLESIA' },
      { pkey: 'ECCLESIA_ID#e', skey: 'OFFICE#RB#p1' },
      { pkey: 'PEOPLE_INDEX#META', skey: 'BUILD' },
    ]) {
      expect(isProjectionKey(proj)).toBe(true)
    }
  })

  it('diffs idempotently', () => {
    const desired = derivePersonProjections({ profile, emails: [], phones: [], ecclesiaId: 'e' })
    const first = diffProjections([], desired)
    expect(first.puts).toHaveLength(desired.length)
    const stored = desired.map((d) => ({ ...d, projectedAt: '2026-10-17T00:00:00Z' }))
    const second = diffProjections(stored, desired)
    expect(second).toEqual({ puts: [], deletes: [], unchanged: desired.length })
    const renamed = derivePersonProjections({ profile: { ...profile, firstName: 'Zed' }, emails: [], phones: [], ecclesiaId: 'e' })
    const third = diffProjections(stored, renamed)
    expect(third.deletes).toEqual([{ pkey: 'PERSON#p1', skey: 'NAMETOK#zoe' }])
    expect(third.puts.map((p) => p.skey).sort()).toEqual(['CARD', 'NAMETOK#obrien', 'NAMETOK#smith', 'NAMETOK#zed'].sort())
  })
})
