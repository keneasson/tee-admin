import { test, expect } from '@playwright/test'

test.describe('Authentication Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the signin page before each test
    await page.goto('/auth/signin')
  })

  test('should show sign in page with correct elements', async ({ page }) => {
    await expect(page).toHaveTitle(/Sign In/)
    
    // Check for sign in form elements
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    
    // Check for Google OAuth button
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
  })

  test('should prevent duplicate account creation', async ({ page }) => {
    // Go to register page
    await page.goto('/auth/register')
    
    // Try to register with Ken's email (which already exists as Google OAuth)
    await page.fill('input[name="email"]', 'ken.easson@gmail.com')
    await page.fill('input[name="password"]', 'testpassword123')
    await page.fill('input[name="firstName"]', 'Ken')
    await page.fill('input[name="lastName"]', 'Easson')
    await page.selectOption('select[name="ecclesia"]', 'TEE')
    
    await page.click('button[type="submit"]')
    
    // Should show error message about existing account
    await expect(page.getByText(/user with this email already exists/i)).toBeVisible()
    await expect(page.getByText(/please sign in with your existing account/i)).toBeVisible()
  })

  test('should validate email format', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Enter invalid email
    await page.fill('input[name="email"]', 'invalid-email')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // Should show validation error
    await expect(page.getByText(/invalid email/i)).toBeVisible()
  })

  test('should validate password requirements', async ({ page }) => {
    await page.goto('/auth/register')
    
    // Enter short password
    await page.fill('input[name="email"]', 'new.user@example.com')
    await page.fill('input[name="password"]', '123') // Too short
    await page.fill('input[name="firstName"]', 'New')
    await page.fill('input[name="lastName"]', 'User')
    
    await page.click('button[type="submit"]')
    
    // Should show password validation error
    await expect(page.getByText(/password must be at least/i)).toBeVisible()
  })

  test('should handle invalid credentials gracefully', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Enter non-existent credentials
    await page.fill('input[name="email"]', 'nonexistent@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    
    // Should show error message
    await expect(page.getByText(/invalid credentials/i)).toBeVisible()
  })

  test('should require email verification for new accounts', async ({ page }) => {
    await page.goto('/auth/register')
    
    const testEmail = `test.${Date.now()}@example.com`
    
    // Register with unique email
    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', 'testpassword123')
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.selectOption('select[name="ecclesia"]', 'TEE')
    
    await page.click('button[type="submit"]')
    
    // Should redirect to verification page or show verification message
    await expect(page.getByText(/check your email/i)).toBeVisible()
    await expect(page.getByText(/verification link/i)).toBeVisible()
  })

  test('should redirect to intended page after login', async ({ page }) => {
    // Try to access protected page
    await page.goto('/schedule')
    
    // Should redirect to signin
    await expect(page.url()).toContain('/auth/signin')
    
    // After successful login, should redirect back to /schedule
    // Note: This would require setting up a test user with valid credentials
  })

  test('should handle invitation codes properly', async ({ page }) => {
    await page.goto('/auth/register')
    
    // Check if invitation code field exists
    const inviteCodeField = page.locator('input[name="invitationCode"]')
    if (await inviteCodeField.isVisible()) {
      // Enter invalid invitation code
      await inviteCodeField.fill('INVALID123')
      await page.fill('input[name="email"]', 'invited.user@example.com')
      await page.fill('input[name="password"]', 'testpassword123')
      await page.fill('input[name="firstName"]', 'Invited')
      await page.fill('input[name="lastName"]', 'User')
      
      await page.click('button[type="submit"]')
      
      // Should show invalid invitation code error
      await expect(page.getByText(/invalid.*invitation.*code/i)).toBeVisible()
    }
  })

  test('should display role-based navigation', async ({ page }) => {
    // This test would require authentication
    // For now, just check that navigation elements exist
    await page.goto('/')
    
    // Should have navigation elements
    await expect(page.getByRole('navigation')).toBeVisible()
  })
})

test.describe('Role Assignment Integration', () => {
  test('should assign correct roles from legacy directory', async ({ page }) => {
    // Test the debug API endpoint for role assignment
    const response = await page.request.get('/api/debug/check-role?email=ken.easson@gmail.com')
    const data = await response.json()
    
    expect(data.success).toBe(true)
    expect(data.found).toBe(true)
    expect(data.assignedRole).toBe('owner')
  })

  test('should handle non-existent users gracefully', async ({ page }) => {
    const response = await page.request.get('/api/debug/check-role?email=nonexistent@example.com')
    const data = await response.json()
    
    expect(data.success).toBe(false)
    expect(data.found).toBe(false)
    expect(data.role).toBe('guest')
  })
})

test.describe('DynamoDB Integration', () => {
  test('should prevent duplicate user creation', async ({ page }) => {
    // Test account linking prevention via API
    const registrationData = {
      email: 'ken.easson@gmail.com',
      password: 'testpassword123',
      firstName: 'Ken',
      lastName: 'Easson',
      ecclesia: 'TEE'
    }
    
    const response = await page.request.post('/api/auth/register', {
      data: registrationData
    })
    
    // Should return error for existing user
    expect(response.status()).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('already exists')
  })
})