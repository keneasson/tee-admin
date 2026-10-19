/**
 * How many self-serve lists an address is subscribed to (R5: read from the
 * mailing-list registry; SES topics no longer hold subscriptions). Shown on
 * the profile's email addresses. The file keeps its pre-R5 name so callers and
 * their test mocks are unchanged.
 *
 * Counts explicit opt_in rows on active self-serve lists (a list's
 * defaultOptIn is not counted here). Returns `undefined` when the lookup fails
 * (so callers can hide the count rather than show a misleading zero).
 */
export async function getPublicOptInCount(email: string): Promise<number | undefined> {
  try {
    const [{ mailingListRepository }, { isSelfServe }] = await Promise.all([
      import('@my/app/provider/dynamodb/repositories/mailing-list-repository'),
      import('../mailing-lists/preferences'),
    ])
    const lists = (await mailingListRepository.listAllLists()).filter(isSelfServe)
    const rows = await Promise.all(
      lists.map((l) => mailingListRepository.getListSubscriptionsForEmail(l.listId, email))
    )
    return rows.filter((r) => r.some((row) => row.status === 'opt_in')).length
  } catch (error: any) {
    console.error('getPublicOptInCount failed', error?.name || error)
    return undefined
  }
}
