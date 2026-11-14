import { inviteProgramRepository } from '@my/app/provider/dynamodb/repositories/invite-program-repository'
import { getScheduleRegistry } from '@my/app/provider/schedule-sources/registry'
import { SCHEDULE_TYPE_KEYS } from '@my/app/config/schedule-fields'
import {
  slotForLink,
  type InviteProgram,
  type ProgramSlot,
} from '@my/app/provider/dynamodb/invite-program-types'
import type { RegistryEntry } from '@my/app/provider/schedule-sources/types'

/**
 * Resolve an ecclesia's invitation program (docs/SPEAKER_INVITATIONS.md §3a)
 * to what the service and `getSlots` need: the program and the slot it books.
 * Routes call this and hand the result to the service, so the service's own
 * functions stay pure of program storage (and default to the core three).
 */

export interface ResolvedProgram {
  program: InviteProgram
  /** null = unlinked: typed dates, no swaps. */
  slot: ProgramSlot | null
  /** The registry, when it had to be read to resolve the link. */
  registry?: RegistryEntry[]
}

const isKind = (id: string) => (SCHEDULE_TYPE_KEYS as string[]).includes(id)

export async function resolveProgram(ecclesia: string, programId: string): Promise<ResolvedProgram | null> {
  if (!ecclesia || !programId) return null
  const program = await inviteProgramRepository.getProgram(ecclesia, programId)
  if (!program) return null
  // This round a schedule's id is its kind, so a link resolves without a
  // registry read; anything else is looked up in the ecclesia's own registry.
  if (!program.link || isKind(program.link.scheduleId)) {
    return { program, slot: slotForLink(program.link) }
  }
  const registry = await getScheduleRegistry(ecclesia)
  return { program, slot: slotForLink(program.link, registry), registry }
}
