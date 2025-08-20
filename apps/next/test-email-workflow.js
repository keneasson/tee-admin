const { DynamoDBDocument } = require('@aws-sdk/lib-dynamodb')
const { DynamoDB } = require('@aws-sdk/client-dynamodb')
const bcrypt = require('bcryptjs')

// Use the same config as the app
const CREDENTIAL = {
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: 'ca-central-1',
}

const client = DynamoDBDocument.from(new DynamoDB(CREDENTIAL), {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
})

const TABLE_NAME = 'tee-admin'

async function testEmailWorkflow() {
  const testEmail = 'test-workflow@example.com'
  const testPassword = 'SecureTestPassword123!'

  console.log('🧪 Testing complete email verification workflow')
  console.log('📧 Test email:', testEmail)
  console.log('🔐 Test password:', testPassword)

  try {
    // Step 1: Clean up any existing test user
    console.log('\n🧹 Step 1: Cleaning up existing test data...')
    await cleanupTestUser(testEmail)

    // Step 2: Simulate user registration
    console.log('\n👤 Step 2: Creating test user (simulating registration)...')
    const userId = await createTestUser(testEmail, testPassword)
    console.log('✅ User created with ID:', userId)

    // Step 3: Create email verification token
    console.log('\n🎫 Step 3: Creating email verification token...')
    const token = await createVerificationToken(testEmail)
    console.log('✅ Verification token created:', token)

    // Step 4: Analyze the verification link
    console.log('\n🔗 Step 4: Analyzing verification link...')
    const verificationUrl = `http://localhost:3000/api/auth/verify-email?token=${token}`
    console.log('📎 Verification URL:', verificationUrl)
    console.log('🔍 Token length:', token.length)
    console.log('🔍 Token format valid:', /^[a-f0-9]{64}$/.test(token))

    // Step 5: Check token in database
    console.log('\n📊 Step 5: Verifying token in database...')
    const tokenData = await getTokenFromDatabase(token)
    if (tokenData) {
      console.log('✅ Token found in database')
      console.log('   Email:', tokenData.email)
      console.log('   Type:', tokenData.tokenType)
      console.log('   Created:', tokenData.createdAt)
      console.log('   Expires:', tokenData.expiresAt)
      console.log('   Is Expired:', new Date() > new Date(tokenData.expiresAt))
    } else {
      console.log('❌ Token NOT found in database')
    }

    // Step 6: Test verification API call
    console.log('\n🔌 Step 6: Testing verification API call...')
    const verificationResult = await testVerificationAPI(token)
    console.log('API Result:', verificationResult)

    // Step 7: Check user email verification status
    console.log('\n📧 Step 7: Checking user email verification status...')
    const userAfterVerification = await getUserByEmail(testEmail)
    if (userAfterVerification) {
      console.log('✅ User found after verification')
      console.log('   Email Verified:', userAfterVerification.emailVerified)
      console.log('   Email Verified Type:', typeof userAfterVerification.emailVerified)
      console.log('   Is Verified:', !!userAfterVerification.emailVerified)
    }

    // Step 8: Test login after verification
    console.log('\n🔐 Step 8: Testing login after verification...')
    const loginResult = await testLogin(testEmail, testPassword)
    console.log('Login Result:', loginResult)

    // Step 9: Check token cleanup
    console.log('\n🧹 Step 9: Checking token cleanup...')
    const tokenAfterVerification = await getTokenFromDatabase(token)
    if (tokenAfterVerification) {
      console.log('⚠️  Token still exists in database (should be deleted)')
    } else {
      console.log('✅ Token properly deleted from database')
    }
  } catch (error) {
    console.error('💥 Error in workflow test:', error)
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...')
    await cleanupTestUser(testEmail)
    console.log('✅ Cleanup completed')
  }
}

async function cleanupTestUser(email) {
  try {
    // Find user
    const user = await getUserByEmail(email)
    if (user) {
      await client.delete({
        TableName: TABLE_NAME,
        Key: {
          pkey: `USER#${user.id}`,
          skey: `USER#${user.id}`,
        },
      })
      console.log('🗑️  Deleted test user:', user.id)
    }

    // Clean up any verification tokens
    // Note: In production, you'd want to scan for tokens, but for testing we'll skip this
  } catch (error) {
    console.log('ℹ️  No existing test user to clean up')
  }
}

async function createTestUser(email, password) {
  const { randomUUID } = require('crypto')
  const userId = randomUUID()
  const hashedPassword = await bcrypt.hash(password, 12)
  const now = new Date()

  await client.put({
    TableName: TABLE_NAME,
    Item: {
      pkey: `USER#${userId}`,
      skey: `USER#${userId}`,
      gsi1pk: `USER#${email}`,
      gsi1sk: `USER#${email}`,
      type: 'USER',
      id: userId,
      email: email,
      hashedPassword,
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      ecclesia: 'TEST',
      role: 'guest',
      provider: 'credentials',
      createdAt: now,
      // Note: emailVerified is intentionally NOT set
    },
  })

  return userId
}

async function createVerificationToken(email) {
  const { randomBytes } = require('crypto')
  const token = randomBytes(32).toString('hex')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await client.put({
    TableName: TABLE_NAME,
    Item: {
      pkey: `VERIFY_TOKEN#${token}`,
      skey: `VERIFY_TOKEN#${token}`,
      type: 'VERIFICATION_TOKEN',
      token,
      email,
      tokenType: 'email_verification',
      createdAt: now,
      expiresAt,
    },
  })

  return token
}

async function getTokenFromDatabase(token) {
  try {
    const result = await client.get({
      TableName: TABLE_NAME,
      Key: {
        pkey: `VERIFY_TOKEN#${token}`,
        skey: `VERIFY_TOKEN#${token}`,
      },
    })
    return result.Item
  } catch (error) {
    console.error('Error getting token:', error)
    return null
  }
}

async function getUserByEmail(email) {
  try {
    const result = await client.query({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
      },
    })

    return result.Items?.find((item) => item.provider === 'credentials')
  } catch (error) {
    console.error('Error getting user:', error)
    return null
  }
}

async function testVerificationAPI(token) {
  // Import the verification function directly
  try {
    const { verifyEmailToken } = require('./utils/dynamodb/credentials-users')
    const result = await verifyEmailToken(token)
    return { success: true, result }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function testLogin(email, password) {
  try {
    const { verifyCredentialsUser } = require('./utils/dynamodb/credentials-users')
    const result = await verifyCredentialsUser(email, password)
    return { success: !!result, user: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Run the test
testEmailWorkflow()
  .then(() => {
    console.log('\n🏁 Email verification workflow test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Workflow test failed:', error)
    process.exit(1)
  })
