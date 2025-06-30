# Page snapshot

```yaml
- button:
  - img
- text: ✗
- heading "Invalid Reset Link"
- paragraph: This password reset link is invalid or has expired.
- link "Request New Reset Link":
  - /url: /auth/forgot-password
  - button "Request New Reset Link"
- link "Back to Sign In":
  - /url: /auth/signin
  - button "Back to Sign In"
- region "Notifications (F8)"
- alert
- button "Open Next.js Dev Tools":
  - img
- button "Open issues overlay": 1 Issue
- button "Collapse issues badge":
  - img
```