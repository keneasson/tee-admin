import { describe, it, expect } from 'vitest'

/**
 * "Grand River" was added, saved successfully, and then could not be listed or
 * searched. It is still in the table as:
 *
 *   pkey: 'ECCLESIA#CA|'   skey: '#Grand River'   gsi1sk: 'CA||'
 *
 * against everyone else's `ECCLESIA#CA|ON` + `Brantford#Brant County`.
 *
 * Province and city are KEY MATERIAL — `createEcclesia` interpolates them into
 * `pkey`/`skey` — but the create route required only `name`, so a failed address
 * lookup (Places is unconfigured in production, and fails silently) left them
 * empty and produced a record that every geographic read filters straight past.
 */
const buildKeys = (country: string, province: string, city: string, name: string) => ({
  pkey: `ECCLESIA#${country}|${province}`,
  skey: `${city}#${name}`,
})

describe('the shape that made Grand River invisible', () => {
  it('an empty province yields a key no geographic read can match', () => {
    const broken = buildKeys('CA', '', '', 'Grand River')
    expect(broken.pkey).toBe('ECCLESIA#CA|')
    expect(broken.skey).toBe('#Grand River')
    // Every other record carries province and city.
    const good = buildKeys('CA', 'ON', 'Paris', 'Grand River')
    expect(good.pkey).toBe('ECCLESIA#CA|ON')
    expect(good.skey).toBe('Paris#Grand River')
  })
})

describe('createEcclesia refuses incomplete key material', () => {
  const load = async () => (await import('../utils/dynamodb/locations')).createEcclesia

  it('rejects an empty province rather than writing an invisible record', async () => {
    const createEcclesia = await load()
    await expect(
      createEcclesia({ name: 'Grand River', country: 'CA', province: '', city: 'Paris' } as never)
    ).rejects.toThrow(/province/)
  })

  it('rejects an empty city', async () => {
    const createEcclesia = await load()
    await expect(
      createEcclesia({ name: 'Grand River', country: 'CA', province: 'ON', city: '' } as never)
    ).rejects.toThrow(/city/)
  })

  it('rejects a NON-STRING province — how province/city became booleans', async () => {
    const createEcclesia = await load()
    await expect(
      createEcclesia({
        name: 'Grand River',
        country: 'CA',
        province: true,
        city: true,
      } as never)
    ).rejects.toThrow(/province/)
  })
})
