import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { NewsletterPreviewGenerator } from '@my/app/utils/newsletter/preview-generator'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { getAwsDbConfig } from '../../../../utils/email/sesClient'

/**
 * Newsletter Assembly API Endpoint
 * Generates 90% complete newsletter preview using rule-based assembly
 */

// GET /api/newsletter/assemble - Generate newsletter preview
export async function GET(request: NextRequest) {
  try {
    // Check authentication (newsletter assembly requires admin access)
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check admin permissions
    const userRole = (session.user as any).role || 'guest'
    if (!['admin', 'owner'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Admin access required for newsletter assembly' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const format = searchParams.get('format') || 'both'
    
    // Determine newsletter date (default to next Thursday)
    const newsletterDate = dateParam 
      ? new Date(dateParam)
      : getNextThursday(new Date())

    console.log(`📰 Newsletter assembly requested for ${newsletterDate.toDateString()} by ${session.user.email}`)

    // Initialize DynamoDB
    const dbClientConfig = getAwsDbConfig()
    const dynamoDb = DynamoDBDocument.from(new DynamoDB(dbClientConfig), {
      marshallOptions: {
        convertEmptyValues: true,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
    })
    
    // Create preview generator with fast data service
    const generator = new NewsletterPreviewGenerator(dynamoDb)
    
    // Generate newsletter preview
    const preview = await generator.generatePreview(
      newsletterDate,
      format as any
    )

    // Log assembly results
    console.log(`✅ Newsletter assembly completed:
      - Date: ${newsletterDate.toDateString()}
      - Completeness: ${preview.metadata.completenessScore}%
      - Ready to Send: ${preview.metadata.readyToSend}
      - Events: ${preview.metadata.contentSummary.totalEvents}
      - Errors: ${preview.metadata.validationSummary.errorCount}
      - Warnings: ${preview.metadata.validationSummary.warningCount}
    `)

    // Return preview data
    return NextResponse.json({
      success: true,
      preview,
      metadata: {
        assembledBy: session.user.email,
        assembledAt: new Date().toISOString(),
        newsletterDate: newsletterDate.toISOString(),
        format
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Newsletter-Date': newsletterDate.toISOString(),
        'X-Completeness-Score': preview.metadata.completenessScore.toString(),
        'X-Ready-To-Send': preview.metadata.readyToSend.toString()
      }
    })

  } catch (error) {
    console.error('❌ Newsletter assembly failed:', error)
    
    return NextResponse.json(
      {
        error: 'Newsletter assembly failed',
        message: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'An error occurred during newsletter assembly'
      },
      { status: 500 }
    )
  }
}

// POST /api/newsletter/assemble - Save assembled newsletter with overrides
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check admin permissions
    const userRole = (session.user as any).role || 'guest'
    if (!['admin', 'owner'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { assemblyId, overrides, approved } = body

    if (!assemblyId) {
      return NextResponse.json(
        { error: 'Assembly ID required' },
        { status: 400 }
      )
    }

    console.log(`📝 Newsletter assembly update by ${session.user.email}:
      - Assembly ID: ${assemblyId}
      - Overrides: ${overrides?.length || 0}
      - Approved: ${approved}
    `)

    // Initialize DynamoDB
    const dbClientConfig = getAwsDbConfig()
    const dynamoDb = DynamoDBDocument.from(new DynamoDB(dbClientConfig), {
      marshallOptions: {
        convertEmptyValues: true,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
    })

    // Save assembly with overrides
    const updateResult = await saveAssemblyWithOverrides(
      dynamoDb,
      assemblyId,
      overrides || [],
      approved,
      session.user.email || 'unknown'
    )

    return NextResponse.json({
      success: true,
      assemblyId,
      status: updateResult.status,
      message: 'Newsletter assembly updated successfully'
    })

  } catch (error) {
    console.error('❌ Failed to save newsletter assembly:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to save newsletter assembly',
        message: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'An error occurred while saving the newsletter assembly'
      },
      { status: 500 }
    )
  }
}

/**
 * Get next Thursday from current date
 */
function getNextThursday(date: Date): Date {
  const result = new Date(date)
  const dayOfWeek = result.getDay()
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7 || 7 // 4 = Thursday
  result.setDate(result.getDate() + daysUntilThursday)
  result.setHours(12, 0, 0, 0) // Set to noon to avoid timezone issues
  return result
}

/**
 * Save assembly with manual overrides
 */
async function saveAssemblyWithOverrides(
  dynamoDb: any,
  assemblyId: string,
  overrides: any[],
  approved: boolean,
  approvedBy: string
): Promise<{ status: string }> {
  try {
    const now = new Date()
    
    // Save to DynamoDB
    await dynamoDb.put({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'tee-admin',
      Item: {
        pkey: `NEWSLETTER#${assemblyId}`,
        skey: 'ASSEMBLY',
        assemblyId,
        overrides,
        approved,
        approvedBy,
        approvedAt: approved ? now.toISOString() : null,
        updatedAt: now.toISOString(),
        status: approved ? 'approved' : 'under_review'
      }
    })

    return {
      status: approved ? 'approved' : 'under_review'
    }
  } catch (error) {
    console.error('Failed to save assembly to DynamoDB:', error)
    throw error
  }
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}