import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { getAllEcclesia, getEcclesiaByName } from '@/utils/dynamodb/locations'
import { setRecordingBrother } from '@/utils/rb-service'
import { buildRecordingBrotherRows } from '@my/app/utils/recording-brother-rows'

/**
 * Owner/admin quick assignment of Recording Brothers.
 *
 * Everyone else uses the nomination flow (nominate → second → the nominee
 * confirms by email). Owners and admins set the designation directly, with no
 * email, through the same `setRecordingBrother` the nomination flow uses.
 *
 *   GET  → one row per ecclesia: current RB, and candidates (its inter-ecclesia
 *          contacts plus whoever holds the RB email still on the ecclesia).
 *   POST { ecclesiaName, personId } → set that person as the ecclesia's RB.
 */

async function ownerOrAdmin() {
  const session = await auth()
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const role = (session.user as { role?: string }).role
  if (role !== ROLES.OWNER && role !== ROLES.ADMIN) {
    return { error: NextResponse.json({ error: 'Owner or admin only' }, { status: 403 }) }
  }
  return { email: session.user.email }
}

export async function GET() {
  const gate = await ownerOrAdmin()
  if (gate.error) return gate.error

  const [ecclesias, reps, rbs] = await Promise.all([
    getAllEcclesia(),
    personRepository.listInterEcclesiaReps(),
    personRepository.listRecordingBrothers(),
  ])
  const rbEmailHolders = await Promise.all(
    ecclesias.map(async (e) =>
      e.recordingBrotherEmail ? personRepository.getByEmail(e.recordingBrotherEmail) : null
    )
  )

  return NextResponse.json(buildRecordingBrotherRows(ecclesias, reps, rbs, rbEmailHolders))
}

export async function POST(request: NextRequest) {
  const gate = await ownerOrAdmin()
  if (gate.error) return gate.error

  const { ecclesiaName, personId } = (await request.json().catch(() => ({}))) as {
    ecclesiaName?: string
    personId?: string
  }
  if (!ecclesiaName || !personId) {
    return NextResponse.json({ error: 'ecclesiaName and personId are required' }, { status: 400 })
  }

  const person = await personRepository.getById(personId)
  if (!person) {
    return NextResponse.json({ error: 'That person was not found' }, { status: 404 })
  }
  if (person.ecclesia !== ecclesiaName) {
    // The RB must belong to the ecclesia; fix their ecclesia on their person page first.
    return NextResponse.json(
      { error: `${person.displayName || 'This person'} is recorded at ${person.ecclesia || 'no ecclesia'}, not ${ecclesiaName}` },
      { status: 400 }
    )
  }

  // Keep an ecclesia mailbox (a role address such as the recording brother's
  // ecclesia address): it belongs to the office and moves to the new RB. An
  // address that is somebody's PRIMARY is that person's own (e.g. the previous
  // RB's), so it is never handed to the new one.
  const ecclesia = await getEcclesiaByName(ecclesiaName)
  const onFile = ecclesia?.recordingBrotherEmail?.toLowerCase().trim()
  const holder = onFile ? await personRepository.getByEmail(onFile) : null
  const roleMailbox = !!onFile && holder?.primaryEmail?.toLowerCase() !== onFile

  await setRecordingBrother({
    ecclesiaName,
    newPersonId: personId,
    emailPreference: roleMailbox ? 'ecclesia' : 'personal',
    rbEcclesiaEmail: roleMailbox ? onFile : undefined,
    callerEmail: gate.email!,
  })
  return NextResponse.json({ success: true })
}
