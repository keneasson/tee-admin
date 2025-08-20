#!/usr/bin/env node

/**
 * Email Client Testing Script
 * 
 * This script generates test emails and provides tools for manual testing
 * across different email clients and devices.
 */

import { render } from '@react-email/render'
import fs from 'fs/promises'
import path from 'path'
import Newsletter from '../emails/Newsletter'
import { ProgramsTypes } from '@my/app/types'

// Test data sets for different scenarios
const testDataSets = {
  standard: [
    {
      Key: ProgramsTypes.memorial,
      Date: '2024-02-04',
      Preside: 'Bro. John Smith',
      Exhort: 'Bro. David Wilson',
      Organist: 'Sis. Mary Johnson',
      Steward: 'Bro. Peter Brown', 
      Doorkeeper: 'Bro. Michael Davis',
      Collection: 'Bible Society',
      Lunch: 'A lunch will be served',
      Reading1: 'Psalm 23',
      Reading2: 'John 14:1-6',
      'Hymn-opening': '123',
      'Hymn-exhortation': '456', 
      'Hymn-memorial': '789',
      'Hymn-closing': '012',
      YouTube: 'https://youtube.com/watch?v=test',
      Refreshments: 'Smith Family',
      'Holidays and Special Events': undefined,
    },
    {
      Key: ProgramsTypes.bibleClass,
      Date: '2024-02-07',
      Presider: 'Bro. James Wilson',
      Speaker: 'Bro. Robert Taylor',
      Topic: 'The Kingdom of God on Earth - A Study of Daniel 2',
    }
  ],

  minimal: [
    {
      Key: ProgramsTypes.memorial,
      Date: '2024-02-04',
      Preside: 'Bro. Smith',
      Exhort: '',
      Organist: 'Sis. Johnson',
      Steward: 'Bro. Brown',
      Doorkeeper: 'Bro. Davis', 
      Collection: '',
      Lunch: '',
      Reading1: '',
      Reading2: '',
      'Hymn-opening': '',
      'Hymn-exhortation': '',
      'Hymn-memorial': '',
      'Hymn-closing': '',
      YouTube: '',
      Refreshments: '',
      'Holidays and Special Events': 'No Memorial Service - Toronto Fraternal',
    }
  ],

  extended: [
    {
      Key: ProgramsTypes.memorial,
      Date: '2024-02-04',
      Preside: 'Bro. John Alexander Smith',
      Exhort: 'Bro. David Christopher Wilson', 
      Organist: 'Sis. Mary Elizabeth Johnson',
      Steward: 'Bro. Peter Michael Brown',
      Doorkeeper: 'Bro. Michael James Davis',
      Collection: 'Christadelphian Bible Mission - Supporting work in developing countries',
      Lunch: 'A three-course lunch will be served in the basement hall following the service',
      Reading1: 'Psalm 23:1-6 - The Lord is my shepherd',
      Reading2: 'John 14:1-6 - Jesus comforts his disciples',
      'Hymn-opening': '123',
      'Hymn-exhortation': '456',
      'Hymn-memorial': '789', 
      'Hymn-closing': '012',
      YouTube: 'https://youtube.com/watch?v=test',
      Refreshments: 'Smith Family - Coffee, tea, and light refreshments',
      'Holidays and Special Events': 'Special Bible School presentation at 2:30 PM',
    },
    {
      Key: ProgramsTypes.bibleClass,
      Date: '2024-02-07',
      Presider: 'Bro. James Wilson',
      Speaker: 'Bro. Robert Taylor',
      Topic: 'The Kingdom of God on Earth - A Comprehensive Study of Daniel Chapter 2 and its Prophetic Implications for Our Time',
    },
    {
      Key: ProgramsTypes.memorial,  
      Date: '2024-02-11',
      Preside: 'Bro. William Thompson',
      Exhort: 'Bro. Charles Anderson',
      Organist: 'Sis. Sarah Wilson',
      Steward: 'Bro. Thomas Johnson',
      Doorkeeper: 'Bro. Daniel Brown',
      Collection: 'Local Ecclesial Fund',
      Lunch: 'No lunch this week',
      Reading1: 'Isaiah 53:1-12',
      Reading2: 'Romans 8:28-39',
      'Hymn-opening': '234',
      'Hymn-exhortation': '567',
      'Hymn-memorial': '890',
      'Hymn-closing': '123',
      YouTube: 'https://youtube.com/watch?v=test2',
      Refreshments: 'Johnson Family',
      'Holidays and Special Events': undefined,
    }
  ]
}

// Email client testing configurations
const testConfigs = [
  {
    name: 'Outlook 2016/2019 Desktop',
    description: 'Microsoft Outlook desktop client with Word rendering engine',
    recommendations: [
      'Use table-based layouts',
      'Avoid CSS Grid and Flexbox', 
      'Include VML for background images',
      'Use web-safe fonts'
    ]
  },
  {
    name: 'Outlook.com / Office 365',
    description: 'Web-based Outlook with better CSS support',
    recommendations: [
      'Media queries supported',
      'Better CSS3 support than desktop',
      'Still prefer table layouts'
    ]
  },
  {
    name: 'Gmail Desktop/Mobile',
    description: 'Gmail web and mobile apps',
    recommendations: [
      'Excellent CSS support',
      'Supports embedded styles',
      'Clips emails over 102KB'
    ]
  },
  {
    name: 'Apple Mail',
    description: 'iOS and macOS Mail app',
    recommendations: [
      'Excellent standards support',
      'Supports advanced CSS',
      'Good image rendering'
    ]
  },
  {
    name: 'Mobile Email Clients',
    description: 'Various mobile email clients',
    recommendations: [
      'Focus on single column layout',
      'Large touch targets (44px+)',
      'Readable font sizes (16px+)'
    ]
  }
]

async function generateTestEmails() {
  console.log('🔧 Generating test emails for manual client testing...\n')
  
  const outputDir = path.join(__dirname, '../test-output')
  await fs.mkdir(outputDir, { recursive: true })
  
  for (const [datasetName, data] of Object.entries(testDataSets)) {
    console.log(`📧 Generating ${datasetName} dataset...`)
    
    try {
      // Generate HTML version
      const html = await render(<Newsletter events={data} />)
      await fs.writeFile(
        path.join(outputDir, `newsletter-${datasetName}.html`),
        html
      )
      
      // Generate plain text version
      const plainText = await render(<Newsletter events={data} />, {
        plainText: true
      })
      await fs.writeFile(
        path.join(outputDir, `newsletter-${datasetName}.txt`),
        plainText
      )
      
      console.log(`  ✅ Generated HTML and plain text versions`)
      
    } catch (error) {
      console.error(`  ❌ Error generating ${datasetName}:`, error)
    }
  }
  
  // Generate test report
  await generateTestReport(outputDir)
  
  console.log(`\n📁 Test files generated in: ${outputDir}`)
  console.log('🌐 Open the HTML files in different email clients for testing')
}

async function generateTestReport(outputDir: string) {
  const reportContent = `
# Email Client Testing Report

Generated: ${new Date().toISOString()}

## Test Files Generated

${Object.keys(testDataSets).map(name => `
### ${name.charAt(0).toUpperCase() + name.slice(1)} Dataset
- HTML: newsletter-${name}.html
- Plain Text: newsletter-${name}.txt
`).join('')}

## Email Client Testing Checklist

${testConfigs.map(config => `
### ${config.name}
${config.description}

**Testing Steps:**
1. Open newsletter-standard.html in ${config.name}
2. Check mobile responsiveness (if applicable)
3. Verify all content renders correctly
4. Test links and buttons
5. Check font rendering and spacing

**Key Recommendations:**
${config.recommendations.map(rec => `- ${rec}`).join('\n')}

**Test Results:** [ ] Pass [ ] Fail [ ] Issues Found

**Notes:**
_Document any rendering issues or inconsistencies here_

---
`).join('')}

## Accessibility Testing

- [ ] Screen reader compatibility
- [ ] Keyboard navigation (where applicable)
- [ ] Color contrast verification
- [ ] Alt text for images
- [ ] Proper heading hierarchy

## Performance Testing

- [ ] Load time under 3 seconds
- [ ] HTML size under 100KB
- [ ] Image optimization
- [ ] Minimal external dependencies

## Deliverability Testing

- [ ] Spam score check (use tools like Mail-Tester)
- [ ] Authentication setup (SPF, DKIM, DMARC)
- [ ] Unsubscribe link present and functional
- [ ] Physical address included (CAN-SPAM compliance)

## Cross-Platform Testing Results

| Email Client | Desktop | Mobile | Tablet | Issues |
|--------------|---------|---------|---------|---------|
| Outlook 2016/2019 | [ ] | N/A | N/A | |
| Outlook.com | [ ] | [ ] | [ ] | |
| Gmail | [ ] | [ ] | [ ] | |
| Apple Mail | [ ] | [ ] | [ ] | |
| Yahoo Mail | [ ] | [ ] | [ ] | |
| Thunderbird | [ ] | N/A | N/A | |

## Notes and Recommendations

_Use this section to document overall findings and recommendations for improvement_

`
  
  await fs.writeFile(
    path.join(outputDir, 'TEST_REPORT.md'),
    reportContent.trim()
  )
  
  console.log('  ✅ Generated test report: TEST_REPORT.md')
}

async function analyzeEmailContent() {
  console.log('📊 Analyzing email content for optimization...\n')
  
  for (const [datasetName, data] of Object.entries(testDataSets)) {
    console.log(`🔍 Analyzing ${datasetName} dataset:`)
    
    try {
      const html = await render(<Newsletter events={data} />)
      const plainText = await render(<Newsletter events={data} />, {
        plainText: true
      })
      
      // Size analysis
      const htmlSize = Buffer.byteLength(html, 'utf8')
      const plainTextSize = Buffer.byteLength(plainText, 'utf8')
      
      console.log(`  📏 HTML size: ${(htmlSize / 1024).toFixed(2)}KB`)
      console.log(`  📄 Plain text size: ${(plainTextSize / 1024).toFixed(2)}KB`)
      
      // Content analysis
      const linkCount = (html.match(/<a[^>]+href/g) || []).length
      const imageCount = (html.match(/<img[^>]+src/g) || []).length
      const tableCount = (html.match(/<table/g) || []).length
      
      console.log(`  🔗 Links: ${linkCount}`)
      console.log(`  🖼️  Images: ${imageCount}`)
      console.log(`  📋 Tables: ${tableCount}`)
      
      // Warnings
      if (htmlSize > 102 * 1024) {
        console.log('  ⚠️  Warning: HTML size exceeds Gmail limit (102KB)')
      }
      
      if (linkCount > 20) {
        console.log('  ⚠️  Warning: High link count may trigger spam filters')
      }
      
      console.log('')
      
    } catch (error) {
      console.error(`  ❌ Error analyzing ${datasetName}:`, error)
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2]
  
  switch (command) {
    case 'generate':
      await generateTestEmails()
      break
      
    case 'analyze':
      await analyzeEmailContent()
      break
      
    case 'full':
      await generateTestEmails()
      await analyzeEmailContent()
      break
      
    default:
      console.log(`
📧 Email Client Testing Tool

Usage:
  npm run test-emails generate  - Generate test email files
  npm run test-emails analyze   - Analyze email content
  npm run test-emails full      - Generate and analyze

Generated files can be tested in various email clients:
- Outlook 2016/2019/365
- Gmail (web and mobile)
- Apple Mail
- Yahoo Mail
- Thunderbird
- Mobile email clients

Test files will be created in: apps/email-builder/test-output/
      `)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { generateTestEmails, analyzeEmailContent, testConfigs, testDataSets }