# Page snapshot

```yaml
- button:
  - img
- heading "Reset Password"
- paragraph: Choose a new password for your account.
- group:
  - text: New Password
  - textbox "New Password"
  - button "Show password":
    - img
- group:
  - text: Confirm New Password
  - textbox "Confirm New Password"
  - button "Show password":
    - img
- button "Reset Password"
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