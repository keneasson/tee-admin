import { describe, it, expect } from 'vitest'
import { buildRecordingBrotherRows } from '@my/app/utils/recording-brother-rows'

const ecc = (name: string, recordingBrotherEmail?: string) => ({ name, city: 'City', province: 'ON', recordingBrotherEmail })
const p = (personId: string, ecclesia: string, displayName = personId, primaryEmail = `${personId}@example.org`) => ({
  personId,
  ecclesia,
  displayName,
  primaryEmail,
})

describe('buildRecordingBrotherRows', () => {
  it("never guesses: an ecclesia's only member is not its Recording Brother", () => {
    const only = p('a1', 'A')
    const { rows } = buildRecordingBrotherRows([ecc('A')], [only], [], [[only]])
    expect(rows[0].current).toBeNull()
    expect(rows[0]).not.toHaveProperty('suggestedPersonId')
    expect(rows[0].people).toEqual([{ personId: 'a1', name: 'a1', email: 'a1@example.org', isContact: true }])
  })

  it('treats a nameless contact as an address on file, not a person', () => {
    const mailbox = p('m', 'A', '', 'TownChristadelphians@example.org')
    const named = p('jf', 'A', 'Jay Sampler')
    const { rows } = buildRecordingBrotherRows([ecc('A')], [mailbox], [], [[mailbox, named]])
    expect(rows[0].people.map((x) => x.personId)).toEqual(['jf'])
    expect(rows[0].addresses).toEqual([
      { email: 'townchristadelphians@example.org', note: 'inter-ecclesia contact (no name)' },
    ])
  })

  it("lists an RB email on file as an address unless it's a named person's own", () => {
    const old = p('old', 'A', 'Old RB', 'old@example.org')
    const kept = buildRecordingBrotherRows([ecc('A', 'office@example.org')], [], [], [[old]]).rows[0]
    expect(kept.addresses).toEqual([{ email: 'office@example.org', note: 'RB email on file' }])
    expect(kept.mailTo).toBe('office@example.org')
    const own = buildRecordingBrotherRows([ecc('A', 'Old@example.org')], [], [], [[old]]).rows[0]
    expect(own.addresses).toEqual([])
  })

  it('shows the current RB and lists contacts first', () => {
    const rb = p('rb', 'A', 'Current RB')
    const { rows } = buildRecordingBrotherRows([ecc('A')], [p('z', 'A', 'Zed')], [rb], [[p('a', 'A', 'Abe'), p('z', 'A', 'Zed'), rb]])
    expect(rows[0].current).toEqual({ personId: 'rb', name: 'Current RB' })
    expect(rows[0].people.map((x) => x.name)).toEqual(['Zed', 'Abe', 'Current RB'])
  })

  it("shows a nameless RB record by its address", () => {
    const rb = p('rb', 'A', '', 'Recorder@example.org')
    const { rows } = buildRecordingBrotherRows([ecc('A')], [], [rb], [[rb]])
    expect(rows[0].current?.name).toBe('recorder@example.org (no name on file)')
  })

  it('the RB office decides: holder, its own address (goes with the role), else the holder primary', () => {
    const flagged = p('flagged', 'A', 'Old Flag')
    const withAddress = buildRecordingBrotherRows([ecc('A', 'legacy@example.org')], [], [flagged], [[]], [
      { holderPersonId: 'h1', holderName: 'Holder', officeEmail: 'Office@A.org', holderEmail: 'h1@example.org' },
    ]).rows[0]
    expect(withAddress.current).toEqual({ personId: 'h1', name: 'Holder' })
    expect(withAddress.mailTo).toBe('office@a.org')
    expect(withAddress.mailToIsOffice).toBe(true)
    expect(withAddress.addresses).toEqual([{ email: 'office@a.org', note: "the ecclesia's address" }])

    const noAddress = buildRecordingBrotherRows([ecc('A')], [], [], [[]], [
      { holderPersonId: 'h1', holderName: 'Holder', holderEmail: 'H1@example.org' },
    ]).rows[0]
    expect(noAddress.mailTo).toBe('h1@example.org')
    expect(noAddress.mailToIsOffice).toBe(false)
  })

  it('lists contacts whose ecclesia matches no ecclesia record', () => {
    const { unmatched } = buildRecordingBrotherRows([ecc('A')], [p('x', 'A Ecclesia'), p('y', '')], [], [[]])
    expect(unmatched.map((u) => u.personId)).toEqual(['x', 'y'])
  })
})
