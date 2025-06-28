const { DynamoDBDocument } = require('@aws-sdk/lib-dynamodb')
const { DynamoDB } = require('@aws-sdk/client-dynamodb')

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

async function testRealVerification() {
  console.log('🧪 Testing REAL email verification workflow with HTTP requests')
  console.log('🌐 Server should be running at http://localhost:3000')
  
  const testEmail = 'test-real@example.com'
  const timestamp = Date.now()
  const uniqueEmail = `test-${timestamp}@example.com`
  
  try {
    // Step 1: Register a new user via API
    console.log('\n👤 Step 1: Registering new user via API...')
    console.log('📧 Using email:', uniqueEmail)
    
    const registrationResponse = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        ecclesia: 'TEST',
      }),
    })
    
    const registrationData = await registrationResponse.json()
    console.log('📊 Registration response status:', registrationResponse.status)
    console.log('📊 Registration response:', registrationData)
    
    if (!registrationResponse.ok) {
      console.log('❌ Registration failed, stopping test')
      return
    }
    
    console.log('✅ User registered successfully!')
    
    // Step 2: Check what verification token was created
    console.log('\n🎫 Step 2: Finding verification token in database...')
    const verificationTokens = await findVerificationTokens(uniqueEmail)
    console.log('📊 Found', verificationTokens.length, 'verification token(s)')
    
    if (verificationTokens.length === 0) {
      console.log('❌ No verification token found! This is the problem.')
      return
    }
    
    const token = verificationTokens[0].token
    console.log('✅ Found verification token:', token)
    console.log('🔍 Token details:')
    console.log('   Email:', verificationTokens[0].email)
    console.log('   Type:', verificationTokens[0].tokenType)
    console.log('   Created:', verificationTokens[0].createdAt)
    console.log('   Expires:', verificationTokens[0].expiresAt)
    
    // Step 3: Test the verification link
    console.log('\n🔗 Step 3: Testing verification link...')
    const verificationUrl = `http://localhost:3000/api/auth/verify-email?token=${token}`
    console.log('📎 Verification URL:', verificationUrl)
    
    const verificationResponse = await fetch(verificationUrl, {
      method: 'GET',
    })
    
    const verificationData = await verificationResponse.json()
    console.log('📊 Verification response status:', verificationResponse.status)
    console.log('📊 Verification response:', verificationData)
    
    if (verificationResponse.ok) {
      console.log('✅ Email verification successful!')
    } else {
      console.log('❌ Email verification failed!')
      console.log('🔍 This might be the issue with the activation link')
    }
    
    // Step 4: Check user email verification status
    console.log('\n📧 Step 4: Checking user verification status after API call...')
    const userAfterVerification = await getUserByEmail(uniqueEmail)
    if (userAfterVerification) {
      console.log('✅ User found after verification attempt')
      console.log('   Email Verified:', userAfterVerification.emailVerified)
      console.log('   Email Verified Type:', typeof userAfterVerification.emailVerified)
      console.log('   Is Actually Verified:', !!userAfterVerification.emailVerified)
      
      if (userAfterVerification.emailVerified) {
        console.log('✅ Email verification field was properly set!')
      } else {
        console.log('❌ Email verification field was NOT set - this is the problem!')
      }
    }
    
    // Step 5: Test login
    console.log('\n🔐 Step 5: Testing login via API...')
    const loginResponse = await fetch('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: uniqueEmail,
        password: 'TestPassword123!',
        csrfToken: 'test', // In real app this would be obtained from /api/auth/csrf
      }),
    })
    
    console.log('📊 Login response status:', loginResponse.status)
    const loginText = await loginResponse.text()
    console.log('📊 Login response:', loginText.substring(0, 200) + '...')
    
    // Step 6: Check token cleanup
    console.log('\n🧹 Step 6: Checking if verification token was cleaned up...')
    const tokensAfter = await findVerificationTokens(uniqueEmail)
    console.log('📊 Verification tokens remaining:', tokensAfter.length)
    
    if (tokensAfter.length === 0) {
      console.log('✅ Verification token properly cleaned up')
    } else {
      console.log('⚠️  Verification token still exists (might be normal depending on verification result)')
    }
    
    // Step 7: Generate a test verification link to see the exact format
    console.log('\n📧 Step 7: Email verification link analysis...')
    console.log('🔗 Expected verification link format:')
    console.log('   Base URL: http://localhost:3000/api/auth/verify-email')
    console.log('   Parameter: ?token=' + token)
    console.log('   Full URL: ' + verificationUrl)
    console.log('   URL Length:', verificationUrl.length)
    console.log('   Token Length:', token.length)
    console.log('   Token Format Valid:', /^[a-f0-9]{64}$/.test(token))
    
  } catch (error) {
    console.error('💥 Error in real verification test:', error)
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...')
    await cleanupTestUser(uniqueEmail)
    console.log('✅ Cleanup completed')
  }
}

async function findVerificationTokens(email) {
  try {
    const result = await client.scan({
      TableName: TABLE_NAME,
      FilterExpression: '#type = :type AND email = :email',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: {
        ':type': 'VERIFICATION_TOKEN',
        ':email': email
      }
    })
    return result.Items || []
  } catch (error) {
    console.error('Error finding verification tokens:', error)
    return []
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
    
    return result.Items?.find(item => item.provider === 'credentials')
  } catch (error) {
    console.error('Error getting user:', error)
    return null
  }
}

async function cleanupTestUser(email) {
  try {
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
    
    // Clean up verification tokens
    const tokens = await findVerificationTokens(email)
    for (const token of tokens) {
      await client.delete({
        TableName: TABLE_NAME,
        Key: {
          pkey: `VERIFY_TOKEN#${token.token}`,
          skey: `VERIFY_TOKEN#${token.token}`,
        },
      })
      console.log('🗑️  Deleted verification token:', token.token)
    }
  } catch (error) {
    console.log('ℹ️  Cleanup completed (some items may not have existed)')
  }
}

// Run the test
testRealVerification().then(() => {
  console.log('\n🏁 Real email verification test completed')
  process.exit(0)
}).catch(error => {
  console.error('💥 Real verification test failed:', error)
  process.exit(1)
})