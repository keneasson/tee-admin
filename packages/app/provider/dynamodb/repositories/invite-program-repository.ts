import { BaseRepository } from './base-repository'
import { KEYS, PATTERNS } from '../access-patterns'
import { scheduleEcclesiaId } from './schedule-repository'
import { mergeWithBuiltIns, type InviteProgram } from '../invite-program-types'

/**
 * Invitation programs (docs/SPEAKER_INVITATIONS.md §3a). `tee-admin`,
 * lowercase `pkey`/`skey`. The one writer of `invitePrograms`.
 *
 *   INVITE_PROGRAM#{ecclesiaId} / {programId}   → one program
 *
 * `ecclesiaId` is the same id the schedule registry uses (`scheduleEcclesiaId`).
 * Nothing is seeded: `listPrograms` adds the built-in core three for any
 * reserved id with nothing stored. Built-in programs are never written as such;
 * saving one stores the ecclesia's own copy.
 */
export class InviteProgramRepository extends BaseRepository<Record<string, any>> {
  constructor() {
    super('admin', false)
  }

  protected buildSheetPK(_sheetId: string): string {
    throw new Error('buildSheetPK not applicable for InviteProgramRepository')
  }

  /** The stored item for a program (exposed for tests). */
  static toItem(ecclesiaId: string, program: InviteProgram): Record<string, any> {
    const { builtIn: _builtIn, ...stored } = program
    return { pkey: KEYS.invitePrograms(ecclesiaId), skey: program.programId, ecclesiaId, ...stored }
  }

  static fromItem(item: Record<string, any>): InviteProgram {
    const { pkey: _p, skey: _s, ecclesiaId: _e, lastUpdated: _l, version: _v, ...program } = item
    return program as InviteProgram
  }

  /** Only what the ecclesia has saved (one Query). */
  async listStored(ecclesia: string): Promise<InviteProgram[]> {
    const items = await this.queryPattern(PATTERNS.invitePrograms, { ecclesiaId: scheduleEcclesiaId(ecclesia) })
    return items.map(InviteProgramRepository.fromItem)
  }

  /** The ecclesia's programs: stored ones plus the built-in core three it hasn't saved. */
  async listPrograms(ecclesia: string): Promise<InviteProgram[]> {
    if (!ecclesia) return []
    return mergeWithBuiltIns(await this.listStored(ecclesia))
  }

  async getProgram(ecclesia: string, programId: string): Promise<InviteProgram | null> {
    return (await this.listPrograms(ecclesia)).find((p) => p.programId === programId) ?? null
  }

  /** Save the ecclesia's whole list (validated by the caller). Programs are never deleted: switch one off. */
  async putPrograms(ecclesia: string, programs: InviteProgram[]): Promise<void> {
    const ecclesiaId = scheduleEcclesiaId(ecclesia)
    for (const p of programs) await this.put(InviteProgramRepository.toItem(ecclesiaId, p))
  }
}

export const inviteProgramRepository = new InviteProgramRepository()
