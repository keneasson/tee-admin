import { BaseRepository } from './base-repository'
import type { EmailReasonType } from '../../../types'

const PK = 'PENDING_EMAIL_NOTE'

interface PendingEmailNoteItem {
  pkey: string
  skey: EmailReasonType
  note: string
  createdAt: string
  createdBy?: string
  lastUpdated?: string
  version?: number
}

class PendingEmailNoteRepository extends BaseRepository<PendingEmailNoteItem> {
  constructor() {
    super('admin', false)
  }

  protected buildSheetPK(): string {
    return PK
  }

  async getNote(reason: EmailReasonType): Promise<string | undefined> {
    const item = await this.get(PK, reason)
    return item?.note
  }

  /**
   * Returns the full saved note record (note + when/who saved it) so the admin
   * UI can surface a previously-saved note and flag stale ones. Returns null
   * when nothing is queued for the reason.
   */
  async getNoteItem(reason: EmailReasonType): Promise<PendingEmailNoteItem | null> {
    const item = await this.get(PK, reason)
    return item ?? null
  }

  async saveNote(reason: EmailReasonType, note: string, createdBy?: string): Promise<void> {
    await this.put({
      pkey: PK,
      skey: reason,
      note,
      createdAt: new Date().toISOString(),
      ...(createdBy ? { createdBy } : {}),
    } as PendingEmailNoteItem)
  }

  async clearNote(reason: EmailReasonType): Promise<void> {
    await this.delete(PK, reason)
  }
}

export const pendingEmailNoteRepository = new PendingEmailNoteRepository()
