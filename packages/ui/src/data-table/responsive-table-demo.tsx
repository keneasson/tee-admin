'use client'

import React from 'react'
import { ResponsiveDataTable } from './responsive-data-table'
import { type ColumnDef } from '@tanstack/react-table'

// Sample data structure for testing responsive behavior
interface ScheduleEvent {
  id: string
  date: string
  time: string
  event: string
  presider: string
  speaker: string
  location: string
}

// Sample data with varying text lengths to test overflow
const sampleData: ScheduleEvent[] = [
  {
    id: '1',
    date: '2025-01-12',
    time: '11:00 AM',
    event: 'Memorial Service',
    presider: 'John Smith',
    speaker: 'David Brown',
    location: 'Main Hall',
  },
  {
    id: '2',
    date: '2025-01-12',
    time: '9:30 AM',
    event: 'Sunday School - Youth Class',
    presider: 'Mary Johnson-Wilson',
    speaker: 'Sarah Wilson-Anderson',
    location: 'Classroom A',
  },
  {
    id: '3',
    date: '2025-01-19',
    time: '11:00 AM',
    event: 'Memorial Service with Special Guest Speaker',
    presider: 'Robert Davis-Thompson',
    speaker: 'Michael Lee-Brown',
    location: 'Main Auditorium Hall',
  },
  {
    id: '4',
    date: '2025-01-19',
    time: '7:30 PM',
    event: 'Bible Class',
    presider: 'Peter Anderson',
    speaker: 'Mark Thompson',
    location: 'Fellowship Hall',
  },
  {
    id: '5',
    date: '2025-01-26',
    time: '6:30 PM',
    event: 'CYC Meeting and Activity Planning Session',
    presider: 'Youth Coordinator Team',
    speaker: 'Guest Speaker from Regional Office',
    location: 'Youth Room',
  },
]

// Column definitions designed to test responsive behavior
const columns: ColumnDef<ScheduleEvent>[] = [
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) => {
      const date = new Date(row.getValue('date'))
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    },
    size: 120,
    minSize: 100,
    maxSize: 150,
  },
  {
    accessorKey: 'time',
    header: 'Time',
    size: 100,
    minSize: 80,
    maxSize: 120,
  },
  {
    accessorKey: 'event',
    header: 'Event',
    size: 200,
    minSize: 150,
    maxSize: 300,
  },
  {
    accessorKey: 'presider',
    header: 'Presider',
    size: 150,
    minSize: 120,
    maxSize: 200,
  },
  {
    accessorKey: 'speaker',
    header: 'Speaker',
    size: 150,
    minSize: 120,
    maxSize: 200,
  },
  {
    accessorKey: 'location',
    header: 'Location',
    size: 130,
    minSize: 100,
    maxSize: 180,
  },
]

export function ResponsiveTableDemo() {
  return (
    <ResponsiveDataTable
      data={sampleData}
      columns={columns}
      searchPlaceholder="Search events, people, or locations..."
      pageSize={10}
      maxPageSize={100}
    />
  )
}