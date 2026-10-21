import { describe, it, expect, beforeAll, vi } from 'vitest'

// tests/setup.ts mocks the SES SDK for every test; this one needs the real client.
vi.unmock('@aws-sdk/client-sesv2')
import { Readable } from 'stream'
import { HttpResponse } from '@smithy/protocol-http'
import { ListContactListsCommand } from '@aws-sdk/client-sesv2'

beforeAll(() => {
  process.env.AWS_ACCESS_KEY_ID = 'test'
  process.env.AWS_SECRET_ACCESS_KEY = 'test'
})

describe('usePacedSesClient', () => {
  it('spaces admin SES calls at the set rate, even when fired together', async () => {
    const { usePacedSesClient, getSesClient } = await import('../utils/email/sesClient')
    const client = usePacedSesClient(20) // one call per 50ms
    expect(getSesClient()).toBe(client)

    const sentAt: number[] = []
    client.config.requestHandler = {
      handle: async () => {
        sentAt.push(Date.now())
        return {
          response: new HttpResponse({
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: Readable.from(['{}']),
          }),
        }
      },
    } as any

    await Promise.all(Array.from({ length: 4 }, () => client.send(new ListContactListsCommand({}))))

    expect(sentAt).toHaveLength(4)
    for (let i = 1; i < sentAt.length; i++) {
      expect(sentAt[i] - sentAt[i - 1]).toBeGreaterThanOrEqual(45)
    }
  })
})
