/**
 * The ecclesia merge: the dry run is the exact change list, blockers stop it,
 * and the real run issues exactly those writes, source deleted LAST.
 * Placeholder data only (no real people or addresses).
 */
import { describe, it, expect, vi } from 'vitest'
import {
  applyMergePlan,
  buildMergePlan,
  repointPostBlocks,
  type MergeSnapshot,
  type MergeWriters,
} from '../utils/ecclesia-merge'
import type { EcclesiaData } from '../utils/dynamodb/locations'

const eccl = (name: string, extra: Partial<EcclesiaData> = {}): EcclesiaData => ({
  name,
  country: 'CA',
  province: 'ON',
  city: 'Placeville',
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...extra,
})

const office = (ecclesiaId: string, role: string, extra: Record<string, any> = {}): any => ({
  pkey: `ECCLESIA_ID#${ecclesiaId}`,
  skey: `OFFICE#${role}`,
  type: 'OFFICE',
  ecclesiaId,
  role,
  kind: role.split('#')[0],
  ...(role.includes('#') ? { slot: Number(role.split('#')[1]) } : {}),
  title: role === 'rb' ? 'Recording Brother' : 'Inter-Ecclesia Rep',
  terms: [],
  createdAt: '',
  updatedAt: '',
  version: 3,
  ...extra,
})

function snapshot(over: Partial<MergeSnapshot> = {}): MergeSnapshot {
  const source = eccl('Example County Ecclesia', { phone: '555-0100', recordingBrotherName: 'stale' } as any)
  const target = eccl('Example County', { address: '1 Placeholder St' })
  const neighbour = eccl('Neighbour Ecclesia', { nearbyEcclesias: ['Example County Ecclesia', 'Example County', 'Other'] })
  return {
    source,
    target,
    allEcclesias: [source, target, neighbour],
    people: [{ personId: 'p-1', ecclesia: 'Example County Ecclesia', displayName: 'Person One' }],
    sourceOffices: [
      office('example-county-ecclesia', 'rb', { email: 'rb-office@example.org' }),
      office('example-county-ecclesia', 'rep#1'),
    ],
    targetOffices: [office('example-county', 'rb')],
    posts: [
      {
        id: 'post-1',
        title: 'Placeholder gathering',
        tenant: 'Toronto East Ecclesia',
        blocks: [
          { id: 'b1', kind: 'location', mode: 'ecclesia', ecclesiaRef: 'Example County Ecclesia', ecclesiaId: 'example-county-ecclesia', venueName: 'Example County Ecclesia' },
          { id: 'b2', kind: 'location', mode: 'plain', venueName: 'Somewhere Else' },
        ],
      } as any,
      { id: 'post-2', title: 'Owned by the duplicate', tenant: 'Example County Ecclesia', blocks: [] } as any,
      { id: 'post-3', title: 'Unrelated', tenant: 'Toronto East Ecclesia', blocks: [] } as any,
    ],
    events: [
      { id: 'ev-1', title: 'Hosted there', hostingEcclesia: { name: 'Example County Ecclesia' } } as any,
      { id: 'ev-2', title: 'Elsewhere', hostingEcclesia: { name: 'Other' } } as any,
    ],
    sourceLists: [],
    targetLists: [],
    openNominations: [{ nominationId: 'nom-1', ecclesia: 'Example County Ecclesia' }],
    scheduleSources: 0,
    storedInvitePrograms: 0,
    speakerInvites: 0,
    ...over,
  }
}

describe('repointPostBlocks', () => {
  it('re-points blocks that name or reference the source, and only those', () => {
    const { blocks, changed } = repointPostBlocks(
      snapshot().posts[0].blocks,
      { name: 'Example County Ecclesia', ecclesiaId: 'example-county-ecclesia' },
      { name: 'Example County', ecclesiaId: 'example-county' }
    )
    expect(changed).toBe(1)
    expect(blocks[0]).toMatchObject({ ecclesiaRef: 'Example County', ecclesiaId: 'example-county', venueName: 'Example County' })
    expect(blocks[1]).toEqual({ id: 'b2', kind: 'location', mode: 'plain', venueName: 'Somewhere Else' })
  })
})

describe('buildMergePlan — the dry run', () => {
  it('produces the exact re-point list', () => {
    const plan = buildMergePlan(snapshot())
    expect(plan.source).toEqual({ name: 'Example County Ecclesia', ecclesiaId: 'example-county-ecclesia' })
    expect(plan.target).toEqual({ name: 'Example County', ecclesiaId: 'example-county' })
    expect(plan.blockers).toEqual([])
    expect(plan.steps.map((s) => s.kind)).toEqual([
      'copy-fields',
      'office',
      'office',
      'person',
      'post',
      'post',
      'event',
      'neighbour-list',
      'withdraw-nomination',
      'delete-source',
    ])
    expect(plan.steps[0]).toEqual({ kind: 'copy-fields', fields: ['phone'], values: { phone: '555-0100' } })
    // RB office inbox moves onto the target's (vacant, no-inbox) RB office; the empty Rep office is dropped.
    expect(plan.steps[1]).toMatchObject({ kind: 'office', sourceRole: 'rb', action: 'fill-existing', targetRole: 'rb', copy: ['email'], email: 'rb-office@example.org' })
    expect(plan.steps[2]).toMatchObject({ kind: 'office', sourceRole: 'rep#1', action: 'drop-empty', copy: [] })
    expect(plan.steps[3]).toEqual({ kind: 'person', personId: 'p-1', displayName: 'Person One', from: 'Example County Ecclesia', to: 'Example County' })
    expect(plan.steps[4]).toMatchObject({ kind: 'post', postId: 'post-1', rehome: false, blocksChanged: 1 })
    expect(plan.steps[5]).toMatchObject({ kind: 'post', postId: 'post-2', rehome: true, blocksChanged: 0 })
    expect(plan.steps[6]).toEqual({ kind: 'event', eventId: 'ev-1', title: 'Hosted there', fields: ['hostingEcclesia'] })
    expect(plan.steps[7]).toEqual({ kind: 'neighbour-list', ecclesiaName: 'Neighbour Ecclesia', field: 'nearbyEcclesias', value: ['Example County', 'Other'] })
    expect(plan.steps[9]).toEqual({ kind: 'delete-source', name: 'Example County Ecclesia', ecclesiaId: 'example-county-ecclesia' })
    expect(plan.summary).toEqual({
      people: 1,
      offices: 1,
      posts: 2,
      events: 1,
      mailingLists: 0,
      neighbourLists: 1,
      nominationsWithdrawn: 1,
      fieldsCopied: ['phone'],
    })
  })

  it('never copies the stale Recording Brother name/email copies', () => {
    const plan = buildMergePlan(snapshot())
    const copied = plan.steps.find((s) => s.kind === 'copy-fields') as any
    expect(Object.keys(copied.values)).not.toContain('recordingBrotherName')
    expect(Object.keys(copied.values)).not.toContain('recordingBrotherEmail')
  })

  it('a held office on both sides: target kept, warned; a second Rep gets its own slot', () => {
    const plan = buildMergePlan(
      snapshot({
        sourceOffices: [
          office('example-county-ecclesia', 'rb', { holderPersonId: 'p-src', email: 'a@example.org' }),
          office('example-county-ecclesia', 'rep#1', { holderPersonId: 'p-rep' }),
        ],
        targetOffices: [
          office('example-county', 'rb', { holderPersonId: 'p-tgt' }),
          office('example-county', 'rep#1', { holderPersonId: 'p-other' }),
        ],
      })
    )
    const offices = plan.steps.filter((s) => s.kind === 'office') as any[]
    expect(offices[0]).toMatchObject({ sourceRole: 'rb', action: 'fill-existing', copy: ['email'] })
    expect(offices[1]).toMatchObject({ sourceRole: 'rep#1', action: 'new-rep-slot', targetRole: 'rep#2', copy: ['holder'], holderPersonId: 'p-rep' })
    expect(plan.warnings).toEqual([expect.stringContaining('holder')])
  })

  it('blocks what it cannot move safely, and never merges the home ecclesia away', () => {
    const blocked = buildMergePlan(
      snapshot({
        scheduleSources: 1,
        storedInvitePrograms: 2,
        speakerInvites: 1,
        sourceLists: [{ listId: 'L1', key: 'newsletter', name: 'Newsletter', status: 'active' } as any],
        targetLists: [{ listId: 'L2', key: 'newsletter', name: 'Newsletter', status: 'active' } as any],
      })
    )
    expect(blocked.blockers).toHaveLength(4)
    expect(buildMergePlan(snapshot({ source: eccl('Toronto East Ecclesia') })).blockers).toEqual([
      expect.stringContaining('home ecclesia'),
    ])
    expect(buildMergePlan(snapshot({ target: eccl('Example County', { status: 'closed' }) })).blockers).toEqual([
      expect.stringContaining('closed'),
    ])
    expect(buildMergePlan(snapshot({ target: snapshot().source })).blockers).toContain('Choose two different ecclesias.')
  })
})

function writers() {
  const calls: string[] = []
  const rec = (name: string) => vi.fn(async (...args: any[]) => { calls.push(`${name} ${JSON.stringify(args)}`) })
  const w: MergeWriters = {
    updateEcclesiaFields: rec('updateEcclesiaFields'),
    saveOffice: rec('saveOffice'),
    assignHolder: rec('assignHolder'),
    deleteOffice: rec('deleteOffice'),
    updatePerson: rec('updatePerson'),
    updatePostBlocks: rec('updatePostBlocks'),
    rehomePost: rec('rehomePost'),
    updateEventEcclesia: rec('updateEventEcclesia') as any,
    reassignListOwner: rec('reassignListOwner'),
    withdrawNomination: rec('withdrawNomination'),
    deleteEcclesia: rec('deleteEcclesia'),
    invalidateCaches: vi.fn(),
  }
  return { w, calls }
}

describe('applyMergePlan — the real run', () => {
  it('issues exactly the planned writes, source deleted last', async () => {
    const snap = snapshot()
    const plan = buildMergePlan(snap)
    const { w, calls } = writers()
    const result = await applyMergePlan(plan, snap, w)
    expect(result).toEqual({ completed: plan.steps.length })
    expect(calls.map((c) => c.split(' ')[0])).toEqual([
      'updateEcclesiaFields',
      'saveOffice',
      'deleteOffice',
      'deleteOffice',
      'updatePerson',
      'updatePostBlocks',
      'rehomePost',
      'updateEventEcclesia',
      'updateEcclesiaFields',
      'withdrawNomination',
      'deleteEcclesia',
    ])
    expect(w.updateEcclesiaFields).toHaveBeenNthCalledWith(1, 'Example County', { phone: '555-0100' })
    expect(w.saveOffice).toHaveBeenCalledWith({ ecclesiaId: 'example-county', role: 'rb', email: 'rb-office@example.org' })
    expect(w.deleteOffice).toHaveBeenCalledWith('example-county-ecclesia', 'rb', 3)
    expect(w.updatePerson).toHaveBeenCalledWith('p-1', { ecclesia: 'Example County' })
    expect(w.rehomePost).toHaveBeenCalledWith('post-2', 'Example County', undefined)
    expect(w.updateEcclesiaFields).toHaveBeenNthCalledWith(2, 'Neighbour Ecclesia', { nearbyEcclesias: ['Example County', 'Other'] })
    expect(w.withdrawNomination).toHaveBeenCalledWith('Example County Ecclesia', 'nom-1')
    expect(w.deleteEcclesia).toHaveBeenCalledWith('Example County Ecclesia')
    expect(w.invalidateCaches).toHaveBeenCalled()
  })

  it('moves an office holder onto a new Rep slot', async () => {
    const snap = snapshot({
      sourceOffices: [office('example-county-ecclesia', 'rep#1', { holderPersonId: 'p-rep' })],
      targetOffices: [office('example-county', 'rep#1', { holderPersonId: 'p-other' })],
    })
    const { w } = writers()
    await applyMergePlan(buildMergePlan(snap), snap, w)
    expect(w.saveOffice).toHaveBeenCalledWith({ ecclesiaId: 'example-county', role: 'rep#2' })
    expect(w.assignHolder).toHaveBeenCalledWith('example-county', 'rep#2', 'p-rep')
  })

  it('stops at a failing step and does NOT delete the source', async () => {
    const snap = snapshot()
    const { w } = writers()
    ;(w.updatePerson as any).mockRejectedValueOnce(new Error('throttled'))
    const result = await applyMergePlan(buildMergePlan(snap), snap, w)
    expect(result.failed).toMatchObject({ step: { kind: 'person' }, error: 'throttled' })
    expect(w.deleteEcclesia).not.toHaveBeenCalled()
    expect(w.invalidateCaches).toHaveBeenCalled()
  })

  it('refuses to apply a blocked plan', async () => {
    const snap = snapshot({ scheduleSources: 1 })
    const { w } = writers()
    await expect(applyMergePlan(buildMergePlan(snap), snap, w)).rejects.toThrow(/blocked/)
    expect(w.updatePerson).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// POST /api/admin/ecclesias/merge
// ---------------------------------------------------------------------------

const r = vi.hoisted(() => ({ auth: vi.fn(), mergeEcclesia: vi.fn() }))
vi.mock('@/utils/auth', () => ({ auth: r.auth }))
vi.mock('@/utils/ecclesia-merge-service', () => ({
  mergeEcclesia: r.mergeEcclesia,
  MergeNotFoundError: class MergeNotFoundError extends Error {},
}))

describe('POST /api/admin/ecclesias/merge', () => {
  const req = (body: any) =>
    new Request('http://x/api/admin/ecclesias/merge', { method: 'POST', body: JSON.stringify(body) }) as any

  it('owner/admin only', async () => {
    const { POST } = await import('../app/api/admin/ecclesias/merge/route')
    r.auth.mockResolvedValue({ user: { email: 'm@example.org', role: 'member' } })
    expect((await POST(req({ source: 'A', target: 'B' }))).status).toBe(403)
    r.auth.mockResolvedValue(null)
    expect((await POST(req({ source: 'A', target: 'B' }))).status).toBe(401)
    expect(r.mergeEcclesia).not.toHaveBeenCalled()
  })

  it('defaults to a dry run; dryRun:false applies; a blocked real run is a 409', async () => {
    const { POST } = await import('../app/api/admin/ecclesias/merge/route')
    r.auth.mockResolvedValue({ user: { email: 'o@example.org', role: 'owner' } })
    r.mergeEcclesia.mockResolvedValue({ dryRun: true, plan: { blockers: [] } })
    expect((await POST(req({ source: 'A', target: 'B' }))).status).toBe(200)
    expect(r.mergeEcclesia).toHaveBeenLastCalledWith('A', 'B', { dryRun: true })

    r.mergeEcclesia.mockResolvedValue({ dryRun: false, plan: { blockers: ['nope'] } })
    expect((await POST(req({ source: 'A', target: 'B', dryRun: false }))).status).toBe(409)
    expect(r.mergeEcclesia).toHaveBeenLastCalledWith('A', 'B', { dryRun: false })
  })
})
