const { DynamoDBDocument } = require('@aws-sdk/lib-dynamodb')
const { DynamoDB } = require('@aws-sdk/client-dynamodb')

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

async function fixKenUserProperly() {
  const email = 'ken.easson@gmail.com'
  const userId = '8dacc493-60a1-4a16-9bd9-abbfbb03dee1'

  console.log('🔧 Properly fixing email verification for:', email)
  console.log('👤 User ID:', userId)

  try {
    // Set emailVerified to current timestamp as string (more reliable for DynamoDB)
    const now = new Date()
    const timestamp = now.toISOString()

    console.log('🔧 Setting emailVerified to timestamp:', timestamp)

    await client.update({
      TableName: TABLE_NAME,
      Key: {
        pkey: `USER#${userId}`,
        skey: `USER#${userId}`,
      },
      UpdateExpression: 'SET emailVerified = :timestamp',
      ExpressionAttributeValues: {
        ':timestamp': timestamp,
      },
    })

    console.log('✅ Email verification timestamp updated!')

    // Verify the update worked
    const updatedResult = await client.get({
      TableName: TABLE_NAME,
      Key: {
        pkey: `USER#${userId}`,
        skey: `USER#${userId}`,
      },
    })

    console.log('📧 New emailVerified value:', updatedResult.Item?.emailVerified)
    console.log('📧 Type:', typeof updatedResult.Item?.emailVerified)

    // Test the verification logic
    const emailVerified = updatedResult.Item?.emailVerified
    const isEmailVerified =
      emailVerified &&
      (emailVerified instanceof Date ||
        typeof emailVerified === 'string' ||
        typeof emailVerified === 'number')

    console.log('🧪 Verification logic test:', isEmailVerified)

    if (isEmailVerified) {
      console.log('✅ User', email, 'should now be able to log in!')
    } else {
      console.log('❌ Verification logic still failing. Let me try a different approach...')

      // Try with current timestamp as number
      const timestampNumber = now.getTime()
      console.log('🔧 Trying with numeric timestamp:', timestampNumber)

      await client.update({
        TableName: TABLE_NAME,
        Key: {
          pkey: `USER#${userId}`,
          skey: `USER#${userId}`,
        },
        UpdateExpression: 'SET emailVerified = :timestamp',
        ExpressionAttributeValues: {
          ':timestamp': timestampNumber,
        },
      })

      console.log('✅ Numeric timestamp set!')
    }
  } catch (error) {
    console.error('💥 Error fixing user:', error)
  }
}

// Run the fix
fixKenUserProperly()
  .then(() => {
    console.log('\n🏁 Proper fix completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Fix failed:', error)
    process.exit(1)
  })
