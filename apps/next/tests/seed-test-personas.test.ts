/**
 * The seed plan for test personas (#349): complete on an empty database,
 * empty when everything exists (idempotent), and refuses to touch an address
 * that belongs to an unflagged record. Pure; nothing is read or written.
 */
import { describe, it, expect } from 'vitest'
import { planSeed, type SeedState } from '../../../scripts/seed-test-personas'
import { TEST_PERSONAS } from '@my/app/utils/test-personas'

const empty = (): SeedState => ({
  ecclesiaExists: false,
  people: Object.fromEntries(TEST_PERSONAS.map((p) => [p.email, null])),
  offices: {},
})

const full = (): SeedState => ({
  ecclesiaExists: true,
  people: Object.fromEntries(TEST_PERSONAS.map((p) => [p.email, { personId: 'id-' + p.key, isTestPersona: true }])),
  offices: {
    rb: { exists: true, holderPersonId: 'id-recording-brother' },
    'rep#1': { exists: true, holderPersonId: 'id-rep' },
  },
})

describe('planSeed', () => {
  it('on an empty database plans the ecclesia, every persona and both offices', () => {
    const { actions, errors } = planSeed(empty())
    expect(errors).toEqual([])
    expect(actions.filter((a) => a.op === 'createEcclesia')).toHaveLength(1)
    expect(actions.filter((a) => a.op === 'createPerson')).toHaveLength(TEST_PERSONAS.length)
    expect(actions.filter((a) => a.op === 'createOffice').map((a: any) => a.role).sort()).toEqual(['rb', 'rep#1'])
    expect(actions.filter((a) => a.op === 'assignOffice').map((a: any) => a.role).sort()).toEqual(['rb', 'rep#1'])
  })

  it('is idempotent: when everything exists it plans nothing', () => {
    expect(planSeed(full())).toEqual({ actions: [], errors: [] })
  })

  it('plans only what is missing', () => {
    const state = full()
    state.people['guest@test-personas.invalid'] = null
    const { actions } = planSeed(state)
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ op: 'createPerson' })
  })

  it('refuses (plans nothing) when a persona address belongs to an unflagged record', () => {
    const state = full()
    state.people['owner@test-personas.invalid'] = { personId: 'someone' }
    const { actions, errors } = planSeed(state)
    expect(actions).toEqual([])
    expect(errors).toHaveLength(1)
  })

  it('only ever targets the test ecclesia and .invalid addresses', () => {
    expect(TEST_PERSONAS.every((p) => p.email.endsWith('@test-personas.invalid'))).toBe(true)
    expect(TEST_PERSONAS.filter((p) => p.office).every((p) => p.ecclesia === 'Test Ecclesia (preview)')).toBe(true)
  })
})
