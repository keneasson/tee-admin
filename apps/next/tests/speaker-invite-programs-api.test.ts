import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * GET/PUT /api/speaker-invites/programs (§3a): same gate as sending (§2), the
 * link rules, and no write for a core program left as it was. Placeholder
 * people and ecclesias only; storage and the registry are mocked.
 */

const h = vi.hoisted(() => ({
  ctx: null as any,
  stored: [] as any[],
  registry: [] as any[],
  putPrograms: vi.fn(),
}))

vi.mock('@/utils/speaker-invites/http', async () => {
  const { NextResponse } = await import('next/server')
  return {
    inviterContext: async () => h.ctx,
    forbidden: () => NextResponse.json({ error: 'forbidden' }, { status: 403 }),
    noStore: {},
    readJson: async (r: Request) => r.json().catch(() => null),
  }
})
vi.mock('@my/app/provider/dynamodb/repositories/invite-program-repository', async () => {
  const { mergeWithBuiltIns } = await import('@my/app/provider/dynamodb/invite-program-types')
  return {
    inviteProgramRepository: {
      listPrograms: async () => mergeWithBuiltIns(h.stored),
      putPrograms: h.putPrograms,
    },
  }
})
vi.mock('@my/app/provider/schedule-sources/registry', () => ({ getScheduleRegistry: async () => h.registry }))

import { GET, PUT } from '@/app/api/speaker-invites/programs/route'
import { builtInPrograms } from '@my/app/provider/dynamodb/invite-program-types'

const X = 'Ecclesia X'
const Y = 'Ecclesia Y'
const as = (person: any, role: string | null = 'member') => ({ ok: true, person, role, trust: 'authenticated' })
const RB_X = { personId: 'p-rbx', ecclesia: X, isRecordingBrother: true }
const ADMIN_X = { personId: 'p-adminx', ecclesia: X }

const CYC = {
  ecclesiaId: 'ecclesia-x',
  scheduleId: 'cyc',
  name: 'CYC',
  kind: 'cyc',
  active: true,
  source: { kind: 'native' },
  mapping: { dateColumn: 'Date', fields: [{ column: 'Speaker', key: 'speaker', label: 'Speaker', rosterRole: true }] },
}

const put = (body: unknown) =>
  PUT(new Request('http://x/api/speaker-invites/programs', { method: 'PUT', body: JSON.stringify(body) }))
const wire = (p: any) => ({ ...p, builtIn: undefined })

beforeEach(() => {
  h.ctx = as(RB_X)
  h.stored = []
  h.registry = []
  h.putPrograms.mockReset()
})

describe('gate (§2): owner, or the RB / a Rep OF the ecclesia', () => {
  it('an admin is refused; an RB of X cannot read Y’s programs', async () => {
    h.ctx = as(ADMIN_X, 'admin')
    expect((await GET(new Request('http://x/api/speaker-invites/programs'))).status).toBe(403)
    h.ctx = as(RB_X)
    expect((await GET(new Request(`http://x/api/speaker-invites/programs?ecclesia=${encodeURIComponent(Y)}`))).status).toBe(403)
    expect((await put({ ecclesia: Y, programs: builtInPrograms().map(wire) })).status).toBe(403)
    expect(h.putPrograms).not.toHaveBeenCalled()
  })

  it('GET lists the defaults and the registered roster fields; none → no link options', async () => {
    const res = await GET(new Request('http://x/api/speaker-invites/programs'))
    const body = await res.json()
    expect(body.programs.map((p: any) => p.programId)).toEqual(['memorial', 'bible_class', 'lecture'])
    expect(body.linkOptions).toEqual([])
    h.registry = [CYC]
    const again = await (await GET(new Request('http://x/api/speaker-invites/programs'))).json()
    expect(again.linkOptions).toEqual([{ scheduleId: 'cyc', scheduleName: 'CYC', field: 'speaker', fieldLabel: 'Speaker' }])
  })
})

describe('PUT', () => {
  it('the core three sent back unchanged write nothing; a new linked program is stored', async () => {
    h.registry = [CYC]
    const res = await put({
      programs: [
        ...builtInPrograms().map(wire),
        { name: 'CYC class', phrase: 'lead a CYC class', who: 'anyone', where: 'region', link: { scheduleId: 'cyc', field: 'speaker' }, lengthMinutes: 60 },
      ],
    })
    expect(res.status).toBe(200)
    expect(h.putPrograms).toHaveBeenCalledTimes(1)
    const [ecclesia, saved] = h.putPrograms.mock.calls[0]
    expect(ecclesia).toBe(X)
    expect(saved.map((p: any) => p.programId)).toEqual(['cyc-class'])
    expect(saved[0]).toMatchObject({ link: { scheduleId: 'cyc', field: 'speaker' }, updatedBy: 'p-rbx', order: 3 })
  })

  it('a reworded core program is stored as the ecclesia’s own copy', async () => {
    const programs = builtInPrograms().map(wire)
    programs[2] = { ...programs[2], phrase: 'share a message with our interested friends' }
    expect((await put({ programs })).status).toBe(200)
    expect(h.putPrograms.mock.calls[0][1].map((p: any) => p.programId)).toEqual(['lecture'])
  })

  it('refuses a link to a schedule the ecclesia hasn’t connected, and two active programs on one field', async () => {
    const link = { scheduleId: 'cyc', field: 'speaker' }
    const unconnected = await put({ programs: [{ name: 'CYC class', phrase: 'lead a CYC class', who: 'anyone', where: 'region', link, lengthMinutes: 60 }] })
    expect(unconnected.status).toBe(400)
    expect((await unconnected.json()).error).toContain('hasn’t connected')

    h.registry = [CYC]
    const twice = await put({
      programs: [
        { name: 'CYC class', phrase: 'lead a CYC class', who: 'anyone', where: 'region', link, lengthMinutes: 60 },
        { name: 'CYC talk', phrase: 'give a CYC talk', who: 'anyone', where: 'region', link, lengthMinutes: 60 },
      ],
    })
    expect(twice.status).toBe(400)
    expect((await twice.json()).error).toContain('both fill the same schedule field')
    expect(h.putPrograms).not.toHaveBeenCalled()
  })
})
