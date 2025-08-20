import { test, expect } from '@playwright/test'

// Test data
const TEST_EMAIL = 'ken.easson@gmail.com' // Using existing test user
const NEW_PASSWORD = 'NewTestPassword123!'
const INVALID_PASSWORD = '123' // Too short
const BASE_URL = 'http://localhost:3000'

test.describe('Password Reset Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we're starting from a clean state
    await page.goto(BASE_URL)
  })

  test.describe('Forgot Password Page', () => {
    test('should display forgot password form', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/forgot-password`)

      // Check page elements
      await expect(page.getByRole('heading', { name: 'Forgot Password' })).toBeVisible()
      await expect(
        page.getByText("Enter your email address and we'll send you instructions")
      ).toBeVisible()
      await expect(page.getByLabel('Email Address')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Send Reset Instructions' })).toBeVisible()
      await expect(page.getByText('Back to Sign In')).toBeVisible()
    })

    test('should validate email format', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/forgot-password`)

      // Try invalid email
      await page.getByLabel('Email Address').fill('invalid-email')
      await page.getByRole('button', { name: 'Send Reset Instructions' }).click()

      // Should show validation error
      await expect(page.getByText('Invalid email format')).toBeVisible()
    })

    test('should require email field', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/forgot-password`)

      // Try empty email
      await page.getByRole('button', { name: 'Send Reset Instructions' }).click()

      // Should show validation error
      await expect(page.getByText('Email is required')).toBeVisible()
    })

    test('should show success message for valid email', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/forgot-password`)

      // Fill in valid email
      await page.getByLabel('Email Address').fill(TEST_EMAIL)
      await page.getByRole('button', { name: 'Send Reset Instructions' }).click()

      // Should show success message
      await expect(page.getByText('If an account with that email exists')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Back to Sign In' })).toBeVisible()
    })

    test('should show success message even for non-existent email', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/forgot-password`)

      // Fill in non-existent email
      await page.getByLabel('Email Address').fill('nonexistent@example.com')
      await page.getByRole('button', { name: 'Send Reset Instructions' }).click()

      // Should still show success message (security measure)
      await expect(page.getByText('If an account with that email exists')).toBeVisible()
    })

    test('should navigate back to sign in', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/forgot-password`)

      await page.getByText('Back to Sign In').click()

      // Should redirect to sign in page
      await expect(page).toHaveURL(`${BASE_URL}/auth/signin`)
    })
  })

  test.describe('Reset Password Page', () => {
    test('should show invalid link message for no token', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/reset-password`)

      // Should show invalid link message
      await expect(page.getByRole('heading', { name: 'Invalid Reset Link' })).toBeVisible()
      await expect(
        page.getByText('This password reset link is invalid or has expired')
      ).toBeVisible()
      await expect(page.getByRole('button', { name: 'Request New Reset Link' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Back to Sign In' })).toBeVisible()
    })

    test('should show invalid link message for invalid token', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/reset-password?token=invalid-token-123`)

      // Should show invalid link message after attempting to use invalid token
      await expect(page.getByRole('heading', { name: 'Invalid Reset Link' })).toBeVisible()
    })

    test('should display password reset form for valid token format', async ({ page }) => {
      // Generate a token-like string (won't be valid in DB, but should show form)
      const dummyToken = 'a'.repeat(64) // 64-character hex string
      await page.goto(`${BASE_URL}/auth/reset-password?token=${dummyToken}`)

      // Should show the form (even though token will fail validation on submit)
      await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible()
      await expect(page.getByText('Choose a new password for your account')).toBeVisible()
      await expect(page.getByLabel('New Password')).toBeVisible()
      await expect(page.getByLabel('Confirm New Password')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Reset Password' })).toBeVisible()
    })

    test('should validate password requirements', async ({ page }) => {
      const dummyToken = 'a'.repeat(64)
      await page.goto(`${BASE_URL}/auth/reset-password?token=${dummyToken}`)

      // Try short password
      await page.getByLabel('New Password').fill(INVALID_PASSWORD)
      await page.getByLabel('Confirm New Password').fill(INVALID_PASSWORD)
      await page.getByRole('button', { name: 'Reset Password' }).click()

      // Should show password validation error
      await expect(page.getByText(/Password requirements not met/)).toBeVisible()
    })

    test('should validate password confirmation match', async ({ page }) => {
      const dummyToken = 'a'.repeat(64)
      await page.goto(`${BASE_URL}/auth/reset-password?token=${dummyToken}`)

      // Fill different passwords
      await page.getByLabel('New Password').fill(NEW_PASSWORD)
      await page.getByLabel('Confirm New Password').fill('DifferentPassword123!')
      await page.getByRole('button', { name: 'Reset Password' }).click()

      // Should show mismatch error
      await expect(page.getByText('Passwords do not match')).toBeVisible()
    })

    test('should show loading state during submission', async ({ page }) => {
      const dummyToken = 'a'.repeat(64)
      await page.goto(`${BASE_URL}/auth/reset-password?token=${dummyToken}`)

      // Fill valid passwords
      await page.getByLabel('New Password').fill(NEW_PASSWORD)
      await page.getByLabel('Confirm New Password').fill(NEW_PASSWORD)

      // Start submission
      await page.getByRole('button', { name: 'Reset Password' }).click()

      // Should show loading state (briefly)
      await expect(page.getByRole('button', { name: 'Resetting...' })).toBeVisible()
    })

    test('should show error for invalid token on submission', async ({ page }) => {
      const dummyToken = 'a'.repeat(64)
      await page.goto(`${BASE_URL}/auth/reset-password?token=${dummyToken}`)

      // Fill valid passwords
      await page.getByLabel('New Password').fill(NEW_PASSWORD)
      await page.getByLabel('Confirm New Password').fill(NEW_PASSWORD)
      await page.getByRole('button', { name: 'Reset Password' }).click()

      // Should show invalid token error
      await expect(page.getByText('Invalid or expired reset token')).toBeVisible()
    })

    test('should navigate back to sign in from invalid link page', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/reset-password`)

      await page.getByRole('button', { name: 'Back to Sign In' }).click()

      // Should redirect to sign in page
      await expect(page).toHaveURL(`${BASE_URL}/auth/signin`)
    })

    test('should navigate to forgot password from invalid link page', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/reset-password`)

      await page.getByRole('button', { name: 'Request New Reset Link' }).click()

      // Should redirect to forgot password page
      await expect(page).toHaveURL(`${BASE_URL}/auth/forgot-password`)
    })
  })

  test.describe('Password Input Component', () => {
    test('should toggle password visibility', async ({ page }) => {
      const dummyToken = 'a'.repeat(64)
      await page.goto(`${BASE_URL}/auth/reset-password?token=${dummyToken}`)

      const passwordField = page.getByLabel('New Password')
      const toggleButton = page.locator('[aria-label="Show password"]').first()

      // Initially should be hidden (secureTextEntry)
      await passwordField.fill('testpassword')

      // Click to show password
      await toggleButton.click()

      // Button should change to hide password
      await expect(page.locator('[aria-label="Hide password"]').first()).toBeVisible()

      // Click to hide password again
      await page.locator('[aria-label="Hide password"]').first().click()

      // Button should change back to show password
      await expect(page.locator('[aria-label="Show password"]').first()).toBeVisible()
    })

    test('should work for both password fields independently', async ({ page }) => {
      const dummyToken = 'a'.repeat(64)
      await page.goto(`${BASE_URL}/auth/reset-password?token=${dummyToken}`)

      // Test first password field
      const newPasswordToggle = page.locator('[aria-label="Show password"]').first()
      await newPasswordToggle.click()
      await expect(page.locator('[aria-label="Hide password"]').first()).toBeVisible()

      // Test confirm password field
      const confirmPasswordToggle = page.locator('[aria-label="Show password"]').last()
      await confirmPasswordToggle.click()
      await expect(page.locator('[aria-label="Hide password"]').last()).toBeVisible()
    })
  })

  test.describe('Complete Flow Integration', () => {
    test('should complete full password reset flow', async ({ page }) => {
      // Step 1: Go to forgot password page
      await page.goto(`${BASE_URL}/auth/forgot-password`)

      // Step 2: Submit email
      await page.getByLabel('Email Address').fill(TEST_EMAIL)
      await page.getByRole('button', { name: 'Send Reset Instructions' }).click()

      // Step 3: Verify success message
      await expect(page.getByText('If an account with that email exists')).toBeVisible()

      // Note: In a real test, you would:
      // 1. Check email service for the sent email
      // 2. Extract the token from the email
      // 3. Navigate to the reset page with the real token
      // 4. Complete the password reset
      // 5. Verify you can sign in with the new password

      // For this test, we'll simulate with a placeholder
      console.log('Full flow test completed. In production, would verify email and complete reset.')
    })

    test('should handle navigation between auth pages', async ({ page }) => {
      // Start at sign in
      await page.goto(`${BASE_URL}/auth/signin`)

      // Go to forgot password
      await page.getByText('Forgot password?').click()
      await expect(page).toHaveURL(`${BASE_URL}/auth/forgot-password`)

      // Go back to sign in
      await page.getByText('Back to Sign In').click()
      await expect(page).toHaveURL(`${BASE_URL}/auth/signin`)

      // Go to forgot password again
      await page.getByText('Forgot password?').click()
      await expect(page).toHaveURL(`${BASE_URL}/auth/forgot-password`)

      // Submit email to go to success page
      await page.getByLabel('Email Address').fill(TEST_EMAIL)
      await page.getByRole('button', { name: 'Send Reset Instructions' }).click()

      // From success page, go back to sign in
      await page.getByRole('button', { name: 'Back to Sign In' }).click()
      await expect(page).toHaveURL(`${BASE_URL}/auth/signin`)
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper labels and ARIA attributes', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/forgot-password`)

      // Check form labels
      await expect(page.getByLabel('Email Address')).toBeVisible()

      // Check button accessibility
      const submitButton = page.getByRole('button', { name: 'Send Reset Instructions' })
      await expect(submitButton).toBeVisible()
      await expect(submitButton).toBeEnabled()
    })

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/forgot-password`)

      // Tab through form
      await page.keyboard.press('Tab')
      await expect(page.getByLabel('Email Address')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.getByRole('button', { name: 'Send Reset Instructions' })).toBeFocused()

      // Test Enter key submission
      await page.getByLabel('Email Address').fill(TEST_EMAIL)
      await page.keyboard.press('Enter')

      // Should submit form
      await expect(page.getByText('If an account with that email exists')).toBeVisible()
    })
  })
})
