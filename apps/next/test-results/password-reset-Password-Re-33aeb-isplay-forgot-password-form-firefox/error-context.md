# Page snapshot

```yaml
- button:
  - img
- heading "Reset Password"
- paragraph: Enter your email address and we'll send you a link to reset your password.
- group:
  - text: Email Address
  - textbox "Email Address"
- button "Send Reset Link"
- link "Back to Sign In":
  - /url: /auth/signin
- region "Notifications (F8)"
- alert
- button "Open Next.js Dev Tools":
  - img
- button "Open issues overlay": 2 Issue
- button "Collapse issues badge":
  - img
```