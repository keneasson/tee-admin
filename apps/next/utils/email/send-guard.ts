import { isUndeliverableAddress } from '@my/app/utils/test-personas'

/**
 * THE one send-layer guard (#349): never send to an undeliverable address
 * (the reserved `.invalid` domain, which every test persona uses). Called
 * immediately before each SES call in `sendEmail` and `chunkSend`, so every
 * path (broadcast, cron queue, 1:1 send, transactional) inherits it.
 */
export function shouldSkipRecipient(email: string | null | undefined): boolean {
  return isUndeliverableAddress(email)
}

/** The addresses that may be sent to (test personas / `.invalid` dropped). */
export function dropUnsendable<T extends string>(emails: T[]): T[] {
  return emails.filter((e) => !shouldSkipRecipient(e))
}
