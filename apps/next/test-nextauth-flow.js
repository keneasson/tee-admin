const { verifyCredentialsUser } = require('./utils/dynamodb/credentials-users')

async function testNextAuthFlow() {
  console.log('🧪 Testing the exact NextAuth authorize flow')

  const credentials = {
    email: 'ken.easson@gmail.com',
    password: 'jBYiW9Fda3eJJ5v',
  }

  console.log('📧 Email:', credentials.email)
  console.log('🔐 Password:', credentials.password)

  try {
    // This is the exact code from the authorize function
    console.log('\n🔑 Step 1: Checking credentials...')
    if (!credentials?.email || !credentials?.password) {
      console.log('❌ Missing email or password')
      return
    }
    console.log('✅ Credentials present')

    // This is the exact verifyCredentialsUser call
    console.log('\n👤 Step 2: Calling verifyCredentialsUser...')
    const user = await verifyCredentialsUser(credentials.email, credentials.password)

    console.log('📊 verifyCredentialsUser result:', !!user)

    if (user) {
      console.log('✅ User verification successful!')
      console.log('👤 User details:')
      console.log('   ID:', user.id)
      console.log('   Email:', user.email)
      console.log('   Name:', user.name)
      console.log('   Role:', user.role)
      console.log('   Provider:', user.provider)

      // This is what NextAuth returns
      const authResult = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        provider: 'credentials',
      }

      console.log('\n🎯 NextAuth authorize would return:', authResult)
      console.log('✅ AUTHENTICATION SHOULD SUCCEED')
    } else {
      console.log('❌ User verification failed!')
      console.log('❌ NextAuth authorize would return: null')
      console.log('❌ AUTHENTICATION WOULD FAIL')
    }
  } catch (error) {
    console.error('💥 Error in NextAuth flow test:', error)
    console.error('❌ AUTHENTICATION WOULD FAIL DUE TO ERROR')
  }
}

// Run the test
testNextAuthFlow()
  .then(() => {
    console.log('\n🏁 NextAuth flow test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 NextAuth flow test failed:', error)
    process.exit(1)
  })
