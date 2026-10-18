import { NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { officeRepository } from '@my/app/provider/dynamodb/repositories/office-repository'
import { ecclesiaIdOf } from '@my/app/provider/dynamodb/people-index'
import { getAllEcclesia } from '@/utils/dynamodb/locations'
import { officesOf, recordingBrothersOf } from '@/utils/ecclesia-offices'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/offices — every ecclesia with its offices (R3).
 *
 * One row per ecclesia record: its Recording Brother office and Rep offices
 * (holder by reference, resolved name; the office inbox or the holder's
 * address), plus whether the ecclesia has an RB office at all. Before the
 * owner-confirmed assignments are applied, `recordingBrother.source === 'legacy'`
 * marks a contact still read from the old copied ECCLESIA fields, so the gap
 * is visible rather than hidden. Admin/owner only. Reads only.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = ((session.user as any).role as string) || ROLES.GUEST
  if (role !== ROLES.ADMIN && role !== ROLES.OWNER) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const ecclesias = (await getAllEcclesia()).sort((a, b) => a.name.localeCompare(b.name))
    const [offices, rbs, assigned] = await Promise.all([
      officesOf(ecclesias),
      recordingBrothersOf(ecclesias),
      officeRepository.officesAssigned(),
    ])

    const rows = ecclesias.map((e) => {
      const id = ecclesiaIdOf(e)
      const list = offices.get(id) || []
      return {
        ecclesiaId: id,
        name: e.name,
        city: e.city,
        province: e.province,
        country: e.country,
        hasRecordingBrotherOffice: list.some((o) => o.kind === 'rb'),
        recordingBrother: rbs.get(id) || null,
        offices: list,
      }
    })

    return NextResponse.json({
      success: true,
      officesAssigned: assigned,
      totals: {
        ecclesias: rows.length,
        withRecordingBrotherOffice: rows.filter((r) => r.hasRecordingBrotherOffice).length,
        offices: rows.reduce((n, r) => n + r.offices.length, 0),
      },
      ecclesias: rows,
    })
  } catch (error) {
    console.error('Error listing offices:', error)
    return NextResponse.json({ success: false, error: 'Failed to list offices' }, { status: 500 })
  }
}
