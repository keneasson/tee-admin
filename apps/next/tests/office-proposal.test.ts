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
  // West: a nameless mailbox and a named RB who uses his own email.
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
  it('keeps a named RB on his own email; a nameless mailbox becomes a vacant Rep office address', () => {
    expect(rowsFor('west')).toEqual([
      { ecclesiaId: 'west', office: 'rb', holderPersonId: 'west-rb', confirmed: true },
      { ecclesiaId: 'west', office: 'rep', inboxFromPersonId: 'west-mailbox', holderPersonId: null, confirmed: true },
      { ecclesiaId: 'west', office: 'rep', holderPersonId: 'west-rep', confirmed: true },
    ])
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
      { ecclesiaId: 'east', office: 'rep', inboxFromPersonId: 'east-mailbox', holderPersonId: null, confirmed: true },
    ])
  })

  it('plans cleanly: no nameless holder, every address reached', () => {
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
      'west-rep@example.org',
      'westmailbox@example.org',
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
