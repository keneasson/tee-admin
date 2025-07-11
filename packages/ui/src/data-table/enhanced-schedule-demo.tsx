'use client'

import React from 'react'
import { EnhancedScheduleTable, type EnhancedScheduleEvent } from './enhanced-schedule-table'
import { type ScheduleTab } from './schedule-tabs'

// Sample schedule tabs based on the existing codebase structure
const sampleTabs: ScheduleTab[] = [
  { id: 'memorial', name: 'Memorial Service', key: 'memorial' },
  { id: 'sunday-school', name: 'Sunday School', key: 'sundaySchool' },
  { id: 'bible-class', name: 'Bible Class', key: 'bibleClass' },
  { id: 'cyc', name: 'CYC', key: 'cyc' },
]

// Sample data for each schedule type with enhanced features
const generateSampleData = (): Record<string, EnhancedScheduleEvent[]> => {
  const today = new Date()
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  const following = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)

  return {
    memorial: [
      {
        id: 'mem-1',
        date: today.toISOString().split('T')[0],
        time: '11:00 AM',
        event: 'Memorial Service',
        presider: 'John Smith',
        speaker: 'David Brown',
        steward: 'Michael Wilson',
        location: 'Main Hall',
        type: 'memorial',
        isNextEvent: true,
        userHighlight: true,
      },
      {
        id: 'mem-2',
        date: nextWeek.toISOString().split('T')[0],
        time: '11:00 AM',
        event: 'Memorial Service',
        presider: 'Robert Davis',
        speaker: 'John Smith', // Same person as presider from previous - conflict demo
        steward: 'James Taylor',
        location: 'Main Hall',
        type: 'memorial',
        hasConflict: true,
      },
      {
        id: 'mem-3',
        date: following.toISOString().split('T')[0],
        time: '11:00 AM',
        event: 'Memorial Service',
        presider: 'William Johnson',
        speaker: 'Thomas Anderson',
        steward: 'John Smith',
        location: 'Main Hall',
        type: 'memorial',
        userHighlight: true,
      },
    ],
    'sunday-school': [
      {
        id: 'ss-1',
        date: today.toISOString().split('T')[0],
        time: '9:30 AM',
        event: 'Sunday School',
        presider: 'Mary Johnson',
        speaker: 'Sarah Wilson',
        location: 'Classroom A',
        type: 'sunday-school',
      },
      {
        id: 'ss-2',
        date: nextWeek.toISOString().split('T')[0],
        time: '9:30 AM',
        event: 'Sunday School',
        presider: 'Jennifer Davis',
        speaker: 'John Smith',
        location: 'Classroom A',
        type: 'sunday-school',
        userHighlight: true,
      },
      {
        id: 'ss-3',
        date: following.toISOString().split('T')[0],
        time: '9:30 AM',
        event: 'Sunday School',
        presider: 'Lisa Brown',
        speaker: 'Emily Taylor',
        location: 'Classroom A',
        type: 'sunday-school',
      },
    ],
    'bible-class': [
      {
        id: 'bc-1',
        date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '7:30 PM',
        event: 'Bible Class',
        presider: 'Peter Anderson',
        speaker: 'Mark Thompson',
        location: 'Fellowship Hall',
        type: 'bible-class',
        isNextEvent: true,
      },
      {
        id: 'bc-2',
        date: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '7:30 PM',
        event: 'Bible Class',
        presider: 'John Smith',
        speaker: 'Daniel Lee',
        location: 'Fellowship Hall',
        type: 'bible-class',
        userHighlight: true,
      },
    ],
    cyc: [
      {
        id: 'cyc-1',
        date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '6:30 PM',
        event: 'CYC Meeting',
        presider: 'Youth Coordinator',
        speaker: 'Guest Speaker',
        location: 'Youth Room',
        type: 'cyc',
      },
      {
        id: 'cyc-2',
        date: new Date(today.getTime() + 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '6:30 PM',
        event: 'CYC Activity',
        presider: 'Youth Leader',
        speaker: 'John Smith',
        location: 'Youth Room',
        type: 'cyc',
        userHighlight: true,
      },
    ],
  }
}

export function EnhancedScheduleDemo() {
  const sampleData = generateSampleData()
  
  const handleTabChange = (tabKey: string) => {
    console.log('Tab changed to:', tabKey)
  }

  return (
    <EnhancedScheduleTable
      tabs={sampleTabs}
      data={sampleData}
      currentUser="John Smith" // Demo user for highlighting
      onTabChange={handleTabChange}
      activeTab="memorial"
    />
  )
}