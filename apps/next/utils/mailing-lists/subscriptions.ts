import type { ListSubscriptionRecord, PersonRecord } from '@my/app/provider/dynamodb/types'

/**
 * Subscribe / unsubscribe one address on one list in the registry (R5).
 *
 * Rows are matched BY ADDRESS on the list (LISTSUB#{listId} / email), not by
 * person, because a household address can belong to two people (#267) and the
 * backfill wrote the row under whichever person the address resolves to. So:
 *  - unsubscribe flips EVERY row for that address on the list to opt_out;
 *  - subscribe flips existing rows back to opt_in, or, when none exists,
 *    writes one under the person the address resolves to.
 * Rows are never deleted (audit trail).
 */

/** The person + EMAIL# row an address resolves to. */
export interface ResolvedSubscriber {
  personId: string
  emailId: string
  email: string
}

export interface SubscriberLookupDeps {
  getByEmail: (email: string) => Promise<PersonRecord | null>
  getAllPersonsByEmail: (email: string) => Promise<PersonRecord[]>
  getEmails: (personId: string) => Promise<Array<{ emailId: string; email: string }>>
}

/**
 * Resolve an address to the person who holds it and that person's EMAIL# row.
 * The sign-in holder (getByEmail) wins; otherwise the first person holding it as
 * a secondary. Null when no PersonRecord holds the address.
 */
export async function resolveSubscriber(
  email: string,
  deps: SubscriberLookupDeps
): Promise<ResolvedSubscriber | null> {
  const lower = email.trim().toLowerCase()
  const primary = await deps.getByEmail(lower)
  const persons = primary ? [primary] : await deps.getAllPersonsByEmail(lower)
  for (const person of persons) {
    const rows = await deps.getEmails(person.personId)
    const row = rows.find((e) => e.email.toLowerCase() === lower)
    if (row) return { personId: person.personId, emailId: row.emailId, email: lower }
  }
  return null
}

export interface SetSubscriptionDeps extends SubscriberLookupDeps {
  getListSubscriptionsForEmail: (listId: string, email: string) => Promise<ListSubscriptionRecord[]>
  setSubscriptionStatus: (
    row: Pick<ListSubscriptionRecord, 'pkey' | 'skey'>,
    status: ListSubscriptionRecord['status']
  ) => Promise<unknown>
  subscribe: (input: {
    personId: string
    listId: string
    emailId: string
    email: string
    source: ListSubscriptionRecord['source']
    basis: ListSubscriptionRecord['basis']
  }) => Promise<unknown>
}

export type SetSubscriptionResult = 'subscribed' | 'unsubscribed' | 'unchanged' | 'no-person'

export async function setListSubscription(
  input: { listId: string; email: string; subscribed: boolean },
  deps: SetSubscriptionDeps
): Promise<SetSubscriptionResult> {
  const email = input.email.trim().toLowerCase()
  const want: ListSubscriptionRecord['status'] = input.subscribed ? 'opt_in' : 'opt_out'
  const rows = await deps.getListSubscriptionsForEmail(input.listId, email)

  if (rows.length > 0) {
    const toFlip = rows.filter((r) => r.status !== want)
    for (const row of toFlip) await deps.setSubscriptionStatus(row, want)
    if (toFlip.length === 0) return 'unchanged'
    return input.subscribed ? 'subscribed' : 'unsubscribed'
  }

  if (!input.subscribed) return 'unchanged' // nothing to opt out of

  const who = await resolveSubscriber(email, deps)
  if (!who) return 'no-person'
  await deps.subscribe({
    personId: who.personId,
    listId: input.listId,
    emailId: who.emailId,
    email,
    source: 'self',
    basis: 'express',
  })
  return 'subscribed'
}

/** Production wiring (lazy, so importing this module for its pure logic stays AWS-free). */
export async function defaultSubscriptionDeps(): Promise<SetSubscriptionDeps> {
  const [{ personRepository }, { mailingListRepository }] = await Promise.all([
    import('@my/app/provider/dynamodb/repositories/person-repository'),
    import('@my/app/provider/dynamodb/repositories/mailing-list-repository'),
  ])
  return {
    getByEmail: (e) => personRepository.getByEmail(e),
    getAllPersonsByEmail: (e) => personRepository.getAllPersonsByEmail(e),
    getEmails: (id) => personRepository.getEmails(id),
    getListSubscriptionsForEmail: (l, e) => mailingListRepository.getListSubscriptionsForEmail(l, e),
    setSubscriptionStatus: (row, s) => mailingListRepository.setSubscriptionStatus(row, s),
    subscribe: (i) => mailingListRepository.subscribe(i),
  }
}
