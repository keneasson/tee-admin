# Testing Guide for Password Reset Flow

This directory contains comprehensive tests for the password reset functionality in the TEE Admin application.

## Test Structure

### Unit/Integration Tests (Vitest)

**`password-reset.test.ts`** - Core password reset functionality

- Tests `createPasswordResetToken()` function
- Tests `validatePasswordResetToken()` function
- Tests `resetPassword()` function
- Tests integration with user lookup functions
- Tests error handling and edge cases

**`api/password-reset.test.ts`** - API route testing

- Tests `/api/auth/forgot-password` endpoint
- Tests `/api/auth/reset-password` endpoint
- Tests request validation and error responses
- Tests integration between API routes and database functions

### End-to-End Tests (Playwright)

**`e2e/password-reset.spec.ts`** - Complete user flow testing

- Tests forgot password page UI and functionality
- Tests reset password page UI and functionality
- Tests password input component with show/hide functionality
- Tests form validation and error states
- Tests navigation between auth pages
- Tests accessibility features
- Tests keyboard navigation

## Running Tests

### Vitest Tests

```bash
# Run all vitest tests
yarn test

# Run only password reset tests
yarn test password-reset

# Run with UI
yarn test:ui
```

### Playwright Tests

```bash
# Install browsers (first time only)
yarn playwright install

# Run all e2e tests
yarn test:e2e

# Run only password reset e2e tests
yarn test:e2e tests/e2e/password-reset.spec.ts

# Run with UI
yarn test:e2e:ui
```

## Test Coverage

### Functionality Covered

✅ **Password Reset Token Creation**

- Valid token generation
- Correct expiration time (7 days)
- Database storage verification

✅ **Token Validation**

- Valid token acceptance
- Expired token rejection
- Wrong token type rejection
- Non-existent token handling

✅ **Password Reset Process**

- Successful password reset
- User lookup and validation
- Password hashing
- Token cleanup after use

✅ **API Endpoints**

- Input validation
- Error handling
- Security measures (email enumeration protection)
- Response formats

✅ **User Interface**

- Form rendering and validation
- Error message display
- Loading states
- Navigation flows
- Password visibility toggle

✅ **Security Features**

- Token expiration enforcement
- Password strength validation
- Secure token generation
- Email enumeration protection

### Edge Cases Covered

- Router timing issues (Next.js query parameters)
- Database connection errors
- Email service failures
- Invalid token formats
- Expired tokens
- Password validation failures
- User not found scenarios

## Test Data

The tests use the following test data:

- **Test Email**: `ken.easson@gmail.com` (existing user)
- **Test Passwords**: Various valid/invalid password combinations
- **Mock Tokens**: 64-character hex strings for testing

## Mocking Strategy

### Vitest Tests

- Mock DynamoDB client operations
- Mock email sending service
- Mock password validation functions
- Mock AWS configuration

### Playwright Tests

- Use real application instance
- Test against actual UI components
- Verify end-to-end user workflows

## Known Issues

1. **Vitest Configuration**: Currently has ES module compatibility issues
2. **Playwright Browsers**: Requires `yarn playwright install` before first run
3. **Email Service**: Real email sending not tested in e2e (would need email service mocking)

## Future Improvements

1. **Email Testing**: Add email service integration tests
2. **Visual Regression**: Add screenshot testing for UI components
3. **Performance**: Add performance testing for password reset flow
4. **Security**: Add penetration testing scenarios
5. **Mobile**: Add mobile-specific e2e tests
