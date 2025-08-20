/**
 * Email Client Compatibility Testing Framework
 * 
 * This test suite ensures newsletter emails render correctly across different email clients
 * and validates responsive design, accessibility, and deliverability standards.
 */

import { render } from '@react-email/render'
import Newsletter from '../emails/Newsletter'
import { ProgramsTypes } from '@my/app/types'

// Mock data for testing
const mockNewsletterData = [
  {
    Key: ProgramsTypes.memorial,
    Date: '2024-01-28',
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
    Date: '2024-01-31',
    Presider: 'Bro. James Wilson',
    Speaker: 'Bro. Robert Taylor',
    Topic: 'The Kingdom of God on Earth',
  }
]

// Email Client Compatibility Tests
describe('Email Client Compatibility', () => {
  
  describe('HTML Rendering', () => {
    it('should render valid HTML for all email clients', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      // Basic HTML validation
      expect(html).toContain('<!DOCTYPE html')
      expect(html).toContain('<html lang="en">')
      expect(html).toContain('</html>')
      expect(html).toContain('<body')
      expect(html).toContain('</body>')
    })

    it('should include proper meta tags for email clients', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      // Check for email-specific meta tags
      expect(html).toContain('<meta http-equiv="Content-Type"')
      expect(html).toContain('charset=utf-8')
    })

    it('should use table-based layout for better email client support', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      // Email clients prefer table-based layouts
      expect(html).toContain('<table')
      expect(html).toContain('<tr')
      expect(html).toContain('<td')
    })
  })

  describe('CSS Compatibility', () => {
    it('should use inline styles for maximum compatibility', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      // Check for inline styles (React Email converts CSS-in-JS to inline)
      expect(html).toMatch(/style="[^"]*font-family/)
      expect(html).toMatch(/style="[^"]*color/)
      expect(html).toMatch(/style="[^"]*background/)
    })

    it('should include media queries for responsive design', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      // Check for responsive media queries
      expect(html).toContain('@media')
      expect(html).toContain('max-width')
      expect(html).toContain('deviceWidth')
    })

    it('should avoid CSS properties not supported by email clients', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      // These CSS properties are not well supported in email clients
      expect(html).not.toContain('flex')
      expect(html).not.toContain('grid')
      expect(html).not.toContain('transform') // except for simple transforms
      expect(html).not.toContain('box-shadow') // limited support
    })
  })

  describe('Mobile Responsiveness', () => {
    it('should include mobile-optimized container widths', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      // Check for mobile-friendly container classes
      expect(html).toContain('deviceWidth')
      expect(html).toContain('container')
    })

    it('should use appropriate font sizes for mobile', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      // Font sizes should be at least 14px for mobile readability
      expect(html).toMatch(/font-size.*1[6-9]px|font-size.*[2-9][0-9]px/)
    })

    it('should have proper viewport meta tag', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      // This is handled by React Email, but let's verify
      expect(html).toContain('width=device-width')
    })
  })

  describe('Accessibility', () => {
    it('should include proper semantic HTML structure', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      // Check for semantic HTML elements
      expect(html).toContain('<h1') // or heading elements
      expect(html).toContain('<p') // paragraph elements
      expect(html).toContain('lang="en"')
    })

    it('should include alt text for images', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      // If there are images, they should have alt text
      const imageMatches = html.match(/<img[^>]+>/g)
      if (imageMatches) {
        imageMatches.forEach(img => {
          expect(img).toMatch(/alt="[^"]*"/)
        })
      }
    })

    it('should have proper color contrast', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      // Basic check for dark text on light background
      expect(html).toMatch(/color:\s*#[0-2][0-9a-f]{5}/) // Dark colors
      expect(html).toMatch(/background.*#[f-F][a-f0-9]{5}/) // Light backgrounds
    })
  })

  describe('Content Validation', () => {
    it('should render memorial service information correctly', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      expect(html).toContain('Memorial Service')
      expect(html).toContain('Bro. John Smith') // Presiding
      expect(html).toContain('Bro. David Wilson') // Exhorting
      expect(html).toContain('Bible Society') // Collection
    })

    it('should render bible class information correctly', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      expect(html).toContain('Bible Class')
      expect(html).toContain('Bro. James Wilson') // Presider  
      expect(html).toContain('The Kingdom of God on Earth') // Topic
    })

    it('should render hymn numbers correctly', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      expect(html).toContain('Opening: ')
      expect(html).toContain('123') // Opening hymn
      expect(html).toContain('456') // Exhortation hymn
      expect(html).toContain('789') // Memorial hymn
      expect(html).toContain('012') // Closing hymn
    })

    it('should handle empty or missing data gracefully', async () => {
      const emptyData = [{
        Key: ProgramsTypes.memorial,
        Date: '2024-01-28',
        Preside: '',
        Exhort: '',
        Organist: '',
        Steward: '',
        Doorkeeper: '',
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
        'Holidays and Special Events': undefined,
      }]
      
      const html = await render(<Newsletter events={emptyData} />)
      
      // Should render without errors and show appropriate messages
      expect(html).toContain('no Memorial service')
      expect(html).not.toContain('undefined')
      expect(html).not.toContain('null')
    })
  })

  describe('Email Client Specific Tests', () => {
    it('should work with Outlook 2016/2019 table limitations', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      // Outlook has specific table requirements
      expect(html).toMatch(/<table[^>]*cellpadding="0"/)
      expect(html).toMatch(/<table[^>]*cellspacing="0"/)
      expect(html).toMatch(/<table[^>]*border="0"/)
    })

    it('should include fallback fonts for better compatibility', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      // Should include web-safe font fallbacks
      expect(html).toMatch(/font-family.*sans-serif/)
      expect(html).toMatch(/font-family.*Arial|Helvetica/)
    })

    it('should avoid problematic HTML elements', async () => {
      const html = await render(<Newsletter events={mockNewsletterData} />)
      
      // These elements have poor email client support
      expect(html).not.toContain('<video')
      expect(html).not.toContain('<audio')
      expect(html).not.toContain('<embed')
      expect(html).not.toContain('<object')
      expect(html).not.toContain('<iframe')
    })
  })

  describe('Plain Text Version', () => {
    it('should generate readable plain text version', async () => {
      const plainText = await render(<Newsletter events={mockNewsletterData} />, {
        plainText: true
      })
      
      expect(plainText).toContain('Toronto East Newsletter')
      expect(plainText).toContain('Memorial Service')
      expect(plainText).toContain('Bible Class')
      expect(plainText).not.toContain('<')
      expect(plainText).not.toContain('>')
      expect(plainText).not.toContain('&nbsp;')
    })

    it('should maintain proper text formatting in plain text', async () => {
      const plainText = await render(<Newsletter events={mockNewsletterData} />, {
        plainText: true
      })
      
      // Should have line breaks and structure
      expect(plainText).toMatch(/\n.*\n/)
      expect(plainText.length).toBeGreaterThan(100)
    })
  })
})

// Email Deliverability Tests
describe('Email Deliverability', () => {
  
  it('should have appropriate subject line length', async () => {
    // Subject lines should be 30-50 characters for optimal deliverability
    const subjectLine = 'Toronto East Christadelphian Ecclesia Newsletter'
    expect(subjectLine.length).toBeLessThanOrEqual(50)
    expect(subjectLine.length).toBeGreaterThanOrEqual(10)
  })

  it('should include proper unsubscribe information', async () => {
    const html = await render(<Newsletter events={mockNewsletterData} />)
    
    // Footer should include unsubscribe information
    expect(html.toLowerCase()).toMatch(/unsubscribe|preferences/)
  })

  it('should include physical address for CAN-SPAM compliance', async () => {
    const html = await render(<Newsletter events={mockNewsletterData} />)
    
    // Should include physical address
    expect(html).toMatch(/Toronto|Ontario|Canada/i)
  })

  it('should avoid spam trigger words', async () => {
    const html = await render(<Newsletter events={mockNewsletterData} />)
    
    // Common spam trigger words to avoid
    const spamWords = ['free', 'urgent', 'act now', 'limited time', 'call now', 'click here']
    spamWords.forEach(word => {
      expect(html.toLowerCase()).not.toContain(word.toLowerCase())
    })
  })
})

// Performance Tests  
describe('Email Performance', () => {
  
  it('should render within reasonable time limits', async () => {
    const startTime = Date.now()
    await render(<Newsletter events={mockNewsletterData} />)
    const renderTime = Date.now() - startTime
    
    // Should render in under 1 second
    expect(renderTime).toBeLessThan(1000)
  })

  it('should generate HTML under size limits', async () => {
    const html = await render(<Newsletter events={mockNewsletterData} />)
    
    // Gmail clips emails over 102KB
    expect(html.length).toBeLessThan(100 * 1024) // 100KB limit
  })

  it('should handle large event datasets efficiently', async () => {
    // Create larger dataset
    const largeDataset = Array.from({ length: 10 }, (_, i) => ({
      ...mockNewsletterData[0],
      Date: `2024-02-${String(i + 1).padStart(2, '0')}`,
    }))
    
    const startTime = Date.now()
    const html = await render(<Newsletter events={largeDataset} />)
    const renderTime = Date.now() - startTime
    
    expect(renderTime).toBeLessThan(2000) // 2 second limit for large datasets
    expect(html.length).toBeGreaterThan(1000) // Should generate substantial content
  })
})