// Test role assignment for Ken's email
const fetch = require('node-fetch')

async function testRoleAssignment() {
  try {
    const response = await fetch(
      'http://localhost:3001/api/debug/check-role?email=ken.easson@gmail.com'
    )
    const result = await response.json()

    console.log('🔍 Role assignment test results:')
    console.log(JSON.stringify(result, null, 2))

    if (result.assignedRole === 'owner') {
      console.log('✅ Correct! Ken should be assigned owner role')
    } else {
      console.log('❌ Issue: Ken should be owner but was assigned:', result.assignedRole)
    }
  } catch (error) {
    console.error('❌ Error testing role assignment:', error)
  }
}

testRoleAssignment()
