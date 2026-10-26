#!/bin/bash

echo "🧪 Running tests from project root..."
cd apps/next

echo "1️⃣ Running unit tests..."
npm test -- --run tests/auth/role-assignment-simple.test.ts

echo ""
echo "2️⃣ Starting dev server in background..."
npm run dev > dev.log 2>&1 &
DEV_PID=$!
echo "Dev server started with PID: $DEV_PID"

echo ""
echo "3️⃣ Waiting for server to be ready..."
sleep 10

echo ""
# Use environment variable for target email, default to owner@example.org
TARGET_EMAIL=${TARGET_EMAIL:-"owner@example.org"}

echo "4️⃣ Testing role assignment API..."
curl -s "http://localhost:3001/api/debug/check-role?email=${TARGET_EMAIL}" | jq '.'

echo ""
echo "5️⃣ Fixing DynamoDB role..."
curl -s -X POST "http://localhost:3001/api/debug/fix-role" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${TARGET_EMAIL}\", \"newRole\": \"owner\"}" | jq '.'

echo ""
echo "6️⃣ Verifying fix..."
curl -s "http://localhost:3001/api/debug/check-db" | jq ".users[] | select(.email == \"${TARGET_EMAIL}\")"

echo ""
echo "7️⃣ Stopping dev server..."
kill $DEV_PID 2>/dev/null

echo ""
echo "✅ Test and fix complete!"