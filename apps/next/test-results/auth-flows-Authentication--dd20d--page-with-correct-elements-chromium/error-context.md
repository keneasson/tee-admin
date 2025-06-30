# Page snapshot

```yaml
- button:
  - img
- heading "Welcome Back"
- paragraph: Sign in to your TEE Admin account
- group:
  - text: Email Address
  - textbox "Email Address"
- group:
  - text: Password
  - textbox "Password"
  - button "Show password":
    - img
- link "Forgot password?":
  - /url: /auth/forgot-password
- button "Sign In"
- text: or
- button "Continue with Google"
- text: Don't have an account?
- link "Create account":
  - /url: /auth/register
- link "Resend email verification":
  - /url: /auth/resend-verification
- region "Notifications (F8)"
- alert
- button "Open Next.js Dev Tools":
  - img
```