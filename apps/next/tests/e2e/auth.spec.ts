import { test, expect } from '@playwright/test'

test.describe('Auth Pages', () => {
  test('signin page loads successfully', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Check that the page loads without errors
    await expect(page).toHaveTitle(/Toronto East Christadelphians/)
    
    // Wait for content to load after hydration
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    
    // Check that the page loads and is not a 404
    await expect(page.locator('text=404')).not.toBeVisible()
    
    // Check for signin form elements
    await expect(page.locator('text=Welcome Back')).toBeVisible()
    await expect(page.locator('text=Sign in to your TEE Admin account')).toBeVisible()
    
    // Check for form fields
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('register page loads successfully', async ({ page }) => {
    await page.goto('/auth/register')
    
    // Check basic page load
    await expect(page).toHaveTitle(/Toronto East Christadelphians/)
    await page.waitForLoadState('networkidle')
    
    // Should not be a 404
    await expect(page.locator('text=404')).not.toBeVisible()
  })

  test('all auth routes exist and load', async ({ page }) => {
    const authRoutes = [
      '/auth/signin',
      '/auth/register',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/verify-email-sent',
      '/auth/resend-verification'
    ]

    for (const route of authRoutes) {
      const response = await page.goto(route)
      
      // Should not be a 404 error
      expect(response?.status()).not.toBe(404)
      
      // Should be a successful load
      expect(response?.status()).toBe(200)
    }
  })
})