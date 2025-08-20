// This script will help debug the app configuration
const { getAwsDbConfig } = require('./utils/email/sesClient')

console.log('🔍 Debugging app AWS configuration')
console.log('🌍 Current working directory:', process.cwd())
console.log('📊 Node environment:', process.env.NODE_ENV)

// Check environment variables
console.log('\n📋 Environment variables:')
console.log(
  '   AWS_ACCESS_KEY_ID:',
  process.env.AWS_ACCESS_KEY_ID ? `${process.env.AWS_ACCESS_KEY_ID.substring(0, 10)}...` : 'NOT SET'
)
console.log(
  '   AWS_SECRET_ACCESS_KEY:',
  process.env.AWS_SECRET_ACCESS_KEY
    ? `${process.env.AWS_SECRET_ACCESS_KEY.substring(0, 10)}...`
    : 'NOT SET'
)
console.log('   AWS_REGION:', process.env.AWS_REGION)
console.log('   NEXTAUTH_URL:', process.env.NEXTAUTH_URL)
console.log('   NEXT_PUBLIC_SECRET:', process.env.NEXT_PUBLIC_SECRET ? 'SET' : 'NOT SET')

// Check the getAwsDbConfig function
console.log('\n🔧 AWS DB Config from sesClient:')
try {
  const config = getAwsDbConfig()
  console.log('   Region:', config.region)
  console.log(
    '   Access Key ID:',
    config.credentials?.accessKeyId
      ? `${config.credentials.accessKeyId.substring(0, 10)}...`
      : 'NOT SET'
  )
  console.log(
    '   Secret Access Key:',
    config.credentials?.secretAccessKey
      ? `${config.credentials.secretAccessKey.substring(0, 10)}...`
      : 'NOT SET'
  )
} catch (error) {
  console.error('❌ Error getting AWS config:', error.message)
}

console.log('\n🏁 Configuration debug completed')
