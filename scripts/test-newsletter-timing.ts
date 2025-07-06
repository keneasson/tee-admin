#!/usr/bin/env tsx

/**
 * Test the newsletter timing logic - verify 2 hour buffer works correctly
 */

async function testNewsletterTiming() {
  try {
    console.log('🧪 Testing Newsletter Timing Logic')
    console.log('='.repeat(50))
    
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000))
    const twoWeeksFromNow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000))
    
    console.log('Current time:', now.toISOString())
    console.log('2 hours ago:', twoHoursAgo.toISOString())
    console.log('2 weeks from now:', twoWeeksFromNow.toISOString())
    
    console.log('\n📅 Fetching upcoming events...')
    const response = await fetch('http://localhost:4000/api/upcoming-program')
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    
    const events = await response.json()
    console.log(`\n✅ Found ${events.length} events`)
    
    if (events.length > 0) {
      console.log('\n📋 Event Timeline:')
      events.forEach((event, index) => {
        const eventDate = new Date(event.date)
        const hoursFromNow = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60)
        const status = hoursFromNow < 0 ? '🔴 PAST' : hoursFromNow < 2 ? '🟡 SOON' : '🟢 FUTURE'
        
        console.log(`  ${index + 1}. ${status} ${event.type} - ${eventDate.toLocaleDateString()} ${eventDate.toLocaleTimeString()} (${hoursFromNow.toFixed(1)}h from now)`)
      })
      
      // Check if we have any events that started within the last 2 hours
      const recentEvents = events.filter(event => {
        const eventDate = new Date(event.date)
        const hoursFromNow = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60)
        return hoursFromNow >= -2 && hoursFromNow < 0
      })
      
      console.log(`\n🎯 Events that started within last 2 hours: ${recentEvents.length}`)
      
      if (recentEvents.length > 0) {
        console.log('✅ 2-hour buffer is working - showing recently started events')
      } else {
        console.log('ℹ️  No recently started events found (this is normal if no events started in the last 2 hours)')
      }
    }
    
    console.log('\n🎉 Newsletter timing test complete!')
    
  } catch (error) {
    console.error('❌ Error testing newsletter timing:', error)
  }
}

testNewsletterTiming()