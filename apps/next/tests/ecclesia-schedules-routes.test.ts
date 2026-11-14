/**
 * /api/ecclesia-schedules/** — gate, connect, save, sync (docs/ECCLESIA_SCHEDULES.md
 * §Gate, §API; behaviour docs/behavior/ecclesia-schedules.md).
 *
 * Session, directory lookup, registry repository and the Google source are
 * mocked; DynamoDB is a mocked client. Placeholder people, ecclesias and sheets.
 */
import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest'

const h = vi.hoisted(() => ({
  mockSend: vi.fn(),
  requireAssurance: vi.fn(),
  personForSessionEmail: vi.fn(),
  repo: {
    listEntries: vi.fn(),
    getEntry: vi.fn(),
    putEntry: vi.fn(),
    listAllEntries: vi.fn(),
    getSheetClaim: vi.fn(),
    claimSheet: vi.fn(),
    releaseSheetClaim: vi.fn(),
  },
  sheets: { kind: 'google-sheets', connect: vi.fn(), listTables: vi.fn(), readRows: vi.fn() },
}))

vi.mock('@aws-sdk/lib-dynamodb', () => {
  const cmd = (type: string) => vi.fn().mockImplementation((params) => ({ type, params }))
  return {
    DynamoDBDocumentClient: { from: vi.fn(() => ({ send: h.mockSend })) },
    QueryCommand: cmd('QueryCommand'),
    PutCommand: cmd('PutCommand'),
    GetCommand: cmd('GetCommand'),
    UpdateCommand: cmd('UpdateCommand'),
    DeleteCommand: cmd('DeleteCommand'),
    ScanCommand: cmd('ScanCommand'),
    BatchWriteCommand: cmd('BatchWriteCommand'),
    BatchGetCommand: cmd('BatchGetCommand'),
  }
})
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn() }))
vi.mock('@/utils/auth-trust', async () => {
  const actual: any = await vi.importActual('@/utils/auth-trust')
  return { ...actual, requireAssurance: h.requireAssurance }
})
vi.mock('@/utils/auth', () => ({ auth: vi.fn() }))
vi.mock('@/utils/session-person', () => ({ personForSessionEmail: h.personForSessionEmail }))
vi.mock('@my/app/provider/dynamodb/repositories/schedule-registry-repository', () => ({
  scheduleRegistryRepository: h.repo,
  ScheduleRegistryRepository: class {},
}))
vi.mock('@my/app/provider/schedule-sources/google-sheets', async () => {
  const actual: any = await vi.importActual('@my/app/provider/schedule-sources/google-sheets')
  return { ...actual, googleSheetsSource: h.sheets }
})

const SITE_FIXTURE = {
  type: 'service_account',
  client_email: 'sa@example.iam.gserviceaccount.com',
  sheet_ids: { memorial: { name: 'Memorial', startTime: '11:00', key: 'placeholder-memorial-sheet' } },
}
const savedEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify(SITE_FIXTURE)
afterAll(() => {
  if (savedEnv === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  else process.env.GOOGLE_SERVICE_ACCOUNT_KEY = savedEnv
})

import { ScheduleSourceError } from '@my/app/provider/schedule-sources/google-sheets'
import { GET as listRoute } from '@/app/api/ecclesia-schedules/route'
import { POST as connectRoute } from '@/app/api/ecclesia-schedules/connect/route'
import { PUT as putRoute } from '@/app/api/ecclesia-schedules/[scheduleId]/route'
import { POST as syncRoute } from '@/app/api/ecclesia-schedules/[scheduleId]/sync/route'

const X = 'Example Ecclesia'
const Y = 'Sample Ecclesia'
const HOME = 'Toronto East Ecclesia'
const SHEET = 'placeholderSheetId_0123456789abcdef'

const people: Record<string, any> = {
  'rb-x@example.org': { personId: 'p-rbx', ecclesia: X, isRecordingBrother: true, role: 'member' },
  'rep-x@example.org': { personId: 'p-repx', ecclesia: X, role: 'rep' },
  'rb-y@example.org': { personId: 'p-rby', ecclesia: Y, isRecordingBrother: true, role: 'member' },
  'admin-x@example.org': { personId: 'p-adminx', ecclesia: X, role: 'admin' },
  'member-x@example.org': { personId: 'p-memx', ecclesia: X, role: 'member' },
  'owner@example.org': { personId: 'p-owner', ecclesia: Y, role: 'owner' },
  'rb-home@example.org': { personId: 'p-rbh', ecclesia: HOME, isRecordingBrother: true, role: 'member' },
}

function signIn(email: string) {
  h.requireAssurance.mockResolvedValue({
    ok: true,
    ctx: { trust: 'authenticated', email, authTime: Date.now(), session: { user: { email, role: people[email].role } } },
  })
}

const url = (path: string, q: Record<string, string> = {}) => {
  const s = new URLSearchParams(q).toString()
  return `http://x${path}${s ? `?${s}` : ''}`
}
const req = (method: string, path: string, body?: unknown, q?: Record<string, string>) =>
  new Request(url(path, q), { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
const params = (scheduleId: string) => ({ params: Promise.resolve({ scheduleId }) })

const draft = {
  source: { spreadsheetId: SHEET, tab: 'Classes' },
  mapping: { dateColumn: 'When', fields: [{ column: 'Who', key: 'Speaker', rosterRole: true }] },
}

beforeEach(() => {
  vi.clearAllMocks()
  h.mockSend.mockImplementation(async (c: any) => (c.type === 'QueryCommand' ? { Items: [] } : {}))
  h.personForSessionEmail.mockImplementation(async (email: string) => people[email] ?? null)
  h.repo.listEntries.mockResolvedValue([])
  h.repo.getSheetClaim.mockResolvedValue(null)
  h.repo.claimSheet.mockResolvedValue(true)
  h.repo.putEntry.mockResolvedValue(undefined)
  h.sheets.connect.mockResolvedValue({ ecclesiaId: 'example-ecclesia', kind: 'google-sheets', config: { spreadsheetId: SHEET, title: 'Example' } })
  h.sheets.listTables.mockResolvedValue([{ id: 'Classes', name: 'Classes', headers: ['When', 'Who'] }])
  h.sheets.readRows.mockResolvedValue([{ When: '2030-01-08', Who: 'Ann Example' }])
})

describe('gate: canManageEcclesiaSchedules on every route (ECSCHED-13)', () => {
  it("ECSCHED-13: another ecclesia's Recording Brother gets 403 on every route, and nothing is read or written", async () => {
    signIn('rb-y@example.org')
    const q = { ecclesia: X }
    expect((await listRoute(req('GET', '/api/ecclesia-schedules', undefined, q))).status).toBe(403)
    expect((await connectRoute(req('POST', '/api/ecclesia-schedules/connect', { sheetUrl: SHEET, scheduleId: 'memorial' }, q))).status).toBe(403)
    expect((await putRoute(req('PUT', '/api/ecclesia-schedules/memorial', draft, q), params('memorial'))).status).toBe(403)
    expect((await syncRoute(req('POST', '/api/ecclesia-schedules/memorial/sync', {}, q), params('memorial'))).status).toBe(403)
    expect(h.repo.listEntries).not.toHaveBeenCalled()
    expect(h.repo.claimSheet).not.toHaveBeenCalled()
    expect(h.repo.putEntry).not.toHaveBeenCalled()
    expect(h.sheets.connect).not.toHaveBeenCalled()
  })

  it('ECSCHED-13: admins and plain members of the ecclesia are not managers', async () => {
    for (const who of ['admin-x@example.org', 'member-x@example.org']) {
      signIn(who)
      expect((await listRoute(req('GET', '/api/ecclesia-schedules'))).status).toBe(403)
    }
  })

  it('ECSCHED-14: a Rep of their own ecclesia may list; the response carries the share address', async () => {
    signIn('rep-x@example.org')
    const res = await listRoute(req('GET', '/api/ecclesia-schedules'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ ecclesia: X, canPickEcclesia: false, siteManaged: false, serviceAccountEmail: 'sa@example.iam.gserviceaccount.com', entries: [] })
    expect(h.repo.listEntries).toHaveBeenCalledWith('example-ecclesia')
  })

  it('ECSCHED-14: the owner may pick any ecclesia', async () => {
    signIn('owner@example.org')
    const res = await listRoute(req('GET', '/api/ecclesia-schedules', undefined, { ecclesia: X }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ecclesia: X, canPickEcclesia: true })
  })

  it("ECSCHED-15: Toronto East's built-ins show as site configuration with no sheet ID", async () => {
    signIn('rb-home@example.org')
    const json = await (await listRoute(req('GET', '/api/ecclesia-schedules'))).json()
    expect(json.siteManaged).toBe(true)
    expect(json.entries).toHaveLength(1)
    expect(json.entries[0]).toMatchObject({ scheduleId: 'memorial', siteConfigured: true, source: { kind: 'env' } })
    expect(JSON.stringify(json)).not.toContain('placeholder-memorial-sheet')
  })
})

describe('POST /api/ecclesia-schedules/connect', () => {
  it('ECSCHED-03: verifies access, claims the sheet for the ecclesia, lists tabs with headers', async () => {
    signIn('rb-x@example.org')
    const res = await connectRoute(req('POST', '/api/ecclesia-schedules/connect', { sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET}/edit`, scheduleId: 'bibleClass' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ spreadsheetId: SHEET, title: 'Example', tabs: [{ name: 'Classes', headers: ['When', 'Who'] }] })
    expect(h.repo.claimSheet).toHaveBeenCalledWith(SHEET, 'example-ecclesia', 'bibleClass')
  })

  it('ECSCHED-04: not shared → 409 NOT_SHARED with the address to share with; nothing claimed', async () => {
    signIn('rb-x@example.org')
    h.sheets.connect.mockRejectedValue(new ScheduleSourceError('NOT_SHARED', 'nope'))
    const res = await connectRoute(req('POST', '/api/ecclesia-schedules/connect', { sheetUrl: SHEET, scheduleId: 'bibleClass' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'NOT_SHARED', serviceAccountEmail: 'sa@example.iam.gserviceaccount.com' })
    expect(h.repo.claimSheet).not.toHaveBeenCalled()
  })

  it('ECSCHED-16: a sheet another ecclesia has claimed → 409 CLAIMED; tabs are not listed', async () => {
    signIn('rb-x@example.org')
    h.repo.claimSheet.mockResolvedValue(false)
    const res = await connectRoute(req('POST', '/api/ecclesia-schedules/connect', { sheetUrl: SHEET, scheduleId: 'bibleClass' }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('CLAIMED')
    expect(h.sheets.listTables).not.toHaveBeenCalled()
  })

  it("ECSCHED-09: refuses Toronto East's site sheet IDs before contacting Google", async () => {
    signIn('rb-x@example.org')
    const res = await connectRoute(
      req('POST', '/api/ecclesia-schedules/connect', { sheetUrl: 'https://docs.google.com/spreadsheets/d/placeholder-memorial-sheet/edit', scheduleId: 'memorial' })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('SITE_SHEET')
    expect(h.sheets.connect).not.toHaveBeenCalled()
    expect(h.repo.claimSheet).not.toHaveBeenCalled()
  })

  it('ECSCHED-15: the home ecclesia cannot connect a sheet (its schedules come from the site configuration)', async () => {
    signIn('rb-home@example.org')
    const res = await connectRoute(req('POST', '/api/ecclesia-schedules/connect', { sheetUrl: SHEET, scheduleId: 'cyc' }))
    expect((await res.json()).code).toBe('HOME_SITE_CONFIG')
  })
})

describe('PUT /api/ecclesia-schedules/[scheduleId]', () => {
  it('ECSCHED-17: saves a mapped google-sheets entry once the sheet is claimed by this ecclesia', async () => {
    signIn('rep-x@example.org')
    h.repo.getSheetClaim.mockResolvedValue({ spreadsheetId: SHEET, ecclesiaId: 'example-ecclesia', scheduleId: 'bibleClass' })
    const res = await putRoute(req('PUT', '/api/ecclesia-schedules/bibleClass', draft), params('bibleClass'))
    expect(res.status).toBe(200)
    const saved = h.repo.putEntry.mock.calls[0][0]
    expect(saved).toMatchObject({
      ecclesiaId: 'example-ecclesia',
      ecclesia: X,
      scheduleId: 'bibleClass',
      kind: 'bibleClass',
      active: true,
      source: { kind: 'google-sheets', spreadsheetId: SHEET, tab: 'Classes' },
      mapping: { dateColumn: 'When', fields: [{ column: 'Who', key: 'Speaker', label: 'Speaker', rosterRole: true }] },
      updatedBy: 'p-repx',
    })
  })

  it('ECSCHED-16: refuses a sheet this ecclesia has not claimed', async () => {
    signIn('rep-x@example.org')
    h.repo.getSheetClaim.mockResolvedValue({ spreadsheetId: SHEET, ecclesiaId: 'sample-ecclesia', scheduleId: 'memorial' })
    const res = await putRoute(req('PUT', '/api/ecclesia-schedules/bibleClass', draft), params('bibleClass'))
    expect(res.status).toBe(409)
    expect(h.repo.putEntry).not.toHaveBeenCalled()
  })

  it('ECSCHED-17: rejects a field that is not in the catalogue for that kind', async () => {
    signIn('rep-x@example.org')
    const bad = { ...draft, mapping: { dateColumn: 'When', fields: [{ column: 'Who', key: 'Exhort', rosterRole: true }] } }
    const res = await putRoute(req('PUT', '/api/ecclesia-schedules/bibleClass', bad), params('bibleClass'))
    expect(res.status).toBe(400)
    expect(h.repo.putEntry).not.toHaveBeenCalled()
  })

  it("ECSCHED-15: Toronto East's site-configured entry changes only its roster roles; source stays env", async () => {
    signIn('rb-home@example.org')
    const res = await putRoute(
      req('PUT', '/api/ecclesia-schedules/memorial', { rosterRoles: ['Exhort', 'Organist'], source: { spreadsheetId: SHEET, tab: 'x' } }),
      params('memorial')
    )
    expect(res.status).toBe(200)
    const saved = h.repo.putEntry.mock.calls[0][0]
    expect(saved.source).toEqual({ kind: 'env', envKey: 'memorial' })
    expect(saved.builtIn).toBeUndefined()
    const on = saved.mapping.fields.filter((f: any) => f.rosterRole).map((f: any) => f.key)
    expect(on).toEqual(['Exhort', 'Organist'])
  })
})

describe('POST /api/ecclesia-schedules/[scheduleId]/sync', () => {
  it('ECSCHED-08: ?dryRun=1 with a draft previews mapped rows and writes nothing to DynamoDB', async () => {
    signIn('rb-x@example.org')
    h.repo.getSheetClaim.mockResolvedValue({ spreadsheetId: SHEET, ecclesiaId: 'example-ecclesia', scheduleId: 'bibleClass' })
    const res = await syncRoute(req('POST', '/api/ecclesia-schedules/bibleClass/sync', draft, { dryRun: '1' }), params('bibleClass'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ status: 'preview', total: 1 })
    expect(json.rows[0]).toMatchObject({ ecclesia: X, date: '2030-01-08', scheduleData: { Speaker: 'Ann Example' } })
    expect(h.mockSend.mock.calls.filter((c) => ['BatchWriteCommand', 'PutCommand', 'DeleteCommand'].includes(c[0].type))).toEqual([])
    expect(h.repo.putEntry).not.toHaveBeenCalled()
  })

  it("ECSCHED-12: a real sync writes the stored entry's rows into the ecclesia's own partition", async () => {
    signIn('rb-x@example.org')
    h.repo.listEntries.mockResolvedValue([
      {
        ecclesiaId: 'example-ecclesia',
        ecclesia: X,
        scheduleId: 'bibleClass',
        name: 'Bible Class',
        kind: 'bibleClass',
        active: true,
        source: { kind: 'google-sheets', spreadsheetId: SHEET, tab: 'Classes' },
        mapping: draft.mapping,
      },
    ])
    h.repo.getSheetClaim.mockResolvedValue({ spreadsheetId: SHEET, ecclesiaId: 'example-ecclesia', scheduleId: 'bibleClass' })
    const res = await syncRoute(req('POST', '/api/ecclesia-schedules/bibleClass/sync', {}), params('bibleClass'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', rows: 1 })
    const batch = h.mockSend.mock.calls.find((c) => c[0].type === 'BatchWriteCommand')![0].params
    const item = (Object.values(batch.RequestItems)[0] as any[])[0].PutRequest.Item
    expect(item.PK).toBe('SCHEDULE#example-ecclesia#bibleClass')
    expect(h.repo.putEntry.mock.calls[0][0].lastSync).toMatchObject({ status: 'ok', rows: 1 })
  })

  it('a schedule that is not set up → 404', async () => {
    signIn('rb-x@example.org')
    const res = await syncRoute(req('POST', '/api/ecclesia-schedules/cyc/sync', {}), params('cyc'))
    expect(res.status).toBe(404)
  })
})
