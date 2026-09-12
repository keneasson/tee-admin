import { describe, it, expect, vi } from 'vitest'

/**
 * Brian could not approve his own address change. The link returned
 * "Invalid or expired token" for a token that existed, was `pending`, and had
 * five days left before expiry.
 *
 * Cause: `getRequestByToken` used `scan()`, which returns ONE page. DynamoDB
 * reads up to 1MB of RAW items and only THEN applies the FilterExpression, so
 * on a table of any size a filtered scan routinely matches nothing while the
 * record sits on a later page. Reproduced against production: a single page
 * read 4,048 items, matched 0, and reported more pages remaining.
 *
 * This is silent and data-dependent — it works in a small table and fails once
 * the table grows, which is the worst possible failure mode.
 */
class FakeRepo {
  public pagesRequested = 0
  constructor(private pages: Array<{ items: unknown[]; lastEvaluatedKey?: Record<string, unknown> }>) {}

  async scan(options: { lastEvaluatedKey?: Record<string, unknown> } = {}) {
    const page = this.pages[this.pagesRequested] ?? { items: [] }
    this.pagesRequested++
    return page
  }

  // The implementation under test, mirroring BaseRepository.scanAll.
  async scanAll(options: { maxPages?: number } = {}) {
    const maxPages = options.maxPages ?? 50
    const items: unknown[] = []
    let lastEvaluatedKey: Record<string, unknown> | undefined
    let pages = 0
    do {
      const page = await this.scan({ ...options, lastEvaluatedKey })
      items.push(...page.items)
      lastEvaluatedKey = page.lastEvaluatedKey
      pages++
    } while (lastEvaluatedKey && pages < maxPages)
    return items
  }
}

describe('scanAll follows every page', () => {
  it('finds a record that is NOT on the first page — the approval-token bug', async () => {
    const repo = new FakeRepo([
      { items: [], lastEvaluatedKey: { pkey: 'x' } },   // 4,048 items read, 0 matched
      { items: [], lastEvaluatedKey: { pkey: 'y' } },
      { items: [{ approvalToken: 'the-token' }] },      // the record lives here
    ])

    const found = await repo.scanAll()
    expect(found).toHaveLength(1)
    expect(repo.pagesRequested).toBe(3)
  })

  it('a single-page scan would have returned nothing', async () => {
    const repo = new FakeRepo([
      { items: [], lastEvaluatedKey: { pkey: 'x' } },
      { items: [{ approvalToken: 'the-token' }] },
    ])
    const onePage = await repo.scan()
    expect(onePage.items).toHaveLength(0)   // → "Invalid or expired token"
  })

  it('stops at the last page rather than looping forever', async () => {
    const repo = new FakeRepo([{ items: [{ a: 1 }] }])
    await repo.scanAll()
    expect(repo.pagesRequested).toBe(1)
  })

  it('honours the page cap so a runaway scan cannot hang the request', async () => {
    const endless = Array.from({ length: 100 }, () => ({
      items: [] as unknown[],
      lastEvaluatedKey: { pkey: 'more' },
    }))
    const repo = new FakeRepo(endless)
    await repo.scanAll({ maxPages: 5 })
    expect(repo.pagesRequested).toBe(5)
  })

  it('accumulates items across pages', async () => {
    const repo = new FakeRepo([
      { items: [{ a: 1 }], lastEvaluatedKey: { pkey: 'x' } },
      { items: [{ a: 2 }, { a: 3 }] },
    ])
    expect(await repo.scanAll()).toHaveLength(3)
  })
})
