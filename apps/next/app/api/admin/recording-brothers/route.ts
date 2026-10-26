import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'
import { getAllEcclesia, getEcclesiaByName } from '@/utils/dynamodb/locations'
import { setRecordingBrother } from '@/utils/rb-service'
import { invalidatePeopleCache } from '../../people/cache'
import {
  buildRecordingBrotherRows,
  personName,
  type RecordingBrotherOfficeLike,
} from '@my/app/utils/recording-brother-rows'
import { officeRepository, OFFICE_ROLES } from '@my/app/provider/dynamodb/repositories/office-repository'
import { ecclesiaIdOf } from '@my/app/provider/dynamodb/people-index'
import type { EcclesiaData } from '@/utils/dynamodb/locations'

/**
 * Owner/admin assignment of Recording Brothers.
 *
 * Everyone else uses the nomination flow (nominate → second → the nominee
 * confirms by email). Owners and admins set the designation directly, with no
 * email, through the same `setRecordingBrother` the nomination flow uses.
 *
 *   GET  → one row per ecclesia: current RB, its named people, its addresses
 *          on file (nameless contacts are addresses, not people).
 *   POST { ecclesiaName, personId | newPerson: {firstName, lastName, email?},
 *          mailTo: 'own' | <an address on file> }
 *
 * R3: the write is the ecclesia's Recording Brother OFFICE. The person becomes
 * its holder; `mailTo` sets the office's own address (or none, so mail goes to
 * the holder's primary). The address belongs to the ecclesia and stays when
 * the Recording Brother changes; it is never added to the person's emails.
 */

/** Each ecclesia's RB office (holder + addresses), aligned with `ecclesias`; null = no office yet. */
async function rbOfficesOf(ecclesias: EcclesiaData[]): Promise<Array<RecordingBrotherOfficeLike | null>> {
  const views = await officeRepository.listOfficeViews(ecclesias.map((e) => ecclesiaIdOf(e)))
  return ecclesias.map((e) => {
    const rb = (views.get(ecclesiaIdOf(e)) || []).find((v) => v.office.kind === OFFICE_ROLES.RECORDING_BROTHER)
    if (!rb) return null
    return {
      holderPersonId: rb.office.holderPersonId,
      holderName: rb.holder ? personName(rb.holder) || undefined : undefined,
      officeEmail: rb.office.email,
      holderEmail: rb.holder?.primaryEmail,
    }
  })
}

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

async function everyoneAt(ecclesia: string): Promise<PersonRecord[]> {
  const all: PersonRecord[] = []
  let lastEvaluatedKey: Record<string, any> | undefined
  do {
    const page = await personRepository.listByEcclesia(ecclesia, { lastEvaluatedKey })
    all.push(...page.items.filter((p) => p.skey === 'PROFILE' && p.role !== 'deceased'))
    lastEvaluatedKey = page.lastEvaluatedKey
  } while (lastEvaluatedKey)
  return all
}

export async function GET() {
  const gate = await ownerOrAdmin()
  if (gate.error) return gate.error

  const [ecclesias, contacts, rbs] = await Promise.all([
    getAllEcclesia(),
    personRepository.listInterEcclesiaReps(),
    personRepository.listRecordingBrothers(),
  ])
  const [people, offices] = await Promise.all([
    Promise.all(ecclesias.map((e) => everyoneAt(e.name))),
    rbOfficesOf(ecclesias),
  ])

  return NextResponse.json(buildRecordingBrotherRows(ecclesias, contacts, rbs, people, offices))
}

interface PostBody {
  ecclesiaName?: string
  personId?: string
  newPerson?: { firstName?: string; lastName?: string; email?: string }
  mailTo?: string
}

export async function POST(request: NextRequest) {
  const gate = await ownerOrAdmin()
  if (gate.error) return gate.error

  const { ecclesiaName, personId, newPerson, mailTo } = (await request.json().catch(() => ({}))) as PostBody
  if (!ecclesiaName || (!personId && !newPerson) || !mailTo) {
    return NextResponse.json(
      { error: 'ecclesiaName, mailTo, and personId or newPerson are required' },
      { status: 400 }
    )
  }

  const ecclesia = await getEcclesiaByName(ecclesiaName)
  if (!ecclesia) {
    return NextResponse.json({ error: `No ecclesia named ${ecclesiaName}` }, { status: 404 })
  }

  // Ecclesia mail goes to the RB's own email, or stays at one of the
  // ecclesia's addresses on file (e.g. its shared mailbox). A named person's
  // own address (e.g. the previous RB's) is never an address on file.
  const [everyone, [rbOffice]] = await Promise.all([everyoneAt(ecclesiaName), rbOfficesOf([ecclesia])])
  const [row] = buildRecordingBrotherRows([ecclesia], [], [], [everyone], [rbOffice]).rows
  const office = mailTo === 'own' ? null : mailTo.toLowerCase().trim()
  if (office && !row.addresses.some((a) => a.email === office)) {
    return NextResponse.json({ error: `${mailTo} is not an address on file for ${ecclesiaName}` }, { status: 400 })
  }

  let rbId = personId
  if (personId) {
    const person = await personRepository.getById(personId)
    if (!person) {
      return NextResponse.json({ error: 'That person was not found' }, { status: 404 })
    }
    if (person.ecclesia !== ecclesiaName) {
      return NextResponse.json(
        { error: `${person.displayName || 'This person'} is recorded at ${person.ecclesia || 'no ecclesia'}, not ${ecclesiaName}` },
        { status: 400 }
      )
    }
    if (!personName(person)) {
      return NextResponse.json(
        { error: 'That record has no name: it is an address, not a person. Pick a named person or add one.' },
        { status: 400 }
      )
    }
  } else {
    const firstName = newPerson?.firstName?.trim()
    const lastName = newPerson?.lastName?.trim()
    const email = newPerson?.email?.toLowerCase().trim() || undefined
    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    const holder = email ? await personRepository.getByEmail(email) : null
    if (holder && !(personName(holder) === '' && holder.ecclesia === ecclesiaName)) {
      return NextResponse.json(
        { error: `${email} is already on ${personName(holder) || 'another record'}'s record` },
        { status: 409 }
      )
    }
    if (holder) {
      // The address is on file here with no name: typing it as this person's
      // own email says whose it is. Name that record instead of adding a twin.
      await personRepository.updatePerson(holder.personId, { firstName, lastName })
      rbId = holder.personId
    } else {
      const created = await personRepository.create({
        firstName,
        lastName,
        email,
        allowNoEmail: true,
        ecclesia: ecclesiaName,
        memberStatus: 'member',
        role: 'member',
      })
      rbId = created.personId
    }
    invalidatePeopleCache()
  }

  await setRecordingBrother({
    ecclesiaName,
    newPersonId: rbId!,
    emailPreference: office ? 'ecclesia' : 'personal',
    rbEcclesiaEmail: office || undefined,
    callerEmail: gate.email!,
  })
  return NextResponse.json({ success: true, personId: rbId })
}
