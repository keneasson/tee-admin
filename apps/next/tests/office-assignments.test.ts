/**
 * The office-assignment planner (R3): owner-confirmed rows → office writes,
 * every ecclesia gets an RB office, no nameless or test-account holder, and
 * the predicted inter-ecclesia recipients can be diffed against today's path.
 */
import { describe, it, expect } from 'vitest'
import {
  legacyInterEcclesiaRecipients,
  planOfficeAssignments,
  predictInterEcclesiaContacts,
  type PersonSnapshot,
} from '@my/app/provider/dynamodb/repositories/office-assignments'
import { diffRecipientAddresses, type OfficeRecord } from '@my/app/provider/dynamodb/repositories/office-repository'

const persons = new Map<string, PersonSnapshot>([
  ['named', { personId: 'named', named: true, primaryEmail: 'named@x.org' }],
  ['mailbox', { personId: 'mailbox', named: false, primaryEmail: 'Mailbox@East.org' }],
  ['tester', { personId: 'tester', named: true, primaryEmail: 'me+hacker@x.org' }],
])

const plan = (assignments: any[], existingOffices: OfficeRecord[] = []) =>
  planOfficeAssignments({ file: { assignments }, ecclesiaIds: ['east', 'west'], persons, existingOffices })

describe('planOfficeAssignments', () => {
  it('creates a vacant RB office for every ecclesia with no assignment', () => {
    const p = plan([])
    expect(p.errors).toEqual([])
    expect(p.actions).toEqual([
      { op: 'createOffice', ecclesiaId: 'east', officeId: 'rb', reason: 'rb-missing' },
      { op: 'createOffice', ecclesiaId: 'west', officeId: 'rb', reason: 'rb-missing' },
    ])
  })

  it('applies only confirmed rows: holder, office inbox copied from a mailbox record, next Rep slot', () => {
    const p = plan([
      { ecclesiaId: 'east', office: 'rb', holderPersonId: 'named', confirmed: true },
      { ecclesiaId: 'east', office: 'rep', inboxFromPersonId: 'mailbox', confirmed: true },
      { ecclesiaId: 'east', office: 'rep', inbox: 'second@east.org', confirmed: true },
      { ecclesiaId: 'west', office: 'rb', holderPersonId: 'named' },
    ])
    expect(p.errors).toEqual([])
    expect(p.skippedUnconfirmed).toBe(1)
    expect(p.actions).toEqual([
      { op: 'createOffice', ecclesiaId: 'east', officeId: 'rb', reason: 'assignment' },
      { op: 'assignHolder', ecclesiaId: 'east', officeId: 'rb', personId: 'named' },
      { op: 'createOffice', ecclesiaId: 'east', officeId: 'rep#1', reason: 'assignment' },
      { op: 'setChannels', ecclesiaId: 'east', officeId: 'rep#1', email: 'mailbox@east.org' },
      { op: 'createOffice', ecclesiaId: 'east', officeId: 'rep#2', reason: 'assignment' },
      { op: 'setChannels', ecclesiaId: 'east', officeId: 'rep#2', email: 'second@east.org' },
      { op: 'createOffice', ecclesiaId: 'west', officeId: 'rb', reason: 'rb-missing' },
    ])
  })

  it('is idempotent: re-planning the same file against its result is a no-op', () => {
    const rows = [
      { ecclesiaId: 'east', office: 'rb', holderPersonId: 'named', confirmed: true },
      { ecclesiaId: 'east', office: 'rep', inboxFromPersonId: 'mailbox', confirmed: true },
    ]
    const first = plan(rows)
    expect(plan(rows, first.offices).actions).toEqual([])
  })

  it('refuses nameless holders, test accounts, unknown ids and a second RB row', () => {
    const p = plan([
      { ecclesiaId: 'east', office: 'rb', holderPersonId: 'mailbox', confirmed: true },
      { ecclesiaId: 'east', office: 'rep#1', holderPersonId: 'tester', confirmed: true },
      { ecclesiaId: 'east', office: 'rep#2', inbox: 'x+hacker@x.org', confirmed: true },
      { ecclesiaId: 'nowhere', office: 'rb', confirmed: true },
      { ecclesiaId: 'west', office: 'rb', holderPersonId: 'ghost', confirmed: true },
      { ecclesiaId: 'west', office: 'rb#2', confirmed: true },
      { ecclesiaId: 'west', office: 'rb', confirmed: true },
      { ecclesiaId: 'west', office: 'rb', confirmed: true },
    ])
    expect(p.errors.map((e) => e.row)).toEqual([1, 2, 3, 4, 5, 6, 8])
    expect(JSON.stringify(p.errors)).not.toMatch(/@/)
    // Errored rows write nothing; both ecclesias still end with an RB office.
    expect(p.actions.filter((a) => a.op !== 'createOffice')).toEqual([])
    expect(p.offices.filter((o) => o.kind === 'rb').map((o) => o.ecclesiaId).sort()).toEqual(['east', 'west'])
  })

  it('predicts the recipients and diffs them against today’s isInterEcclesiaRep addresses', () => {
    const p = plan([
      { ecclesiaId: 'east', office: 'rb', holderPersonId: 'named', confirmed: true },
      { ecclesiaId: 'east', office: 'rep', inboxFromPersonId: 'mailbox', confirmed: true },
    ])
    // Only the RB office receives: the Rep office's mailbox doesn't.
    const predicted = predictInterEcclesiaContacts(p, persons)
    const today = legacyInterEcclesiaRecipients([
      { personId: 'mailbox', primaryEmail: 'mailbox@east.org', isInterEcclesiaRep: true },
      { personId: 'tester', primaryEmail: 'me+hacker@x.org', isInterEcclesiaRep: true },
      { personId: 'named', primaryEmail: 'named@x.org' },
    ])
    expect([...today.keys()]).toEqual(['mailbox@east.org'])
    const diff = diffRecipientAddresses(today.keys(), predicted.flatMap((c) => (c.email ? [c.email] : [])))
    expect(diff).toEqual({ same: 0, onlyLegacy: ['mailbox@east.org'], onlyOffices: ['named@x.org'] })
  })
})
