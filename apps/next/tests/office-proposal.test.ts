/**
 * Drafting the R3 office assignments from today's data: a nameless record is
 * an address (on an office), never an office holder; named people who receive
 * inter-ecclesia mail keep receiving it through an office.
 */
import { describe, it, expect } from 'vitest'
import {
  planOfficeAssignments,
  predictInterEcclesiaContacts,
  proposeOfficeAssignments,
  registryListRecipients,
  type ProposalPerson,
} from '@my/app/provider/dynamodb/repositories/office-assignments'

const ecclesias = [
  { ecclesiaId: 'west', name: 'West Ecclesia' },
  { ecclesiaId: 'north', name: 'North Ecclesia', recordingBrotherEmail: 'Office@North.org' },
  { ecclesiaId: 'east', name: 'East Ecclesia' },
]
const person = (x: Partial<ProposalPerson> & { personId: string }): ProposalPerson => ({
  named: true,
  primaryEmail: `${x.personId}@example.org`,
  ...x,
})

const persons: ProposalPerson[] = [
  // West: a nameless mailbox and a named RB (Toronto West: 24langside@ and Dev).
  person({ personId: 'west-mailbox', ecclesia: 'West Ecclesia', named: false, primaryEmail: 'westmailbox@example.org', isInterEcclesiaRep: true }),
  person({ personId: 'west-rb', ecclesia: 'West Ecclesia', isRecordingBrother: true }),
  person({ personId: 'west-rep', ecclesia: 'West Ecclesia', isRepRole: true }),
  person({ personId: 'west-out', ecclesia: 'West Ecclesia', isInterEcclesiaRep: true, optedOutInterEcclesia: true }),
  // North: an RB email on the ecclesia that no named person holds; a nameless "RB".
  person({ personId: 'north-ghost', ecclesia: 'North Ecclesia', named: false, primaryEmail: 'ghost@north.org', isRecordingBrother: true }),
  // East: only a nameless mailbox, and a subscriber at an unknown ecclesia.
  person({ personId: 'east-mailbox', ecclesia: 'East Ecclesia', named: false, primaryEmail: 'eastmailbox@example.org', isInterEcclesiaRep: true }),
  person({ personId: 'elsewhere', ecclesia: 'Montreal Ecclesia', receivesInterEcclesia: true }),
]

const propose = (existingOffices: any[] = []) => proposeOfficeAssignments({ ecclesias, persons, existingOffices })
const rowsFor = (id: string, existing: any[] = []) => propose(existing).file.assignments.filter((r) => r.ecclesiaId === id)

describe('proposeOfficeAssignments', () => {
  it("never assumes a shared ecclesia address for a named RB: it's the ecclesia's choice", () => {
    expect(rowsFor('west')).toEqual([
      { ecclesiaId: 'west', office: 'rb', holderPersonId: 'west-rb', confirmed: true },
      { ecclesiaId: 'west', office: 'rep', holderPersonId: 'west-rep', confirmed: true },
    ])
    // West's mailbox and North's copied RB email aren't on an RB office: the owner chooses.
    expect(propose().toChoose).toEqual(['north', 'west'])
  })

  it("keeps the ecclesia's choice from the Recording Brothers page: a shared address, or the RB's own email", () => {
    const shared = [{ ecclesiaId: 'west', kind: 'rb', role: 'rb', email: 'westmailbox@example.org', holderPersonId: 'west-rb' }]
    expect(rowsFor('west', shared).filter((r) => r.office === 'rb')).toEqual([{ ecclesiaId: 'west', office: 'rb', confirmed: true }])
    expect(rowsFor('west', shared).some((r) => r.inboxFromPersonId === 'west-mailbox')).toBe(false)

    const own = [{ ecclesiaId: 'west', kind: 'rb', role: 'rb', email: null, holderPersonId: 'west-rb' }]
    expect(rowsFor('west', own).filter((r) => r.office === 'rb')).toEqual([{ ecclesiaId: 'west', office: 'rb', confirmed: true }])
    expect(propose(own).toChoose).toEqual(['north'])
  })

  it('with a named RB, the copied RB email is not put on his office: the owner chooses', () => {
    const named = [person({ personId: 'n-rb', ecclesia: 'North Ecclesia', isRecordingBrother: true })]
    const p = proposeOfficeAssignments({ ecclesias, persons: named, existingOffices: [] })
    expect(p.file.assignments.filter((r) => r.ecclesiaId === 'north')).toEqual([
      { ecclesiaId: 'north', office: 'rb', holderPersonId: 'n-rb', confirmed: true },
    ])
    expect(p.toChoose).toEqual(['north'])
  })

  it("with several nameless addresses it doesn't guess: none is put on the RB office, the owner chooses", () => {
    const two = [
      person({ personId: 'a', ecclesia: 'West Ecclesia', named: false, primaryEmail: 'a@x.org', isInterEcclesiaRep: true }),
      person({ personId: 'b', ecclesia: 'West Ecclesia', named: false, primaryEmail: 'b@x.org', isInterEcclesiaRep: true }),
      person({ personId: 'rb', ecclesia: 'West Ecclesia', isRecordingBrother: true }),
    ]
    const rows = proposeOfficeAssignments({ ecclesias, persons: two, existingOffices: [] }).file.assignments
    expect(rows.filter((r) => r.ecclesiaId === 'west')).toEqual([
      { ecclesiaId: 'west', office: 'rb', holderPersonId: 'rb', confirmed: true },
    ])
  })

  it("a nameless duplicate of a named person (same address) is retired, not an ecclesia address", () => {
    const dup = [
      person({ personId: 'martin', ecclesia: 'West Ecclesia', primaryEmail: 'martin@x.org', isInterEcclesiaRep: true }),
      person({ personId: 'martin-dup', ecclesia: 'West Ecclesia', named: false, primaryEmail: 'martin@x.org', isInterEcclesiaRep: true }),
    ]
    const p = proposeOfficeAssignments({ ecclesias, persons: dup, existingOffices: [] })
    expect(p.namelessToRetire).toContain('martin-dup')
    expect(p.file.assignments.some((r) => r.inboxFromPersonId === 'martin-dup')).toBe(false)
  })

  it('never gives a Rep office to someone who opted out of the inter-ecclesia list', () => {
    expect(rowsFor('west').some((r) => r.holderPersonId === 'west-out')).toBe(false)
  })

  it('a nameless "Recording Brother" is an address on the RB office, never its holder', () => {
    expect(rowsFor('north')).toEqual([
      { ecclesiaId: 'north', office: 'rb', holderPersonId: null, inboxFromPersonId: 'north-ghost', confirmed: true },
    ])
  })

  it("with no named RB, the ecclesia's mailbox is the RB office's own address", () => {
    expect(rowsFor('east')).toEqual([
      { ecclesiaId: 'east', office: 'rb', holderPersonId: null, inboxFromPersonId: 'east-mailbox', confirmed: true },
    ])
  })

  it('reports nameless records to retire in R8 and recipients at unknown ecclesias', () => {
    const p = propose()
    expect(p.namelessToRetire).toEqual(['east-mailbox', 'north-ghost', 'west-mailbox'])
    expect(p.unmatchedContacts).toEqual(['elsewhere'])
  })

  it('keeps an RB office the owner already set, and its address', () => {
    const existing = [{ ecclesiaId: 'east', kind: 'rb', role: 'rb', email: 'set@east.org', holderPersonId: 'someone' }]
    const p = propose(existing)
    expect(p.keptRbHolders).toBe(1)
    expect(p.file.assignments.filter((r) => r.ecclesiaId === 'east')).toEqual([
      { ecclesiaId: 'east', office: 'rb', confirmed: true },
    ])
  })

  it('plans cleanly: no nameless holder; only RB offices are reached', () => {
    const snapshots = new Map(persons.map((p) => [p.personId, { personId: p.personId, named: p.named, primaryEmail: p.primaryEmail }]))
    const plan = planOfficeAssignments({
      file: propose().file,
      ecclesiaIds: ecclesias.map((e) => e.ecclesiaId),
      persons: snapshots,
      existingOffices: [],
    })
    expect(plan.errors).toEqual([])
    const reached = predictInterEcclesiaContacts(plan, snapshots).map((c) => c.email).sort()
    expect(reached).toEqual([
      'eastmailbox@example.org',
      'ghost@north.org',
      'west-rb@example.org',
    ])
  })
})

describe('registryListRecipients', () => {
  it("is the list's opt-in rows by address, with opt-outs reported", () => {
    const items = [
      { pkey: 'LIST#L1', skey: 'DETAILS', key: 'interEcclesia', listId: 'L1' },
      { pkey: 'PERSON#a', skey: 'SUB#L1#e1', email: 'A@x.org', status: 'opt_in' },
      { pkey: 'PERSON#b', skey: 'SUB#L1#e2', email: 'b@x.org', status: 'opt_out' },
      { pkey: 'PERSON#c', skey: 'SUB#L2#e3', email: 'c@x.org', status: 'opt_in' },
      { pkey: 'PERSON#d', skey: 'SUB#L1#e4', email: 'me+hacker@x.org', status: 'opt_in' },
    ]
    const r = registryListRecipients(items, 'interEcclesia')
    expect(r.listId).toBe('L1')
    expect([...r.byAddress]).toEqual([['a@x.org', ['a']]])
    expect([...r.optedOut]).toEqual(['b'])
    expect(registryListRecipients(items, 'nope').listId).toBeNull()
  })
})
