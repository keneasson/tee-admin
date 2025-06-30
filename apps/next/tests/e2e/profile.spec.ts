import { test, expect } from '@playwright/test'

test.describe('Profile Page', () => {
  test('redirects unauthenticated users', async ({ page }) => {
    await page.goto('/profile')
    
    // Should redirect to auth page for unauthenticated users
    await page.waitForURL(/\/auth/)
    
    // Check that we're on an authentication page
    expect(page.url()).toMatch(/\/auth/)
  })

  test('loads auth page after redirect', async ({ page }) => {
    await page.goto('/profile')
    
    // Should redirect to auth page
    await page.waitForURL(/\/auth/)
    
    // Check that we're on an authentication page
    expect(page.url()).toMatch(/\/auth/)
  })

  test('profile page structure exists', async ({ page }) => {
    // Test that the profile route exists and redirects properly
    const response = await page.goto('/profile')
    
    // Should not be a 404 error
    expect(response?.status()).not.toBe(404)
    
    // Should be a redirect for unauthenticated users
    expect(response?.status()).toBe(200) // After redirect follows
    
    // Should end up on auth page
    expect(page.url()).toMatch(/\/auth/)
  })

  // Note: Testing authenticated profile functionality would require
  // setting up authentication in the test environment, which is complex
  // For now, we're testing that the route exists and handles auth correctly
})