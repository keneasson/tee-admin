import { describe, it, expect } from 'vitest'
import { marshall } from '@aws-sdk/util-dynamodb'

/**
 * `convertEmptyValues: true` is legacy AWS SDK v2 behaviour that rewrites every
 * empty string to a DynamoDB NULL on write. DynamoDB has allowed empty strings
 * on non-key attributes since 2020, so it corrupted data for no benefit —
 * silently, across every repository sharing the client.
 *
 * It produced two production defects and a table full of NULLs:
 *   - the doc editor crashed on any post with an untouched text block, because
 *     `{ body: '' }` read back as `{ body: null }` and `body.split()` threw (#214);
 *   - an ecclesia saved with an unparsed address stored province/city as NULL,
 *     giving the key `ECCLESIA#CA|` + `#Grand River` — written successfully and
 *     permanently unlistable;
 *   - a live scan found 127 NULL attributes across 52 records, including
 *     `firstName`/`lastName`/`displayName` on real PersonRecords (the
 *     always-shown PII floor) and a `primaryEmail`.
 *
 * This pins the behaviour so the flag cannot quietly come back.
 */
describe('DynamoDB marshalling must preserve empty strings', () => {
  it('an empty string stays a string when convertEmptyValues is off', () => {
    const out = marshall({ body: '' }, { convertEmptyValues: false })
    expect(out.body).toEqual({ S: '' })
    expect(out.body).not.toEqual({ NULL: true })
  })

  it('demonstrates the corruption the old setting caused', () => {
    const out = marshall({ body: '' }, { convertEmptyValues: true })
    expect(out.body).toEqual({ NULL: true })
  })

  it('removeUndefinedValues still drops absent fields — that stays on', () => {
    const out = marshall(
      { present: 'x', absent: undefined },
      { convertEmptyValues: false, removeUndefinedValues: true }
    )
    expect(out.present).toEqual({ S: 'x' })
    expect(out.absent).toBeUndefined()
  })

  it('the shipped config does not convert empty values', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('../../packages/app/provider/dynamodb/config.ts', 'utf8')
    )
    expect(src).toMatch(/convertEmptyValues:\s*false/)
    expect(src).not.toMatch(/convertEmptyValues:\s*true/)
  })
})
