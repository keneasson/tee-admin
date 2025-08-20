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

async function fixKenUser() {
  const email = 'ken.easson@gmail.com'

  console.log('🔧 Fixing email verification for:', email)

  try {
    // Find the credentials user
    const result = await client.query({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
      },
    })

    const credentialsUser = result.Items?.find((item) => item.provider === 'credentials')

    if (!credentialsUser) {
      console.log('❌ No credentials user found for', email)
      return
    }

    console.log('👤 Found user:', credentialsUser.id)
    console.log('📧 Current emailVerified:', credentialsUser.emailVerified)

    if (credentialsUser.emailVerified) {
      console.log('✅ User email is already verified!')
      return
    }

    // Update the user to mark email as verified
    console.log('🔧 Setting email as verified...')

    await client.update({
      TableName: TABLE_NAME,
      Key: {
        pkey: `USER#${credentialsUser.id}`,
        skey: `USER#${credentialsUser.id}`,
      },
      UpdateExpression: 'SET emailVerified = :now',
      ExpressionAttributeValues: {
        ':now': new Date(),
      },
    })

    console.log('✅ Email verification status updated!')

    // Verify the update worked
    const updatedResult = await client.get({
      TableName: TABLE_NAME,
      Key: {
        pkey: `USER#${credentialsUser.id}`,
        skey: `USER#${credentialsUser.id}`,
      },
    })

    console.log('📧 New emailVerified value:', updatedResult.Item?.emailVerified)
    console.log('✅ User', email, 'should now be able to log in!')
  } catch (error) {
    console.error('💥 Error fixing user:', error)
  }
}

// Run the fix
fixKenUser()
  .then(() => {
    console.log('\n🏁 Fix completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Fix failed:', error)
    process.exit(1)
  })
