import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'

/**
 * Custom-email drafts are stored under `USER#{address}` — the address the
 * author was signed in with when they saved it. But drafts belong to the
 * PERSON: someone signed in with another of their own addresses must still
 * see (and work on) them. No data migration: we read under every address of
 * the session's own PersonRecord.
 *
 * Safety: keys come ONLY from the session's own PersonRecord. An address that
 * another person also holds (a shared household address) is left out — except
 * the session address itself, which is exactly the pre-existing behaviour —
 * so one person never sees another person's drafts.
 */
export interface DraftOwner {
  /** Every `USER#{address}` key this person's drafts may live under. */
  keys: string[]
  /** Where NEW drafts are written: the person's primary address, else the session address. */
  writeKey: string
}

const userKey = (email: string) => `USER#${email}`
const norm = (email: string | null | undefined) => (email || '').toLowerCase().trim()

/**
 * @param sessionUser the signed-in session's `user` (its `email`, and the
 *   `personId` the session carries when the sign-in chose who is signing in).
 */
export async function getDraftOwnerKeys(sessionUser: { email?: string | null }): Promise<DraftOwner> {
  const sessionEmailRaw = sessionUser.email || ''
  // personId is set on the session by the auth callbacks but not in its static type.
  const sessionPersonId = (sessionUser as { personId?: string | null }).personId
  const sessionEmail = norm(sessionEmailRaw)
  // The session address is used exactly as-is too, so drafts saved under it
  // before (keys were never normalised) are still found.
  const sessionKeys = Array.from(new Set([sessionEmailRaw, sessionEmail])).filter(Boolean)
  const fallback: DraftOwner = { keys: sessionKeys.map(userKey), writeKey: userKey(sessionEmailRaw) }

  let personId: string | undefined
  let primaryEmail: string | undefined
  try {
    // The session names the person who signed in (a shared address alone
    // can't say who); otherwise resolve the address the sign-in way.
    const byId = sessionPersonId ? await personRepository.getById(sessionPersonId) : null
    if (byId) {
      personId = byId.personId
      primaryEmail = byId.primaryEmail
    } else {
      const auth = await personRepository.getByEmailForAuth(sessionEmail)
      personId = auth?.personId
      primaryEmail = auth?.email
    }
    if (!personId) return fallback

    const candidates = new Set<string>()
    if (primaryEmail) candidates.add(norm(primaryEmail))
    for (const e of await personRepository.getEmails(personId)) {
      if (e?.email) candidates.add(norm(e.email))
    }
    candidates.delete(sessionEmail)
    candidates.delete('')

    const own: string[] = []
    for (const email of candidates) {
      const holders = await personRepository.getAllPersonsByEmail(email)
      if (holders.every((p) => p.personId === personId)) own.push(email)
    }

    const keys = Array.from(new Set([...sessionKeys, ...own])).map(userKey)
    const primary = norm(primaryEmail)
    const writeKey = primary && own.includes(primary) ? userKey(primary) : fallback.writeKey
    return { keys, writeKey }
  } catch (error) {
    console.error('Draft owner lookup failed; using the session address only:', error)
    return fallback
  }
}

type Sender = { send: (command: any) => Promise<any> }

/**
 * Find a draft by id under any of the owner's keys. Returns the key it lives
 * under (operate on THAT pkey) and the item, or null if none holds it.
 */
export async function findOwnedDraft(
  docClient: Sender,
  tableName: string,
  owner: DraftOwner,
  draftId: string
): Promise<{ key: { pkey: string; skey: string }; item: Record<string, any> } | null> {
  const skey = `EMAIL_DRAFT#${draftId}`
  for (const pkey of owner.keys) {
    const res = await docClient.send(new GetCommand({ TableName: tableName, Key: { pkey, skey } }))
    if (res?.Item) return { key: { pkey, skey }, item: res.Item }
  }
  return null
}
