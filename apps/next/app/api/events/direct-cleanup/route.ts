import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { scheduleRepo } from '@my/app/provider/dynamodb'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') // 'scan', 'cleanup'
    const title = searchParams.get('title') || 'Sussex Thanksgiving Weekend'
    
    // Direct DynamoDB scan for all EVENT records with the specific title
    const scanParams = {
      FilterExpression: 'begins_with(pkey, :eventPrefix) AND contains(title, :title)',
      ExpressionAttributeValues: {
        ':eventPrefix': 'EVENT',
        ':title': title
      }
    }
    
    console.log('[DirectCleanup] Scanning with params:', scanParams)
    
    // Scan all matching records
    const allRecords: any[] = []
    let lastEvaluatedKey = undefined
    
    do {
      const scanResult = await scheduleRepo.scan({
        ...scanParams,
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
      })
      
      if (scanResult.Items) {
        allRecords.push(...scanResult.Items)
      }
      
      lastEvaluatedKey = scanResult.LastEvaluatedKey
    } while (lastEvaluatedKey)
    
    console.log(`[DirectCleanup] Found ${allRecords.length} records`)
    
    if (action === 'cleanup') {
      // Sort by lastUpdated/updatedAt descending to keep the most recent
      const sortedRecords = allRecords.sort((a, b) => {
        const aDate = new Date(a.lastUpdated || a.updatedAt || a.createdAt || 0)
        const bDate = new Date(b.lastUpdated || b.updatedAt || b.createdAt || 0)
        return bDate.getTime() - aDate.getTime()
      })
      
      // Keep the first (most recent) record, delete the rest
      const toKeep = sortedRecords[0]
      const toDelete = sortedRecords.slice(1)
      
      console.log(`[DirectCleanup] Keeping record: ${toKeep?.pkey}/${toKeep?.skey}`)
      console.log(`[DirectCleanup] Deleting ${toDelete.length} records`)
      
      // Delete the duplicate records
      const deletePromises = toDelete.map(record => {
        console.log(`[DirectCleanup] Deleting: ${record.pkey}/${record.skey}`)
        return scheduleRepo.delete({
          pkey: record.pkey,
          skey: record.skey
        })
      })
      
      const deleteResults = await Promise.allSettled(deletePromises)
      const successful = deleteResults.filter(r => r.status === 'fulfilled').length
      const failed = deleteResults.filter(r => r.status === 'rejected').length
      
      return NextResponse.json({
        message: `Direct cleanup complete`,
        totalFound: allRecords.length,
        kept: 1,
        deletedCount: successful,
        failedCount: failed,
        keptRecord: {
          pkey: toKeep?.pkey,
          skey: toKeep?.skey,
          title: toKeep?.title,
          lastUpdated: toKeep?.lastUpdated || toKeep?.updatedAt
        }
      })
    }
    
    // Default: just scan and show what we found
    return NextResponse.json({
      message: `Found ${allRecords.length} records with title containing "${title}"`,
      totalRecords: allRecords.length,
      sampleRecords: allRecords.slice(0, 5).map(r => ({
        pkey: r.pkey,
        skey: r.skey,
        title: r.title,
        type: r.type,
        lastUpdated: r.lastUpdated || r.updatedAt || r.createdAt,
        status: r.status
      })),
      allKeys: allRecords.map(r => ({ pkey: r.pkey, skey: r.skey }))
    })
  } catch (error) {
    console.error('Error in direct cleanup:', error)
    return NextResponse.json(
      { error: 'Failed to perform direct cleanup', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}