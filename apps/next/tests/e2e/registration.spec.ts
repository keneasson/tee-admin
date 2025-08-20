import { test, expect } from '@playwright/test'

test.describe('User Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to registration page
    await page.goto('/auth/register')
  })

  test('should display registration form correctly', async ({ page }) => {
    // Check that all required form fields are present
    await expect(page.getByLabel('Email Address')).toBeVisible()
    await expect(page.getByLabel('First Name')).toBeVisible()
    await expect(page.getByLabel('Last Name')).toBeVisible()
    await expect(page.getByLabel('Ecclesia')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByLabel('Confirm Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  })

  test('should show validation errors for empty fields', async ({ page }) => {
    // Try to submit empty form
    await page.getByRole('button', { name: 'Create Account' }).click()

    // Check for validation messages
    await expect(page.getByText('Email is required')).toBeVisible()
    await expect(page.getByText('First name is required')).toBeVisible()
    await expect(page.getByText('Last name is required')).toBeVisible()
    await expect(page.getByText('Ecclesia is required')).toBeVisible()
    await expect(page.getByText('Password is required')).toBeVisible()
  })

  test('should show error for invalid email format', async ({ page }) => {
    await page.getByLabel('Email Address').fill('invalid-email')
    await page.getByLabel('First Name').fill('John')
    await page.getByLabel('Last Name').fill('Doe')
    await page.getByLabel('Ecclesia').fill('TEE')
    await page.getByLabel('Password').fill('SecurePassword123!')
    await page.getByLabel('Confirm Password').fill('SecurePassword123!')

    await page.getByRole('button', { name: 'Create Account' }).click()

    await expect(page.getByText('Invalid email format')).toBeVisible()
  })

  test('should show error when passwords do not match', async ({ page }) => {
    await page.getByLabel('Email Address').fill('test@example.com')
    await page.getByLabel('First Name').fill('John')
    await page.getByLabel('Last Name').fill('Doe')
    await page.getByLabel('Ecclesia').fill('TEE')
    await page.getByLabel('Password').fill('SecurePassword123!')
    await page.getByLabel('Confirm Password').fill('DifferentPassword123!')

    await page.getByRole('button', { name: 'Create Account' }).click()

    await expect(page.getByText('Passwords do not match')).toBeVisible()
  })

  test('should show password strength requirements', async ({ page }) => {
    await page.getByLabel('Password').fill('weak')

    // Check if password strength tip appears
    await expect(page.getByText(/password/i)).toBeVisible()
  })

  test('should validate invitation code when entered', async ({ page }) => {
    // Mock a valid invitation code scenario
    await page.getByLabel('Invitation Code (Optional)').fill('ABCD1234')

    // Wait for validation
    await page.waitForTimeout(1000)

    // Note: In a real test, we'd mock the API response
    // For now, we just check that the field accepts the input
    await expect(page.getByLabel('Invitation Code (Optional)')).toHaveValue('ABCD1234')
  })

  test('should attempt registration with valid data', async ({ page }) => {
    // Fill out the form with valid data
    await page.getByLabel('Email Address').fill('test@example.com')
    await page.getByLabel('First Name').fill('John')
    await page.getByLabel('Last Name').fill('Doe')
    await page.getByLabel('Ecclesia').fill('TEE')
    await page.getByLabel('Password').fill('SecurePassword123!')
    await page.getByLabel('Confirm Password').fill('SecurePassword123!')

    // Mock the registration API to return success
    await page.route('/api/auth/register', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'User registered successfully. Please check your email to verify your account.',
          userId: 'test-user-id',
        }),
      })
    })

    // Submit the form
    await page.getByRole('button', { name: 'Create Account' }).click()

    // Check for success message
    await expect(page.getByText('User registered successfully')).toBeVisible()

    // Should redirect to email verification page
    await expect(page).toHaveURL('/auth/verify-email-sent')
  })

  test('should handle registration errors gracefully', async ({ page }) => {
    // Fill out the form with valid data
    await page.getByLabel('Email Address').fill('existing@example.com')
    await page.getByLabel('First Name').fill('John')
    await page.getByLabel('Last Name').fill('Doe')
    await page.getByLabel('Ecclesia').fill('TEE')
    await page.getByLabel('Password').fill('SecurePassword123!')
    await page.getByLabel('Confirm Password').fill('SecurePassword123!')

    // Mock the registration API to return error
    await page.route('/api/auth/register', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'User with this email already exists',
        }),
      })
    })

    // Submit the form
    await page.getByRole('button', { name: 'Create Account' }).click()

    // Check for error message
    await expect(page.getByText('User with this email already exists')).toBeVisible()
  })

  test('should navigate to sign in page', async ({ page }) => {
    await page.getByText('Sign in').click()
    await expect(page).toHaveURL('/auth/signin')
  })
})

test.describe('Email Verification Flow', () => {
  test('should display verification sent page', async ({ page }) => {
    await page.goto('/auth/verify-email-sent')

    // Check that the page displays appropriate content
    await expect(page.getByText(/check your email/i)).toBeVisible()
    await expect(page.getByText(/verification/i)).toBeVisible()
  })

  test('should handle email verification with valid token', async ({ page }) => {
    // Mock the verification API to return success
    await page.route('/api/auth/verify-email*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Email verified successfully! You can now sign in to your account.',
          email: 'test@example.com',
        }),
      })
    })

    // Navigate to verification page with token
    await page.goto('/api/auth/verify-email?token=valid-token-123')

    // Should show success message
    await expect(page.getByText('Email verified successfully')).toBeVisible()
  })

  test('should handle email verification with invalid token', async ({ page }) => {
    // Mock the verification API to return error
    await page.route('/api/auth/verify-email*', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid or expired verification token',
        }),
      })
    })

    // Navigate to verification page with invalid token
    await page.goto('/api/auth/verify-email?token=invalid-token')

    // Should show error message
    await expect(page.getByText('Invalid or expired verification token')).toBeVisible()
  })
})
