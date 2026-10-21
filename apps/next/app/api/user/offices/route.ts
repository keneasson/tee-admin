import { NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import {
  OFFICE_ROLES,
  officeRepository,
  resolveOfficeView,
} from '@my/app/provider/dynamodb/repositories/office-repository'
import { getEcclesiaById } from '@my/app/provider/dynamodb/people-index'
import { getEcclesiaByName } from '../../../../utils/dynamodb/locations'
import { recordingBrotherOf } from '../../../../utils/ecclesia-offices'

/**
 * GET /api/user/offices — the offices the signed-in person holds (R3), for the
 * profile's "Your role" section.
 *
 * An office address belongs to the office, not to the person: it is shown
 * here, separate from their own emails, and it moves to the next holder.
 * Each role says where the ecclesia's mail goes: the office's own address, or
 * (with none) the holder's primary email.
 *
 * Before the office assignments are applied, a Recording Brother whose
 * ecclesia has no office yet sees the older copy (`source: 'legacy'`).
 */
export interface UserRole {
  title: string
  ecclesiaName: string
  /** Where ecclesia mail for this role goes. */
  email: string | null
  /** 'office' → the role's own address (goes with the role); 'holder' → this person's primary. */
  via: 'office' | 'holder' | 'none'
  source: 'office' | 'legacy'
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const email = session.user.email.toLowerCase()
  const person = (await personRepository.getByEmail(email)) || (await personRepository.getAllPersonsByEmail(email))[0]
  if (!person) return NextResponse.json({ roles: [] })

  const held = await officeRepository.listOfficesHeldBy(person.personId)
  const roles: UserRole[] = []
  for (const office of held) {
    const entry = await getEcclesiaById(office.ecclesiaId)
    const view = resolveOfficeView(office, { personId: person.personId, primaryEmail: person.primaryEmail })
    roles.push({
      title: office.title,
      ecclesiaName: entry?.name || office.ecclesiaId,
      email: view.email,
      via: view.via,
      source: 'office',
    })
  }

  if (!held.some((o) => o.kind === OFFICE_ROLES.RECORDING_BROTHER) && person.isRecordingBrother && person.ecclesia) {
    const rb = await recordingBrotherOf(await getEcclesiaByName(person.ecclesia))
    if (rb?.source === 'legacy' && rb.email) {
      const own = rb.email === (person.primaryEmail || '').toLowerCase()
      roles.unshift({
        title: 'Recording Brother',
        ecclesiaName: person.ecclesia,
        email: rb.email,
        via: own ? 'holder' : 'office',
        source: 'legacy',
      })
    }
  }

  return NextResponse.json({ roles })
}
