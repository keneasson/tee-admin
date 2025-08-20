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

async function debugUser() {
  const email = 'ken.easson@gmail.com'
  const password = 'jBYiW9Fda3eJJ5v'

  console.log('🔍 Debugging user authentication for:', email)
  console.log('📊 Using table:', TABLE_NAME)
  console.log('🌍 Using region:', CREDENTIAL.region)

  try {
    // Step 1: Query for user by email
    console.log('\n📋 Step 1: Querying for user by email...')
    const result = await client.query({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
      },
    })

    console.log('📊 Query result count:', result.Items?.length || 0)

    if (!result.Items || result.Items.length === 0) {
      console.log('❌ No user found with email:', email)

      // Let's check if there are any users at all
      console.log('\n🔍 Checking for any users in the table...')
      const allUsersResult = await client.scan({
        TableName: TABLE_NAME,
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: {
          '#type': 'type',
        },
        ExpressionAttributeValues: {
          ':type': 'USER',
        },
        Limit: 10,
      })

      console.log('📊 Total users found:', allUsersResult.Items?.length || 0)
      if (allUsersResult.Items && allUsersResult.Items.length > 0) {
        console.log('👥 Sample users:')
        allUsersResult.Items.forEach((user, index) => {
          console.log(
            `  ${index + 1}. Email: ${user.email}, Provider: ${user.provider}, ID: ${user.id}`
          )
        })
      }
      return
    }

    console.log('✅ User(s) found:', result.Items.length)

    for (let i = 0; i < result.Items.length; i++) {
      const user = result.Items[i]
      console.log(`\n👤 User ${i + 1} details:`)
      console.log('   ID:', user.id)
      console.log('   Email:', user.email)
      console.log('   Provider:', user.provider)
      console.log('   Name:', user.name)
      console.log('   Role:', user.role)
      console.log('   Email Verified:', user.emailVerified)
      console.log('   Created At:', user.createdAt)
      console.log('   Has Password Hash:', !!user.hashedPassword)

      // Step 2: Check if this is a credentials user
      if (user.provider !== 'credentials') {
        console.log('⚠️  User is not a credentials user, provider:', user.provider)
        continue
      }

      // Step 3: Verify password
      console.log('\n🔐 Step 3: Verifying password...')
      if (!user.hashedPassword) {
        console.log('❌ No hashed password found for user')
        continue
      }

      const isPasswordValid = await bcrypt.compare(password, user.hashedPassword)
      console.log('🔑 Password valid:', isPasswordValid)

      // Step 4: Check email verification
      console.log('\n📧 Step 4: Checking email verification...')
      const isEmailVerified =
        user.emailVerified &&
        (user.emailVerified instanceof Date ||
          typeof user.emailVerified === 'string' ||
          typeof user.emailVerified === 'number')
      console.log('✉️  Email verified:', isEmailVerified)
      console.log('✉️  Email verified value:', user.emailVerified)
      console.log('✉️  Email verified type:', typeof user.emailVerified)

      // Final verification result
      console.log('\n🎯 Final Authentication Result:')
      console.log('   User found:', true)
      console.log('   Provider is credentials:', user.provider === 'credentials')
      console.log('   Password valid:', isPasswordValid)
      console.log('   Email verified:', isEmailVerified)
      console.log('   Should authenticate:', isPasswordValid && isEmailVerified)

      if (isPasswordValid && isEmailVerified) {
        console.log('✅ User should be able to authenticate successfully!')
      } else {
        console.log('❌ Authentication should fail due to:')
        if (!isPasswordValid) console.log('   - Invalid password')
        if (!isEmailVerified) console.log('   - Email not verified')
      }
    }
  } catch (error) {
    console.error('💥 Error querying database:', error)
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code || error.$metadata?.httpStatusCode,
    })
  }
}

// Run the debug script
debugUser()
  .then(() => {
    console.log('\n🏁 Debug script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  })
