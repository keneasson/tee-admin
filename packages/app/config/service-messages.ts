/**
 * "No in-person services" notice — shown in the Newsletter and Memorial (recap)
 * emails and the app UI when the in-person Sunday services are cancelled (with or
 * without a replacement event).
 *
 * Previously this wording was hardcoded in the email templates (issue #45), which
 * meant a same-day wording change required a code change + PR + deploy, and could
 * not vary per ecclesia. The message is now DATA:
 *   1. Primary source: the admin sets it on the replacement event in the Event
 *      Editor (`Event.noInPersonServicesMessage`).
 *   2. Fallback: this default constant when unset.
 *
 * The default lives here — a single config constant, NOT baked into the template —
 * so both the replacement-event path and the no-replacement fallback resolve
 * against the same source and cannot diverge. This is also the seam where a
 * per-tenant/per-ecclesia default plugs in (pass it as `fallback`).
 *
 * Kept dependency-free (no Node/Next imports) so it is safe to import from the
 * react-email server render path and from shared cross-platform UI.
 */

/** Toronto East default. Kept as the existing wording so nothing changes visually when unset. */
export const DEFAULT_NO_IN_PERSON_SERVICES_MESSAGE =
  'There will be no IN PERSON Services at Toronto East, Zoom and YouTube will remain unchanged.'

/**
 * Resolve the "no in-person services" message for display.
 *
 * @param message  Admin-set message from the replacement event (if any).
 * @param fallback Default to use when `message` is empty/unset. Defaults to the
 *                 Toronto East wording; callers with tenant context may pass an
 *                 ecclesia-specific default here.
 */
export function resolveNoInPersonServicesMessage(
  message?: string | null,
  fallback: string = DEFAULT_NO_IN_PERSON_SERVICES_MESSAGE
): string {
  const trimmed = typeof message === 'string' ? message.trim() : ''
  return trimmed ? trimmed : fallback
}
