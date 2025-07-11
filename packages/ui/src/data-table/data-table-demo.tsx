'use client'

import React from 'react'
import { BaseDataTable } from './base-data-table'
import { type ColumnDef } from '@tanstack/react-table'

// Sample data structure for testing
interface ScheduleEvent {
  id: string
  date: string
  time: string
  event: string
  presider: string
  speaker: string
  location: string
}

// Sample data
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
    event: 'Sunday School',
    presider: 'Mary Johnson',
    speaker: 'Sarah Wilson',
    location: 'Classroom A',
  },
  {
    id: '3',
    date: '2025-01-19',
    time: '11:00 AM',
    event: 'Memorial Service',
    presider: 'Robert Davis',
    speaker: 'Michael Lee',
    location: 'Main Hall',
  },
]

// Column definitions
const columns: ColumnDef<ScheduleEvent>[] = [
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) => {
      const date = new Date(row.getValue('date'))
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    },
  },
  {
    accessorKey: 'time',
    header: 'Time',
  },
  {
    accessorKey: 'event',
    header: 'Event',
  },
  {
    accessorKey: 'presider',
    header: 'Presider',
  },
  {
    accessorKey: 'speaker',
    header: 'Speaker',
  },
  {
    accessorKey: 'location',
    header: 'Location',
  },
]

export function DataTableDemo() {
  return (
    <BaseDataTable
      data={sampleData}
      columns={columns}
      searchPlaceholder="Search schedule events..."
    />
  )
}