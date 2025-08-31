#!/usr/bin/env node
/**
 * Test script to verify production monitoring endpoints
 */

const https = require('https');

async function testEndpoint(url, description) {
  return new Promise((resolve) => {
    console.log(`\n🔍 Testing: ${description}`);
    console.log(`   URL: ${url}`);
    
    const startTime = Date.now();
    https.get(url, (res) => {
      const duration = Date.now() - startTime;
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`   ✅ Status: ${res.statusCode} (${duration}ms)`);
          
          // Check specific fields
          if (parsed.error) {
            console.log(`   ❌ Error: ${parsed.error}`);
          } else if (parsed.status) {
            console.log(`   📊 Response: Contains status data`);
          } else {
            console.log(`   📄 Response: ${Object.keys(parsed).join(', ')}`);
          }
          
          resolve({ success: res.statusCode === 200, duration, error: parsed.error });
        } catch (e) {
          console.log(`   ⚠️  Response: ${data.substring(0, 100)}...`);
          resolve({ success: false, duration, error: 'Invalid JSON' });
        }
      });
    }).on('error', (err) => {
      const duration = Date.now() - startTime;
      console.log(`   ❌ Network Error: ${err.message} (${duration}ms)`);
      resolve({ success: false, duration, error: err.message });
    }).setTimeout(10000, () => {
      console.log(`   ⏰ Timeout after 10 seconds`);
      resolve({ success: false, duration: 10000, error: 'Timeout' });
    });
  });
}

async function main() {
  console.log('🚀 Testing Production Monitoring Endpoints');
  console.log('==========================================');
  
  const tests = [
    {
      url: 'https://www.tee-admin.com/api/admin/test-sync/status',
      description: 'Test Sync Status'
    },
    {
      url: 'https://www.tee-admin.com/api/admin/multi-sheet-sync/status', 
      description: 'Multi-Sheet Sync Status'
    },
    {
      url: 'https://www.tee-admin.com/api/sheets/webhook/status',
      description: 'Webhook Status'
    },
    {
      url: 'https://www.tee-admin.com/api/upcoming-program',
      description: 'Upcoming Program API'
    },
    {
      url: 'https://www.tee-admin.com/api/enhanced-schedule?type=memorial',
      description: 'Enhanced Schedule API'
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await testEndpoint(test.url, test.description);
    results.push({ ...test, ...result });
  }
  
  // Summary
  console.log('\n📋 Summary');
  console.log('===========');
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`✅ Successful: ${successful}/${total}`);
  console.log(`⏱️  Average Response Time: ${Math.round(results.reduce((sum, r) => sum + r.duration, 0) / total)}ms`);
  
  if (successful < total) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   • ${r.description}: ${r.error}`);
    });
  }
  
  console.log('\n🔗 Production Admin Panel: https://www.tee-admin.com/admin/data-sync');
  
  process.exit(successful === total ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}