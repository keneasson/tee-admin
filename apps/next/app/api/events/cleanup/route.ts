import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { getAllEvents, deleteEvent } from '@my/app/services/event-service'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') // 'analyze', 'dryrun', or 'cleanup'
    
    // Get all events to find duplicates
    const allEvents = await getAllEvents()
    
    // Group events by title and type to find potential duplicates
    const eventGroups: { [key: string]: any[] } = {}
    
    allEvents.forEach(event => {
      const key = `${event.title}-${event.type}`.toLowerCase()
      if (!eventGroups[key]) {
        eventGroups[key] = []
      }
      eventGroups[key].push(event)
    })
    
    const toDelete: string[] = []
    
    // For each group with duplicates, keep the most recent one and mark others for deletion
    Object.entries(eventGroups).forEach(([key, events]) => {
      if (events.length > 1) {
        // Sort by updatedAt desc, keep the first (most recent), delete the rest
        const sorted = events.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        const toDeleteFromGroup = sorted.slice(1).map(e => e.id)
        toDelete.push(...toDeleteFromGroup)
      }
    })
    
    if (action === 'cleanup') {
      // Actually delete the duplicate events
      const deleteResults = await Promise.allSettled(
        toDelete.map(id => deleteEvent(id))
      )
      
      const successful = deleteResults.filter(r => r.status === 'fulfilled').length
      const failed = deleteResults.filter(r => r.status === 'rejected').length
      
      return NextResponse.json({
        message: `Cleanup complete`,
        deletedCount: successful,
        failedCount: failed,
        totalDuplicates: toDelete.length
      })
    }
    
    if (action === 'dryrun') {
      return NextResponse.json({
        message: 'Dry run - no events deleted',
        toDelete: toDelete,
        count: toDelete.length
      })
    }
    
    // Default: analyze duplicates
    const duplicateGroups = Object.entries(eventGroups)
      .filter(([key, events]) => events.length > 1)
      .map(([key, events]) => ({
        key,
        count: events.length,
        events: events.map(e => ({
          id: e.id,
          title: e.title,
          type: e.type,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          status: e.status
        }))
      }))
    
    return NextResponse.json({
      totalEvents: allEvents.length,
      duplicateGroups: duplicateGroups,
      duplicateCount: duplicateGroups.reduce((sum, group) => sum + group.count - 1, 0) // Subtract 1 to keep one copy
    })
  } catch (error) {
    console.error('Error finding duplicates:', error)
    return NextResponse.json(
      { error: 'Failed to find duplicates' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const dryRun = searchParams.get('dryRun') === 'true'
    
    // Get all events to find duplicates
    const allEvents = await getAllEvents()
    
    // Group events by title and type
    const eventGroups: { [key: string]: any[] } = {}
    
    allEvents.forEach(event => {
      const key = `${event.title}-${event.type}`.toLowerCase()
      if (!eventGroups[key]) {
        eventGroups[key] = []
      }
      eventGroups[key].push(event)
    })
    
    const toDelete: string[] = []
    
    // For each group with duplicates, keep the most recent one and mark others for deletion
    Object.entries(eventGroups).forEach(([key, events]) => {
      if (events.length > 1) {
        // Sort by updatedAt desc, keep the first (most recent), delete the rest
        const sorted = events.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        const toDeleteFromGroup = sorted.slice(1).map(e => e.id)
        toDelete.push(...toDeleteFromGroup)
      }
    })
    
    if (dryRun) {
      return NextResponse.json({
        message: 'Dry run - no events deleted',
        toDelete: toDelete,
        count: toDelete.length
      })
    }
    
    // Actually delete the duplicate events
    const deleteResults = await Promise.allSettled(
      toDelete.map(id => deleteEvent(id))
    )
    
    const successful = deleteResults.filter(r => r.status === 'fulfilled').length
    const failed = deleteResults.filter(r => r.status === 'rejected').length
    
    return NextResponse.json({
      message: `Cleanup complete`,
      deletedCount: successful,
      failedCount: failed,
      totalDuplicates: toDelete.length
    })
  } catch (error) {
    console.error('Error cleaning up duplicates:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup duplicates' },
      { status: 500 }
    )
  }
}