import { describe, it, expect } from 'vitest'
import {
  describeHeadsUpProblem,
  describeHeadsUpFailure,
  renderHeadsUpProblemEmail,
} from '../utils/email/exhorter-heads-up-problem'

/** #332: every outcome that leaves no review copy is explained to a person. */

const BASE = 'https://site.example'

describe('describeHeadsUpProblem', () => {
  it('not-found names the schedule entry and points at the preferred name', () => {
    const p = describeHeadsUpProblem({ status: 'unresolved', matchStatus: 'not-found', exhortName: 'Ben Sample' })!
    expect(p.headline).toContain('"Ben Sample"')
    expect(p.fix.join(' ')).toMatch(/preferred first and last name/)
  })

  it('typo lists the close people', () => {
    const p = describeHeadsUpProblem({
      status: 'unresolved',
      matchStatus: 'typo',
      exhortName: 'Brad Testr',
      candidates: [{ personId: 'p1', name: 'Brad Tester', ecclesia: 'Toronto East Ecclesia' }],
    })!
    expect(p.candidates).toHaveLength(1)
    expect(p.headline).toMatch(/isn't an exact match/)
  })

  it('ambiguous says how many people share the name', () => {
    const p = describeHeadsUpProblem({
      status: 'unresolved',
      matchStatus: 'ambiguous',
      exhortName: 'John Smith',
      candidates: [
        { personId: 'a', name: 'John Smith', ecclesia: 'East' },
        { personId: 'b', name: 'John Smith', ecclesia: 'West' },
      ],
    })!
    expect(p.headline).toMatch(/More than one person/)
    expect(p.details[0]).toMatch(/2 people/)
  })

  it.each(['skipped:no-email', 'no-schedule-row', 'skipped:placeholder', 'skipped:needs-review'] as const)(
    '%s is explained',
    (status) => {
      expect(describeHeadsUpProblem({ status, exhortName: 'Brad Tester', personId: 'p1' })).not.toBeNull()
    }
  )

  it.each(['dry-run', 'sent', 'skipped:already-sent', 'skipped:past-date'] as const)(
    '%s needs nobody to act',
    (status) => {
      expect(describeHeadsUpProblem({ status })).toBeNull()
    }
  )
})

describe('renderHeadsUpProblemEmail', () => {
  it('links the check-again page for the Sunday and each candidate', () => {
    const problem = describeHeadsUpProblem({
      status: 'unresolved',
      matchStatus: 'typo',
      exhortName: 'Brad Testr',
      candidates: [{ personId: 'p-1', name: 'Brad Tester' }],
    })!
    const email = renderHeadsUpProblemEmail({ problem, date: '2026-11-29', baseUrl: BASE })
    expect(email.subject).toBe('Exhortation heads-up for Sun, Nov 29 was not sent — please check')
    expect(email.html).toContain(`${BASE}/admin/exhorter-heads-up?date=2026-11-29`)
    expect(email.html).toContain(`${BASE}/people/p-1`)
    expect(email.text).toContain(`${BASE}/admin/exhorter-heads-up?date=2026-11-29`)
  })

  it('escapes schedule text in the HTML', () => {
    const problem = describeHeadsUpProblem({
      status: 'unresolved',
      matchStatus: 'not-found',
      exhortName: '<b>x</b>',
    })!
    const { html } = renderHeadsUpProblemEmail({ problem, date: '2026-11-29', baseUrl: BASE })
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })

  it('a job failure still produces an email', () => {
    const email = renderHeadsUpProblemEmail({ problem: describeHeadsUpFailure(), date: '2026-11-29', baseUrl: BASE })
    expect(email.text).toMatch(/ran into an error/)
  })
})
