import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Speaker invitations — invitee page regressions (SPEAKER_INVITATIONS.md §6, §10).
 *
 * Every API call is mocked with `page.route`: these tests never reach a real
 * route, session or database. All names and addresses are placeholders.
 */

const INVITE_ID = 'inv-test-0001'
const TOKEN = 'test-token'
const D1 = '2030-03-03'
const D2 = '2030-03-10'
const D3 = '2030-03-17'

const slot = (date: string, state: 'OPEN' | 'FILLED' | 'NO_MEETING' = 'OPEN', extra: Record<string, unknown> = {}) => ({
  date,
  time: '11:00',
  tz: 'America/Toronto',
  state,
  ...extra,
})

function invite(overrides: Record<string, unknown> = {}) {
  return {
    inviteId: INVITE_ID,
    ecclesia: 'Example Ecclesia',
    type: 'memorial',
    status: 'sent',
    invitee: { firstName: 'Sam', lastName: 'Placeholder' },
    inviter: { name: 'Pat Inviter', email: 'inviter@example.test' },
    offeredDates: [slot(D1), slot(D2), slot(D3, 'FILLED', { speakerName: 'Alex' })],
    otherDates: null,
    swapAvailable: false,
    ...overrides,
  }
}

const accepted = (date: string) =>
  invite({ status: 'accepted', acceptedDate: date, acceptedTime: '11:00', acceptedTz: 'America/Toronto', swapAvailable: true })

/** next-auth client endpoints, signed out unless `session` says otherwise. */
async function mockAuth(page: Page, calls: string[], session: () => Record<string, unknown> = () => ({})) {
  await page.route('**/api/auth/**', async (route: Route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api/auth/', '')
    calls.push(`${route.request().method()} ${path}`)
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    if (path === 'session') return json(session())
    if (path === 'csrf') return json({ csrfToken: 'csrf' })
    if (path === 'providers') return json({ otp: { id: 'otp', name: 'OTP', type: 'credentials' } })
    if (path === 'signout') return json({ url: `${url.origin}/` })
    if (path.startsWith('callback/')) return json({ url: `${url.origin}/` })
    if (path.startsWith('resolve-signin-token')) return json({ valid: true, expired: false, email: 'speaker@example.test' })
    return json({})
  })
  // Notification polling etc. — nothing else may reach the server.
  await page.route('**/api/notifications/**', (route) => route.fulfill({ status: 401, body: '{}' }))
}

test.describe('Speaker invitation page', () => {
  test('a preselected date changes nothing until Confirm is pressed', async ({ page }) => {
    const posts: unknown[] = []
    await mockAuth(page, [])
    await page.route(`**/api/invite/${INVITE_ID}**`, async (route) => {
      if (route.request().method() === 'POST') {
        posts.push(route.request().postDataJSON())
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ invite: accepted(D2) }) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ invite: invite(), actor: { trust: 'recognized' } }) })
    })

    await page.goto(`/invite/${INVITE_ID}?token=${TOKEN}&date=${D2}`)
    await expect(page.getByTestId('invite-heading')).toHaveText('Invitation for Brother Placeholder')
    await expect(page.getByText('(Not Brother Placeholder? Sign in again)')).toBeVisible()

    const confirm = page.getByTestId('invite-confirm')
    await expect(confirm).toContainText('Confirm')
    await expect(confirm).toContainText('10')
    // The filled date is shown, labelled, and not selectable.
    await expect(page.getByTestId(`offered-date-${D3}`)).toContainText('Filled: Alex')

    await page.waitForTimeout(500)
    expect(posts).toHaveLength(0)

    await confirm.click()
    await expect(page.getByTestId('booking')).toBeVisible()
    expect(posts).toEqual([{ action: 'accept', date: D2, token: TOKEN }])
    await expect(page.getByTestId('ics-link')).toHaveAttribute('href', `/api/invite/${INVITE_ID}/ics?token=${TOKEN}`)
  })

  test('SLOT_TAKEN shows "just taken" and the dates still open', async ({ page }) => {
    await mockAuth(page, [])
    await page.route(`**/api/invite/${INVITE_ID}**`, async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'That date was just taken.', code: 'SLOT_TAKEN', openDates: [slot(D1)] }),
        })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ invite: invite(), actor: { trust: 'recognized' } }) })
    })

    await page.goto(`/invite/${INVITE_ID}?token=${TOKEN}&date=${D2}`)
    await page.getByTestId('invite-confirm').click()
    await expect(page.getByTestId('slot-taken')).toContainText('That date was just taken')
    await expect(page.getByTestId(`offered-date-${D1}`)).toBeVisible()
    await expect(page.getByTestId(`offered-date-${D2}`)).toHaveCount(0)
    await expect(page.getByTestId('invite-confirm')).toContainText('Choose a date')
  })

  test('signed in as someone else: signs out, switches to the speaker, and says so', async ({ page }) => {
    const authCalls: string[] = []
    let gets = 0
    await mockAuth(page, authCalls)
    await page.route(`**/api/invite/${INVITE_ID}**`, async (route) => {
      gets++
      if (gets === 1) {
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'You are signed in as someone else.', code: 'SESSION_MISMATCH', mismatch: true, trust: 'authenticated' }),
        })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ invite: invite(), actor: { trust: 'recognized' } }) })
    })

    await page.goto(`/invite/${INVITE_ID}?token=${TOKEN}`)
    await expect(page.getByTestId('invite-switched-notice')).toHaveText(
      "You were signed in as someone else, so we've switched to Sam's invitation."
    )
    expect(authCalls).toContain('POST signout')
    expect(authCalls).toContain('POST callback/otp')
  })

  test('a cancelled invitation shows a clear message and the sender', async ({ page }) => {
    await mockAuth(page, [])
    await page.route(`**/api/invite/${INVITE_ID}**`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ invite: invite({ status: 'cancelled' }), actor: { trust: 'recognized' } }) })
    )
    await page.goto(`/invite/${INVITE_ID}?token=${TOKEN}`)
    await expect(page.getByTestId('invite-closed')).toContainText('This invitation was cancelled')
    await expect(page.getByTestId('inviter-contact')).toContainText('Pat Inviter')
  })

  test('a swap link with ?action=accept preselects only; nothing posts until the button', async ({ page }) => {
    const posts: unknown[] = []
    await mockAuth(page, [])
    const swap = (status: string) => ({
      swapId: 'swap-test-0001',
      ecclesia: 'Example Ecclesia',
      type: 'memorial',
      status,
      requester: { name: 'Alex', date: D1, time: '11:00', tz: 'America/Toronto' },
      target: { name: 'Sam Placeholder', date: D2, time: '11:00', tz: 'America/Toronto' },
      expiresAt: '2030-03-01T00:00:00.000Z',
    })
    await page.route('**/api/invite/swap/swap-test-0001**', async (route) => {
      if (route.request().method() === 'POST') {
        posts.push(route.request().postDataJSON())
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ swap: swap('accepted') }) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ swap: swap('open'), actor: { trust: 'recognized' } }) })
    })
    await page.goto(`/invite/swap/swap-test-0001?token=${TOKEN}&action=accept`)
    await expect(page.getByTestId('swap-preselected')).toBeVisible()
    await page.waitForTimeout(500)
    expect(posts).toHaveLength(0)
    await page.getByTestId('swap-accept').click()
    await expect(page.getByTestId('swap-outcome')).toContainText('Swap done')
    expect(posts).toEqual([{ action: 'accept', token: TOKEN }])
  })
})
