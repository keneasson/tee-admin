#!/bin/bash
# Pre-deployment checks — runs before vercel deploy --prod
# Ensures code quality gates pass and flags any external changes needed

set -e

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BOLD=$'\033[1m'
NC=$'\033[0m' # No Color

printf "\n"
printf "%s========================================%s\n" "$BOLD" "$NC"
printf "%s  TEE Admin Pre-Deploy Checks%s\n" "$BOLD" "$NC"
printf "%s========================================%s\n" "$BOLD" "$NC"
printf "\n"

FAILED=0

# Step 1: Check for pending external changes
printf "%s[1/4] Checking EXTERNAL_CHANGES.md...%s\n" "$BOLD" "$NC"
if [ -f "EXTERNAL_CHANGES.md" ]; then
  # Look for entries under ## Pending that aren't just _(none)_
  PENDING=$(sed -n '/^## Pending/,/^## /p' EXTERNAL_CHANGES.md | grep -v "^## " | grep -v "^$" | grep -v "_(none)_" || true)
  if [ -n "$PENDING" ]; then
    printf "%s  PENDING EXTERNAL CHANGES FOUND:%s\n" "$RED" "$NC"
    echo "$PENDING" | while IFS= read -r line; do
      printf "%s    %s%s\n" "$YELLOW" "$line" "$NC"
    done
    printf "\n"
    printf "%s  Complete these manual steps before deploying!%s\n" "$RED" "$NC"
    printf "%s  Then move them to 'Completed' in EXTERNAL_CHANGES.md%s\n" "$RED" "$NC"
    FAILED=1
  else
    printf "%s  No pending external changes.%s\n" "$GREEN" "$NC"
  fi
else
  printf "%s  EXTERNAL_CHANGES.md not found — skipping.%s\n" "$YELLOW" "$NC"
fi

# Step 2: TypeScript typecheck
printf "\n"
printf "%s[2/4] Running TypeScript typecheck...%s\n" "$BOLD" "$NC"
if yarn workspace next-app typecheck 2>&1; then
  printf "%s  Typecheck passed.%s\n" "$GREEN" "$NC"
else
  printf "%s  Typecheck failed!%s\n" "$RED" "$NC"
  FAILED=1
fi

# Step 3: Production build
printf "\n"
printf "%s[3/4] Running production build...%s\n" "$BOLD" "$NC"
if yarn web:prod 2>&1; then
  printf "%s  Build succeeded.%s\n" "$GREEN" "$NC"
else
  printf "%s  Build failed!%s\n" "$RED" "$NC"
  FAILED=1
fi

# Step 4: Check for uncommitted changes
printf "\n"
printf "%s[4/4] Checking git status...%s\n" "$BOLD" "$NC"
UNCOMMITTED=$(git status --porcelain 2>/dev/null | head -20)
if [ -n "$UNCOMMITTED" ]; then
  printf "%s  Warning: uncommitted changes detected:%s\n" "$YELLOW" "$NC"
  echo "$UNCOMMITTED" | while IFS= read -r line; do
    printf "%s    %s%s\n" "$YELLOW" "$line" "$NC"
  done
  printf "\n"
  printf "%s  Uncommitted changes — do you want to commit before deploying? (y/n) %s" "$YELLOW" "$NC"
  read -r ANSWER
  if [ "$ANSWER" = "y" ] || [ "$ANSWER" = "Y" ]; then
    git add -A
    printf "  Enter commit message: "
    read -r COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
      COMMIT_MSG="Pre-deploy commit"
    fi
    git commit -m "$COMMIT_MSG"
    printf "%s  Changes committed.%s\n" "$GREEN" "$NC"
  else
    printf "%s  Continuing without committing. Vercel will deploy your working directory as-is.%s\n" "$YELLOW" "$NC"
  fi
else
  printf "%s  Working directory clean.%s\n" "$GREEN" "$NC"
fi

# Final result
printf "\n"
printf "%s========================================%s\n" "$BOLD" "$NC"
if [ $FAILED -ne 0 ]; then
  printf "%s%s  DEPLOY BLOCKED — fix issues above%s\n" "$RED" "$BOLD" "$NC"
  printf "%s========================================%s\n" "$BOLD" "$NC"
  exit 1
else
  printf "%s%s  All checks passed — ready to deploy%s\n" "$GREEN" "$BOLD" "$NC"
  printf "%s========================================%s\n" "$BOLD" "$NC"
  exit 0
fi
