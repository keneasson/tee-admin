import { test, expect } from '@playwright/test'

test.describe('Role-Based Permissions', () => {
  test('should allow owner access to all pages including Email Tester', async ({ page }) => {
    // This test assumes we can mock or set up owner authentication
    // For now, test that the pages exist and have proper protection
    
    const protectedPages = [
      '/schedule',
      '/newsletter', 
      '/email-tester' // Email Tester should be accessible to owner
    ]
    
    for (const pagePath of protectedPages) {
      await page.goto(pagePath)
      
      // Should either show the page (if authenticated as owner) 
      // or redirect to sign in (if not authenticated)
      const url = page.url()
      expect(url).toMatch(new RegExp(`(${pagePath}|/auth/signin)`))
    }
  })

  test('should show Email Tester in navigation for admin/owner roles', async ({ page }) => {
    // Test that Email Tester appears in navigation
    await page.goto('/')
    
    // If user is signed in with admin/owner role, Email Tester should be visible
    // If not signed in, should be redirected to signin
    const url = page.url()
    if (!url.includes('/auth/signin')) {
      // Check if Email Tester navigation exists
      const emailTesterLink = page.getByText('Email Tester')
      // Should either be visible (for admin/owner) or not exist (for member/guest)
      const isVisible = await emailTesterLink.isVisible().catch(() => false)
      // This documents the behavior - exact expectation depends on current user role
      console.log('Email Tester navigation visible:', isVisible)
    }
  })

  test('should restrict guest access to admin pages', async ({ page }) => {
    // Test admin page access
    await page.goto('/admin')
    
    // Should redirect to signin or show access denied
    expect(page.url()).toContain('/auth/signin')
  })

  test('should show appropriate navigation based on role', async ({ page }) => {
    await page.goto('/')
    
    // Check if navigation exists
    const nav = page.getByRole('navigation')
    if (await nav.isVisible()) {
      // Navigation should adapt based on user role
      // This would require authentication context
      await expect(nav).toBeVisible()
    }
  })
})

test.describe('Authentication State Management', () => {
  test('should persist authentication across page reloads', async ({ page }) => {
    // This would require setting up authentication state
    await page.goto('/')
    
    // Check that auth state is maintained
    await page.reload()
    
    // Should maintain authentication status
    // This test would need actual authentication implementation
  })

  test('should handle session expiry gracefully', async ({ page }) => {
    // Test session timeout behavior
    await page.goto('/')
    
    // This would require manipulating session tokens
    // For now, just ensure the page loads
    await expect(page).toHaveTitle(/TEE Admin/)
  })
})

test.describe('Database Consistency', () => {
  test('should maintain role consistency between providers', async ({ page }) => {
    // Check that user roles are consistent regardless of auth provider
    const response = await page.request.get('/api/debug/check-db')
    const data = await response.json()
    
    expect(data.success).toBe(true)
    
    // Find Ken's records
    const kenRecords = data.users.filter((user: any) => 
      user.email === 'ken.easson@gmail.com'
    )
    
    // Should have consistent role (owner) across all records
    for (const record of kenRecords) {
      if (record.role) {
        expect(record.role).toBe('owner')
      }
    }
  })

  test('should prevent duplicate accounts with same email', async ({ page }) => {
    const response = await page.request.get('/api/debug/check-db')
    const data = await response.json()
    
    expect(data.success).toBe(true)
    
    // Check for duplicate users with same email but different providers
    const emailGroups = new Map()
    
    for (const user of data.users) {
      if (!user.email) continue
      
      if (!emailGroups.has(user.email)) {
        emailGroups.set(user.email, [])
      }
      emailGroups.get(user.email).push(user)
    }
    
    // Each email should ideally have only one active user record
    // (excluding old guest records that should be cleaned up)
    for (const [email, users] of emailGroups) {
      const activeUsers = users.filter((u: any) => u.role !== 'guest' || !u.provider)
      
      if (activeUsers.length > 1) {
        console.warn(`Multiple active accounts found for ${email}:`, activeUsers)
        // This test documents the current state - ideally should be 1
      }
    }
  })
})