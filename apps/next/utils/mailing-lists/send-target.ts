import type { MailingListOwnerType, MailingListRecord } from '@my/app/provider/dynamodb/types'
import type { EmailReasonType } from '@my/app/types'
import type { TenantConfig } from '@my/app/config/tenants'

/**
 * Which mailing list a send goes to (R5). Every send resolves to ONE registry
 * list, by its `listId`, before any recipient is read.
 *
 *  - test send          → the sending owner's test list (whatever was asked for);
 *  - a listId           → that list (must exist and be active);
 *  - nothing requested  → the sending owner's default list for the reason
 *                         (the weekly crons and the template buttons);
 *  - a list KEY         → back-compat only: drafts, meetings and news blasts
 *                         saved before lists had ids stored the old key
 *                         ('newsletter', 'interEcclesia', …). It is resolved
 *                         to the owner's list with that key, never sent as-is.
 *
 * The sending owner is the tenant's home ecclesia (Toronto East on
 * tee-admin.com). A tenant with no home ecclesia (echadhub.org) sends from
 * Toronto East's lists, as it always has.
 */

/** The owner list key each reason sends to when the caller names no list. */
export const DEFAULT_LIST_KEY_BY_REASON: Record<EmailReasonType, string> = {
  'sunday-school': 'sundaySchool',
  newsletter: 'newsletter',
  'bible-class': 'bibleClass',
  recap: 'memorial',
  'business-meeting': 'members',
  custom: 'testList',
  'event-announcement': 'newsletter',
  'inter-ecclesia': 'interEcclesia',
  'news-alert': 'newsletter',
  'post-announcement': 'newsletter',
}

export const TEST_LIST_KEY = 'testList'

/** Toronto East, the owner of every list that existed before R5. */
export const FALLBACK_OWNER_ECCLESIA_NAME = 'Toronto East Ecclesia'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isListId = (value: string): boolean => UUID.test(value)

/** A send asked for a list that cannot be sent to. Routes answer 400 with `message`. */
export class SendListError extends Error {
  readonly status = 400
  constructor(message: string) {
    super(message)
    this.name = 'SendListError'
  }
}

export interface SendTargetDeps {
  getList: (listId: string) => Promise<MailingListRecord | null>
  findByOwnerKey: (ownerType: MailingListOwnerType, ownerId: string, key: string) => Promise<MailingListRecord | null>
  /** The stable ecclesia id for an ecclesia name. */
  ecclesiaIdForName: (name: string) => Promise<string>
}

export interface SendTargetRequest {
  reason: EmailReasonType
  test?: boolean
  /** A listId, or (back-compat) an owner list key. */
  list?: string | null
  tenant: Pick<TenantConfig, 'homeEcclesiaName'>
}

export async function resolveSendList(req: SendTargetRequest, deps?: SendTargetDeps): Promise<MailingListRecord> {
  const d = deps ?? (await defaultSendTargetDeps())
  const ownerName = req.tenant.homeEcclesiaName || FALLBACK_OWNER_ECCLESIA_NAME
  const ownerKey = async (key: string) => {
    const ownerId = await d.ecclesiaIdForName(ownerName)
    return d.findByOwnerKey('ecclesia', ownerId, key)
  }

  if (req.test) {
    const testList = await ownerKey(TEST_LIST_KEY)
    if (!testList) throw new SendListError(`${ownerName} has no active test list.`)
    return testList
  }

  const requested = typeof req.list === 'string' ? req.list.trim() : ''
  if (requested && isListId(requested)) {
    const list = await d.getList(requested)
    if (!list || list.status !== 'active') throw new SendListError('That list does not exist or is archived.')
    return list
  }

  const key = requested || DEFAULT_LIST_KEY_BY_REASON[req.reason]
  if (!key) throw new SendListError(`No list for "${req.reason}".`)
  const list = await ownerKey(key)
  if (!list) throw new SendListError(`Unknown list "${key}".`)
  return list
}

async function defaultSendTargetDeps(): Promise<SendTargetDeps> {
  const [{ mailingListRepository }, { getEcclesiaByName }, { ecclesiaIdOf, slugifyEcclesia }] = await Promise.all([
    import('@my/app/provider/dynamodb/repositories/mailing-list-repository'),
    import('../dynamodb/locations'),
    import('@my/app/provider/dynamodb/people-index/keys'),
  ])
  return {
    getList: (id) => mailingListRepository.getList(id),
    findByOwnerKey: (t, id, key) => mailingListRepository.findByOwnerKey(t, id, key),
    ecclesiaIdForName: async (name) => {
      const eccl = await getEcclesiaByName(name)
      return eccl ? ecclesiaIdOf(eccl as { ecclesiaId?: string; name?: string }) : slugifyEcclesia(name)
    },
  }
}
