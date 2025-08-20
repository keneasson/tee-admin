// Test legacy directory lookup
const fetch = require('node-fetch')

async function testLegacyLookup() {
  try {
    // Test the role assignment for Ken
    console.log('🔍 Testing role assignment for ken.easson@gmail.com')
    const response = await fetch(
      'http://localhost:3001/api/debug/check-role?email=ken.easson@gmail.com'
    )
    const result = await response.json()

    console.log('📋 Results:')
    console.log('  Found in directory:', result.found)
    console.log('  Assigned role:', result.assignedRole)
    console.log('  Expected: owner')

    if (result.found && result.directoryUser) {
      console.log('  Directory user details:')
      console.log('    Name:', result.directoryUser.FirstName, result.directoryUser.LastName)
      console.log('    Email:', result.directoryUser.Email)
      console.log('    Ecclesia:', result.directoryUser.ecclesia)
    }

    if (result.assignedRole === 'owner') {
      console.log('✅ PASS: Ken correctly assigned owner role')
    } else {
      console.log('❌ FAIL: Ken should be owner but was assigned:', result.assignedRole)
    }

    // Test with a typical member email
    console.log('\n🔍 Testing role assignment for a member...')
    // We'll need to check what emails are in the directory first
  } catch (error) {
    console.error('❌ Error testing legacy lookup:', error)
  }
}

testLegacyLookup()
