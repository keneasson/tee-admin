/**
 * ACCESS PATTERNS — the one list of how every table is read.
 *
 * `tee-admin` is a single table (`pkey`/`skey`) with four generic, overloaded
 * GSIs (`gsi1`..`gsi4`, attributes `gsiNpk`/`gsiNsk`, all ProjectionType ALL).
 * Every index entry is SPARSE: only the items that carry the attributes are in
 * it, and the key PREFIX says what shape it is (`EMAIL#<addr>`, `TOKEN#<v>`…).
 * See `docs/legacy-people-retirement-plan.md` §7/§8.
 *
 * Rules (enforced by `apps/next/tests/access-pattern-registry.test.ts`):
 *   - No Scan on a request path. Read by key, or Query one of these patterns.
 *   - Index names appear only here. Repositories name a pattern, not 'gsi1'.
 *   - Each pattern has exactly one writer: the file that puts the key attributes.
 *   - A new pattern overloads an existing GSI with a new prefix. No new GSIs.
 *
 * Key builders shared with the people index live in `people-index/keys.ts`
 * and are reused here, so both describe the same keys.
 */
import {
  ECCLESIA_ALIAS_SK,
  ECCLESIA_DIRECTORY_PK,
  ecclesiaIdPk,
  ecclesiaPeoplePk,
  namePrefixPk,
  peopleRosterPk,
  rbEmailPk,
} from './people-index/keys'

export type SkCondition =
  | { eq: string }
  | { beginsWith: string }
  | { between: [string, string] }
  | { gte: string }

export interface AccessPattern<A = void> {
  /** Stable name, used in logs and docs. */
  name: string
  table: 'tee-admin' | 'tee-schedules' | 'tee-send-queue'
  /** The GSI, or undefined for the base table. */
  index?: string
  pkAttr: string
  skAttr: string
  pk: (args: A) => string
  /** The sort-key condition for these args, if any. */
  sk?: (args: A) => SkCondition | undefined
  /** Human-readable key shape: `pk template / sk template`. */
  shape: string
  /** The one file that writes this pattern's key attributes. */
  writer: string
}

const ADMIN = 'tee-admin' as const
const SCHEDULES = 'tee-schedules' as const
const SEND_QUEUE = 'tee-send-queue' as const

const onAdmin = (index?: 'gsi1' | 'gsi2' | 'gsi3' | 'gsi4') => ({
  table: ADMIN,
  index,
  pkAttr: index ? `${index}pk` : 'pkey',
  skAttr: index ? `${index}sk` : 'skey',
})

const lower = (s: string) => s.trim().toLowerCase()

// ---------------------------------------------------------------------------
// Key builders for patterns introduced with the registry. Writers call these.
// ---------------------------------------------------------------------------

export const KEYS = {
  officeHolder: (personId: string) => `OFFICEHOLDER#${personId}`,
  officeMail: (email: string) => `OFFICEMAIL#${email}`,
  otpByEmail: (email: string) => `OTP#${lower(email)}`,
  postsAll: () => 'POSTS#ALL',
  postSeries: (seriesId: string) => `POSTSERIES#${seriesId}`,
  meetingsAll: () => 'MEETINGS',
  organizationsAll: () => 'ORGANIZATIONS',
  editRequestToken: (token: string) => `EDITREQTOKEN#${token}`,
  editRequestsBy: (email: string) => `EDITREQBY#${lower(email)}`,
  contactRequestsBy: (email: string) => `CONTACTREQBY#${lower(email)}`,
  youtubeOAuthAll: () => 'OAUTH#youtube',
  webAnalytics: () => 'ANALYTICS#WEB',
} as const

// ---------------------------------------------------------------------------
// tee-admin
// ---------------------------------------------------------------------------

export const PATTERNS = {
  // People (PersonRecord: PERSON#<id> / PROFILE, EMAIL#…, PHONE#…)
  personByEmail: {
    name: 'personByEmail', ...onAdmin('gsi1'),
    pk: (a: { email: string }) => `EMAIL#${a.email.toLowerCase()}`,
    sk: (a: { email: string; primaryOnly?: boolean }) => (a.primaryOnly ? { eq: 'PERSON' } : { beginsWith: 'PERSON' }),
    shape: 'EMAIL#<addr> / PERSON (profile) | PERSON#<id> (email item)',
    writer: 'packages/app/provider/dynamodb/repositories/person-repository.ts',
  } as AccessPattern<{ email: string; primaryOnly?: boolean }>,
  personsByEcclesiaName: {
    name: 'personsByEcclesiaName', ...onAdmin('gsi2'),
    pk: (a: { ecclesia: string }) => `ECCLESIA#${a.ecclesia}`,
    shape: 'ECCLESIA#<name> / <last>#<first>#<id>',
    writer: 'packages/app/provider/dynamodb/repositories/person-repository.ts',
  } as AccessPattern<{ ecclesia: string }>,
  personsByLastName: {
    name: 'personsByLastName', ...onAdmin('gsi3'),
    pk: (a: { lastName: string }) => `NAME#${a.lastName.toLowerCase()}`,
    sk: (a: { lastName: string; firstName?: string }) =>
      a.firstName ? { beginsWith: a.firstName.toLowerCase() } : undefined,
    shape: 'NAME#<last> / <first>#<id>',
    writer: 'packages/app/provider/dynamodb/repositories/person-repository.ts',
  } as AccessPattern<{ lastName: string; firstName?: string }>,
  peopleCards: {
    name: 'peopleCards', ...onAdmin('gsi4'),
    pk: () => peopleRosterPk(),
    shape: 'PEOPLE#ALL / <last>#<first>#<id>  (PERSON#<id> / CARD)',
    writer: 'packages/app/provider/dynamodb/people-index/projections.ts',
  } as AccessPattern<void>,
  peopleCardsByEcclesiaId: {
    name: 'peopleCardsByEcclesiaId', ...onAdmin('gsi2'),
    pk: (a: { ecclesiaId: string }) => ecclesiaPeoplePk(a.ecclesiaId),
    shape: 'ECCPEOPLE#<ecclesiaId> / <last>#<first>#<id>  (PERSON#<id> / CARD)',
    writer: 'packages/app/provider/dynamodb/people-index/projections.ts',
  } as AccessPattern<{ ecclesiaId: string }>,
  nameTypeahead: {
    name: 'nameTypeahead', ...onAdmin('gsi3'),
    pk: (a: { token: string }) => namePrefixPk(a.token),
    sk: (a: { token: string }) => ({ beginsWith: a.token }),
    shape: 'NAMEPFX#ALL#<2 letters> / <token>#<id>  (PERSON#<id> / NAMETOK#<token>)',
    writer: 'packages/app/provider/dynamodb/people-index/projections.ts',
  } as AccessPattern<{ token: string }>,

  // Ecclesias (ECCLESIA#<country|prov> / <city>#<name>) and their projections
  ecclesiaByName: {
    name: 'ecclesiaByName', ...onAdmin('gsi1'),
    pk: (a: { name: string }) => `ECCLESIA#${a.name}`,
    shape: 'ECCLESIA#<name> / <country>|<prov>|<city>',
    writer: 'apps/next/utils/dynamodb/locations.ts',
  } as AccessPattern<{ name: string }>,
  ecclesiaDirectory: {
    name: 'ecclesiaDirectory', ...onAdmin('gsi2'),
    pk: () => ECCLESIA_DIRECTORY_PK,
    sk: (a: { country?: string; province?: string }) =>
      a.country ? { beginsWith: `${a.country}|${a.province ? `${a.province}|` : ''}` } : undefined,
    shape: 'ECCLESIAS / <country>|<prov>|<city>#<name>  (ECCLESIA_ID#<id> / ECCLESIA)',
    writer: 'packages/app/provider/dynamodb/people-index/projections.ts (called from locations.ts)',
  } as AccessPattern<{ country?: string; province?: string }>,
  ecclesiaByRbEmail: {
    name: 'ecclesiaByRbEmail', ...onAdmin('gsi1'),
    pk: (a: { email: string }) => rbEmailPk(a.email),
    sk: () => ({ eq: ECCLESIA_ALIAS_SK }),
    shape: 'RBEMAIL#<addr> / ECCLESIA  (ECCLESIA_ID#<id> / ECCLESIA)',
    writer: 'packages/app/provider/dynamodb/people-index/projections.ts (called from locations.ts)',
  } as AccessPattern<{ email: string }>,

  // Offices (ECCLESIA_ID#<id> / OFFICE#<role>)
  officesOfEcclesia: {
    name: 'officesOfEcclesia', ...onAdmin(),
    pk: (a: { ecclesiaId: string }) => ecclesiaIdPk(a.ecclesiaId),
    sk: () => ({ beginsWith: 'OFFICE#' }),
    shape: 'pkey ECCLESIA_ID#<id> / skey OFFICE#<role>',
    writer: 'packages/app/provider/dynamodb/repositories/office-repository.ts',
  } as AccessPattern<{ ecclesiaId: string }>,
  officesHeldByPerson: {
    name: 'officesHeldByPerson', ...onAdmin('gsi1'),
    pk: (a: { personId: string }) => KEYS.officeHolder(a.personId),
    shape: 'OFFICEHOLDER#<personId> / OFFICE#<ecclesiaId>#<role>',
    writer: 'packages/app/provider/dynamodb/repositories/office-repository.ts',
  } as AccessPattern<{ personId: string }>,
  officesByEmail: {
    name: 'officesByEmail', ...onAdmin('gsi3'),
    pk: (a: { email: string }) => KEYS.officeMail(a.email),
    shape: 'OFFICEMAIL#<addr> / OFFICE#<ecclesiaId>#<role>',
    writer: 'packages/app/provider/dynamodb/repositories/office-repository.ts',
  } as AccessPattern<{ email: string }>,

  // Organizations (ORGANIZATION#<country|prov> / <city>#<name>)
  organizationByName: {
    name: 'organizationByName', ...onAdmin('gsi1'),
    pk: (a: { name: string }) => `ORGANIZATION#${a.name}`,
    shape: 'ORGANIZATION#<name> / <country>|<prov>|<city>',
    writer: 'apps/next/utils/dynamodb/organizations.ts',
  } as AccessPattern<{ name: string }>,
  organizationsAll: {
    name: 'organizationsAll', ...onAdmin('gsi4'),
    pk: () => KEYS.organizationsAll(),
    shape: 'ORGANIZATIONS / <country>|<prov>|<city>#<name>',
    writer: 'apps/next/utils/dynamodb/organizations.ts',
  } as AccessPattern<void>,

  // Tokens (PERSON#<id> / TOKEN#<type>#<tokenId>)
  tokenByValue: {
    name: 'tokenByValue', ...onAdmin('gsi4'),
    pk: (a: { tokenValue: string }) => `TOKEN#${a.tokenValue}`,
    shape: 'TOKEN#<value> / <expiresAt>#<type>',
    writer: 'packages/app/provider/dynamodb/repositories/token-repository.ts',
  } as AccessPattern<{ tokenValue: string }>,
  otpByEmail: {
    name: 'otpByEmail', ...onAdmin('gsi1'),
    pk: (a: { email: string }) => KEYS.otpByEmail(a.email),
    shape: 'OTP#<addr> / <createdAt>  (OTP tokens only)',
    writer: 'packages/app/provider/dynamodb/repositories/token-repository.ts',
  } as AccessPattern<{ email: string }>,

  // Posts (POST#<tenant> / POST#<postId>)
  postById: {
    name: 'postById', ...onAdmin('gsi1'),
    pk: (a: { postId: string }) => `POST#${a.postId}`,
    sk: () => ({ eq: 'POST' }),
    shape: 'POST#<postId> / POST',
    writer: 'packages/app/provider/dynamodb/repositories/post-repository.ts',
  } as AccessPattern<{ postId: string }>,
  postsByTenant: {
    name: 'postsByTenant', ...onAdmin('gsi2'),
    pk: (a: { tenant: string }) => `POSTS#${a.tenant}`,
    shape: 'POSTS#<tenant> / <sortDate>#<postId>',
    writer: 'packages/app/provider/dynamodb/repositories/post-repository.ts',
  } as AccessPattern<{ tenant: string }>,
  postsAll: {
    name: 'postsAll', ...onAdmin('gsi4'),
    pk: () => KEYS.postsAll(),
    shape: 'POSTS#ALL / <sortDate>#<postId>',
    writer: 'packages/app/provider/dynamodb/repositories/post-repository.ts',
  } as AccessPattern<void>,
  postsBySeries: {
    name: 'postsBySeries', ...onAdmin('gsi3'),
    pk: (a: { seriesId: string }) => KEYS.postSeries(a.seriesId),
    shape: 'POSTSERIES#<seriesId> / <sortDate>#<postId>',
    writer: 'packages/app/provider/dynamodb/repositories/post-repository.ts',
  } as AccessPattern<{ seriesId: string }>,

  // Meetings (MEETING#<id> / DETAILS)
  meetingsByOwner: {
    name: 'meetingsByOwner', ...onAdmin('gsi1'),
    pk: (a: { ownerType: string; ownerName: string }) => `OWNER#${a.ownerType}#${a.ownerName}`,
    shape: 'OWNER#<ownerType>#<ownerName> / <nextOccurrence>',
    writer: 'packages/app/provider/dynamodb/repositories/meeting-repository.ts',
  } as AccessPattern<{ ownerType: string; ownerName: string }>,
  meetingsAll: {
    name: 'meetingsAll', ...onAdmin('gsi4'),
    pk: () => KEYS.meetingsAll(),
    shape: 'MEETINGS / <nextOccurrence>',
    writer: 'packages/app/provider/dynamodb/repositories/meeting-repository.ts',
  } as AccessPattern<void>,

  // Edit / contact requests (USER#<target> / EDIT_REQUEST#<id> | CONTACT_REQUEST#<id>)
  editRequestByToken: {
    name: 'editRequestByToken', ...onAdmin('gsi4'),
    pk: (a: { token: string }) => KEYS.editRequestToken(a.token),
    shape: 'EDITREQTOKEN#<approvalToken> / EDIT_REQUEST',
    writer: 'packages/app/provider/dynamodb/repositories/edit-request-repository.ts',
  } as AccessPattern<{ token: string }>,
  editRequestsByRequester: {
    name: 'editRequestsByRequester', ...onAdmin('gsi1'),
    pk: (a: { email: string }) => KEYS.editRequestsBy(a.email),
    shape: 'EDITREQBY#<requester> / <createdAt>#<requestId>',
    writer: 'packages/app/provider/dynamodb/repositories/edit-request-repository.ts',
  } as AccessPattern<{ email: string }>,
  contactRequestsByRequester: {
    name: 'contactRequestsByRequester', ...onAdmin('gsi1'),
    pk: (a: { email: string }) => KEYS.contactRequestsBy(a.email),
    shape: 'CONTACTREQBY#<requester> / <createdAt>#<requestId>',
    writer: 'packages/app/provider/dynamodb/repositories/contact-request-repository.ts',
  } as AccessPattern<{ email: string }>,

  // YouTube OAuth (USER#<email> / OAUTH#youtube)
  youtubeOAuthAll: {
    name: 'youtubeOAuthAll', ...onAdmin('gsi4'),
    pk: () => KEYS.youtubeOAuthAll(),
    shape: 'OAUTH#youtube / USER#<email>',
    writer: 'packages/app/provider/dynamodb/repositories/youtube-oauth-repository.ts',
  } as AccessPattern<void>,

  // Mailing lists (LIST#<id> / DETAILS) and subscriptions (PERSON#<id> / SUB#<listId>#<emailId>)
  listsByTenant: {
    name: 'listsByTenant', ...onAdmin('gsi1'),
    pk: (a: { ownerType: string; ownerId: string }) => `TENANT#${a.ownerType}#${a.ownerId}`,
    shape: 'TENANT#<ownerType>#<ownerId> / <scope>#<name>',
    writer: 'packages/app/provider/dynamodb/repositories/mailing-list-repository.ts',
  } as AccessPattern<{ ownerType: string; ownerId: string }>,
  listsByScope: {
    name: 'listsByScope', ...onAdmin('gsi2'),
    pk: (a: { scope: string; scopeValue: string }) => `SCOPE#${a.scope}#${a.scopeValue}`,
    shape: 'SCOPE#<scope>#<value> / <ownerId>#<name>',
    writer: 'packages/app/provider/dynamodb/repositories/mailing-list-repository.ts',
  } as AccessPattern<{ scope: string; scopeValue: string }>,
  listsAll: {
    name: 'listsAll', ...onAdmin('gsi4'),
    pk: () => 'MAILING_LISTS',
    shape: 'MAILING_LISTS / <ownerType>#<ownerId>#<name>',
    writer: 'packages/app/provider/dynamodb/repositories/mailing-list-repository.ts',
  } as AccessPattern<void>,
  listSubscriptions: {
    name: 'listSubscriptions', ...onAdmin('gsi1'),
    pk: (a: { listId: string }) => `LISTSUB#${a.listId}`,
    sk: (a: { listId: string; email?: string }) => (a.email ? { eq: a.email.toLowerCase() } : undefined),
    shape: 'LISTSUB#<listId> / <email>',
    writer: 'packages/app/provider/dynamodb/repositories/mailing-list-repository.ts',
  } as AccessPattern<{ listId: string; email?: string }>,

  // Draft members, analytics, sends, exhorter heads-up
  draftMembersByStatus: {
    name: 'draftMembersByStatus', ...onAdmin('gsi1'),
    pk: (a: { status: 'pending' | 'approved' | 'rejected' }) => `DRAFT_STATUS#${a.status}`,
    shape: 'DRAFT_STATUS#<status> / <createdAt>',
    writer: 'packages/app/provider/dynamodb/repositories/draft-member-repository.ts',
  } as AccessPattern<{ status: 'pending' | 'approved' | 'rejected' }>,
  webAnalytics: {
    name: 'webAnalytics', ...onAdmin('gsi1'),
    pk: () => KEYS.webAnalytics(),
    sk: (a: { from: string; to: string }) => ({ between: [a.from, a.to] }),
    shape: 'ANALYTICS#WEB / <timestamp>',
    writer: 'packages/app/provider/dynamodb/repositories/analytics-repository.ts',
  } as AccessPattern<{ from: string; to: string }>,
  sendsByReason: {
    name: 'sendsByReason', ...onAdmin('gsi1'),
    pk: (a: { reason: string }) => `SENDS#${a.reason}`,
    shape: 'SENDS#<reason> / <sentAt>',
    writer: 'packages/app/provider/dynamodb/repositories/send-record-repository.ts',
  } as AccessPattern<{ reason: string }>,
  sendsAll: {
    name: 'sendsAll', ...onAdmin('gsi2'),
    pk: () => 'SENDS#ALL',
    shape: 'SENDS#ALL / <sentAt>',
    writer: 'packages/app/provider/dynamodb/repositories/send-record-repository.ts',
  } as AccessPattern<void>,
  exhorterPending: {
    name: 'exhorterPending', ...onAdmin('gsi1'),
    pk: () => 'EXHORTER_HEADSUP_PENDING',
    sk: (a: { fromDate?: string }) => (a.fromDate ? { gte: a.fromDate } : undefined),
    shape: 'EXHORTER_HEADSUP_PENDING / <date>#<token>',
    writer: 'packages/app/provider/dynamodb/repositories/exhorter-headsup-repository.ts',
  } as AccessPattern<{ fromDate?: string }>,
  exhorterReleaseToken: {
    name: 'exhorterReleaseToken', ...onAdmin('gsi4'),
    pk: (a: { token: string }) => `EXHORTER_RELEASE#${a.token}`,
    shape: 'EXHORTER_RELEASE#<token> / <expiresAt>',
    writer: 'packages/app/provider/dynamodb/repositories/exhorter-headsup-repository.ts',
  } as AccessPattern<{ token: string }>,

  // LEGACY (R8 deletes): the USER# NextAuth/credentials store
  legacyUserByEmail: {
    name: 'legacyUserByEmail', ...onAdmin('gsi1'),
    pk: (a: { email: string }) => `USER#${lower(a.email)}`,
    shape: 'USER#<addr> / …',
    writer: 'apps/next/utils/dynamodb/credentials-users.ts',
  } as AccessPattern<{ email: string }>,

  // ---------------------------------------------------------------------------
  // tee-schedules (PK/SK, GSI1/GSI2 — uppercase)
  // ---------------------------------------------------------------------------
  schedulesByType: {
    name: 'schedulesByType', table: SCHEDULES, index: undefined, pkAttr: 'PK', skAttr: 'SK',
    pk: (a: { type: string }) => `SCHEDULE#${a.type.toUpperCase()}`,
    shape: 'PK SCHEDULE#<TYPE> / SK DATE#<iso>#<index>',
    writer: 'packages/app/provider/dynamodb/repositories/schedule-repository.ts',
  } as AccessPattern<{ type: string }>,
  schedulesByEcclesia: {
    name: 'schedulesByEcclesia', table: SCHEDULES, index: 'GSI1', pkAttr: 'GSI1PK', skAttr: 'GSI1SK',
    pk: (a: { ecclesia: string }) => `ECCLESIA#${a.ecclesia}`,
    sk: (a: { ecclesia: string; from?: string; to?: string }) =>
      a.from && a.to ? { between: [a.from, a.to] } : undefined,
    shape: 'GSI1 ECCLESIA#<name> / <date>#<type>#<time>',
    writer: 'packages/app/provider/dynamodb/repositories/schedule-repository.ts',
  } as AccessPattern<{ ecclesia: string; from?: string; to?: string }>,
  eventsByDate: {
    name: 'eventsByDate', table: SCHEDULES, index: 'GSI1', pkAttr: 'GSI1PK', skAttr: 'GSI1SK',
    pk: () => 'EVENTS',
    sk: (a: { from?: string; to?: string }) => (a.from && a.to ? { between: [a.from, a.to] } : undefined),
    shape: 'GSI1 EVENTS / <date>#<eventId>',
    writer: 'packages/app/services/event-service.ts',
  } as AccessPattern<{ from?: string; to?: string }>,
  newsAll: {
    name: 'newsAll', table: SCHEDULES, index: 'GSI1', pkAttr: 'GSI1PK', skAttr: 'GSI1SK',
    pk: () => 'NEWS',
    shape: 'GSI1 NEWS / <publishedAt>#<newsId>',
    writer: 'packages/app/services/news-service.ts',
  } as AccessPattern<void>,
  schedulesByTypeGsi2: {
    name: 'schedulesByTypeGsi2', table: SCHEDULES, index: 'GSI2', pkAttr: 'GSI2PK', skAttr: 'GSI2SK',
    pk: (a: { key: string }) => a.key,
    sk: (a: { key: string; from?: string; to?: string }) =>
      a.from && a.to ? { between: [a.from, a.to] } : undefined,
    shape: 'GSI2 TYPE#<type> | DATE#<date> / <date>#<time> | <time>',
    writer: 'packages/app/provider/dynamodb/repositories/schedule-repository.ts (createEventRecord, deprecated)',
  } as AccessPattern<{ key: string; from?: string; to?: string }>,

  // ---------------------------------------------------------------------------
  // tee-send-queue (PK/SK, StatusIndex on GSI1PK/GSI1SK)
  // ---------------------------------------------------------------------------
  sendQueueByStatus: {
    name: 'sendQueueByStatus', table: SEND_QUEUE, index: 'StatusIndex', pkAttr: 'GSI1PK', skAttr: 'GSI1SK',
    pk: (a: { status: string }) => a.status,
    shape: 'StatusIndex <status> / <scheduledFor>',
    writer: 'packages/app/provider/dynamodb/repositories/send-queue-repository.ts',
  } as AccessPattern<{ status: string }>,
} as const

export type PatternName = keyof typeof PATTERNS

// ---------------------------------------------------------------------------
// Building requests
// ---------------------------------------------------------------------------

export interface PatternQueryInput {
  TableName: string
  IndexName?: string
  KeyConditionExpression: string
  ExpressionAttributeValues: Record<string, any>
}

/**
 * The Query input for a pattern. Placeholder names are `:apPk`, `:apSk`,
 * `:apSk2` so a caller's own FilterExpression values cannot collide.
 */
export function patternQuery<A>(pattern: AccessPattern<A>, args: A): PatternQueryInput {
  const values: Record<string, any> = { ':apPk': pattern.pk(args) }
  let expr = `${pattern.pkAttr} = :apPk`
  const sk = pattern.sk?.(args)
  if (sk) {
    const a = pattern.skAttr
    if ('eq' in sk) {
      expr += ` AND ${a} = :apSk`
      values[':apSk'] = sk.eq
    } else if ('beginsWith' in sk) {
      expr += ` AND begins_with(${a}, :apSk)`
      values[':apSk'] = sk.beginsWith
    } else if ('between' in sk) {
      expr += ` AND ${a} BETWEEN :apSk AND :apSk2`
      values[':apSk'] = sk.between[0]
      values[':apSk2'] = sk.between[1]
    } else {
      expr += ` AND ${a} >= :apSk`
      values[':apSk'] = sk.gte
    }
  }
  return {
    TableName: pattern.table,
    ...(pattern.index ? { IndexName: pattern.index } : {}),
    KeyConditionExpression: expr,
    ExpressionAttributeValues: values,
  }
}

/** The key attributes a writer stores so an item appears in a pattern. */
export function patternEntry<A>(pattern: AccessPattern<A>, args: A, sortValue: string): Record<string, string> {
  if (!pattern.index) throw new Error(`${pattern.name} is a base-table pattern; its keys are pkey/skey`)
  return { [pattern.pkAttr]: pattern.pk(args), [pattern.skAttr]: sortValue }
}

/**
 * The sparse entries added with the registry, derived from the item's own
 * fields. Writers spread these into the item; the backfill script uses the
 * same functions, so the two can never disagree.
 */
export const ENTRIES = {
  organization: (o: { name: string; country: string; province: string; city: string }) =>
    patternEntry(PATTERNS.organizationsAll, undefined, `${o.country}|${o.province}|${o.city}#${o.name}`),
  /** gsi4 everyone + gsi3 series (when the post has one). `sortKey` is the post's `<sortDate>#<id>`. */
  post: (p: { seriesId?: string | null; sortKey: string }) => ({
    ...patternEntry(PATTERNS.postsAll, undefined, p.sortKey),
    ...(p.seriesId ? patternEntry(PATTERNS.postsBySeries, { seriesId: p.seriesId }, p.sortKey) : {}),
  }),
  meeting: (m: { nextOccurrence?: string | null }) =>
    patternEntry(PATTERNS.meetingsAll, undefined, m.nextOccurrence ?? '9999-12-31'),
  editRequest: (r: { approvalToken: string; requesterEmail: string; createdAt: string; requestId: string }) => ({
    ...patternEntry(PATTERNS.editRequestByToken, { token: r.approvalToken }, 'EDIT_REQUEST'),
    ...patternEntry(PATTERNS.editRequestsByRequester, { email: r.requesterEmail }, `${r.createdAt}#${r.requestId}`),
  }),
  contactRequest: (r: { requesterEmail: string; createdAt: string; requestId: string }) =>
    patternEntry(PATTERNS.contactRequestsByRequester, { email: r.requesterEmail }, `${r.createdAt}#${r.requestId}`),
  youtubeOAuth: (t: { pkey: string }) => patternEntry(PATTERNS.youtubeOAuthAll, undefined, t.pkey),
  otp: (t: { email: string; createdAt: string }) => patternEntry(PATTERNS.otpByEmail, { email: t.email }, t.createdAt),
} as const
