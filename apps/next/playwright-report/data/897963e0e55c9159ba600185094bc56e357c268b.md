# Page snapshot

```yaml
- button:
  - img
- text: 📧
- heading "Check Your Email"
- paragraph: We've sent a verification email to your inbox. Please click the link in the email to verify your account and complete your registration.
- paragraph: "Didn't receive the email? Check your spam folder or:"
- link "Resend Verification Email":
  - /url: /auth/resend-verification
  - button "Resend Verification Email"
- link "Back to Sign In":
  - /url: /auth/signin
  - button "Back to Sign In"
- text: The verification link will expire in 7 days.
- region "Notifications (F8)"
- alert
- button "Open Next.js Dev Tools":
  - img
- button "Open issues overlay": 1 Issue
- button "Collapse issues badge":
  - img
```