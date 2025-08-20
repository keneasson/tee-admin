const { DynamoDBDocument } = require('@aws-sdk/lib-dynamodb')
const { DynamoDB } = require('@aws-sdk/client-dynamodb')
const bcrypt = require('bcryptjs')

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

async function debugLiveAuth() {
  const email = 'ken.easson@gmail.com'
  const password = 'jBYiW9Fda3eJJ5v'

  console.log('🔍 DEBUGGING LIVE AUTHENTICATION STEP BY STEP')
  console.log('📧 Email:', email)
  console.log('🔐 Password:', password)
  console.log('🕐 Timestamp:', new Date().toISOString())

  try {
    // Step 1: Reproduce the exact query from findCredentialsUserByEmail
    console.log('\n📋 Step 1: Finding user by email (exact same query as app)...')
    const result = await client.query({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
      },
    })

    console.log('📊 Query returned', result.Items?.length || 0, 'items')

    if (!result.Items || result.Items.length === 0) {
      console.log('❌ No user found with email:', email)
      return
    }

    // Step 2: Filter for credentials provider (exact same logic)
    console.log('\n🔍 Step 2: Filtering for credentials provider...')
    const credentialsUsers = result.Items.filter((item) => item.provider === 'credentials')
    console.log('📊 Credentials users found:', credentialsUsers.length)

    if (credentialsUsers.length === 0) {
      console.log('❌ No credentials user found')
      console.log('Available users:')
      result.Items.forEach((user, i) => {
        console.log(`  ${i + 1}. Provider: ${user.provider}, ID: ${user.id}`)
      })
      return
    }

    const user = credentialsUsers[0]
    console.log('✅ Found credentials user:', user.id)

    // Step 3: Detailed user inspection
    console.log('\n👤 Step 3: Detailed user inspection...')
    console.log('   ID:', user.id)
    console.log('   Email:', user.email)
    console.log('   Provider:', user.provider)
    console.log('   Role:', user.role)
    console.log('   Name:', user.name)
    console.log('   Has hashedPassword:', !!user.hashedPassword)
    console.log('   hashedPassword length:', user.hashedPassword?.length)
    console.log('   emailVerified:', user.emailVerified)
    console.log('   emailVerified type:', typeof user.emailVerified)

    // Step 4: Password verification (exact same logic)
    console.log('\n🔐 Step 4: Password verification...')
    if (!user.hashedPassword) {
      console.log('❌ No hashed password found')
      return
    }

    console.log('🔧 Comparing password with hash...')
    console.log('   Password to check:', password)
    console.log('   Hash starts with:', user.hashedPassword.substring(0, 20) + '...')

    const isValid = await bcrypt.compare(password, user.hashedPassword)
    console.log('🔑 Password comparison result:', isValid)

    if (!isValid) {
      console.log('❌ Password is invalid!')

      // Let's test with some common variations
      console.log('\n🔍 Testing password variations...')
      const variations = [password, password.trim(), password.toLowerCase(), password.toUpperCase()]

      for (const variant of variations) {
        if (variant !== password) {
          const testResult = await bcrypt.compare(variant, user.hashedPassword)
          console.log(`   "${variant}":`, testResult)
        }
      }
      return
    }

    console.log('✅ Password is valid!')

    // Step 5: Email verification check (exact same logic)
    console.log('\n📧 Step 5: Email verification check...')
    console.log('   emailVerified raw value:', user.emailVerified)
    console.log('   emailVerified type:', typeof user.emailVerified)
    console.log('   emailVerified instanceof Date:', user.emailVerified instanceof Date)
    console.log('   emailVerified truthy:', !!user.emailVerified)

    // Exact logic from verifyCredentialsUser
    const isEmailVerified =
      user.emailVerified &&
      (user.emailVerified instanceof Date ||
        typeof user.emailVerified === 'string' ||
        typeof user.emailVerified === 'number')

    console.log('📧 Email verification result:', isEmailVerified)

    if (!isEmailVerified) {
      console.log('❌ Email verification failed!')
      console.log('   This is why authentication is failing')
      return
    }

    console.log('✅ Email verification passed!')

    // Step 6: Final authentication result
    console.log('\n🎯 Step 6: Final authentication result...')
    console.log('   User found: ✅')
    console.log('   Correct provider: ✅')
    console.log('   Password valid: ✅')
    console.log('   Email verified: ✅')
    console.log('   Should authenticate: ✅')

    console.log('\n🚀 AUTHENTICATION SHOULD SUCCEED!')
    console.log("If it's still failing, the issue is elsewhere in the auth flow.")

    // Step 7: Let's also check if there are any other issues
    console.log('\n🔍 Step 7: Additional checks...')

    // Check if user has all required fields
    const requiredFields = [
      'id',
      'email',
      'hashedPassword',
      'name',
      'firstName',
      'lastName',
      'ecclesia',
      'role',
      'provider',
      'createdAt',
    ]
    const missingFields = requiredFields.filter((field) => !user[field])

    if (missingFields.length > 0) {
      console.log('⚠️  Missing fields:', missingFields)
    } else {
      console.log('✅ All required fields present')
    }

    // Check for any weird values
    if (user.role === undefined || user.role === null) {
      console.log('⚠️  Role is undefined/null')
    }

    if (!user.createdAt) {
      console.log('⚠️  createdAt is missing')
    }
  } catch (error) {
    console.error('💥 Error during live auth debug:', error)
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
    })
  }
}

// Run the debug
debugLiveAuth()
  .then(() => {
    console.log('\n🏁 Live auth debug completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Live debug failed:', error)
    process.exit(1)
  })
