import { NextRequest, NextResponse } from 'next/server'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { getAwsDbConfig } from '../../../../utils/email/sesClient'
import { setRecordingBrother } from '../../../../utils/rb-service'
import { rbNominationRepository } from '@my/app/provider/dynamodb/repositories/rb-nomination-repository'

const dbClientConfig = getAwsDbConfig()
const client = DynamoDBDocument.from(new DynamoDB(dbClientConfig), {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
})

/**
 * GET /api/rb/confirm?token=xxx
 *
 * Confirms a Recording Brother nomination via email link.
 * Token encodes: { personId, ecclesiaName, emailPreference, rbEcclesiaEmail, nominationId }
 * 24h expiry, single-use.
 *
 * On success: activates the RB designation via setRecordingBrother().
 * Returns a simple HTML success/error page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const action = searchParams.get('action')

  if (!token) {
    return htmlResponse('Missing Token', 'No confirmation token was provided.', false)
  }

  try {
    // Look up the token
    const result = await client.get({
      TableName: 'tee-admin',
      Key: {
        pkey: `RB_CONFIRM#${token}`,
        skey: 'TOKEN',
      },
    })

    const tokenData = result.Item
    if (!tokenData) {
      return htmlResponse('Invalid Token', 'This confirmation link is invalid or has already been used.', false)
    }

    // Check expiry
    if (new Date(tokenData.expiresAt) < new Date()) {
      return htmlResponse('Link Expired', 'This confirmation link has expired. Please request a new verification.', false)
    }

    // Check if already used
    if (tokenData.used) {
      return htmlResponse('Already Processed', 'This verification link has already been used.', false)
    }

    // Mark token as used
    await client.update({
      TableName: 'tee-admin',
      Key: {
        pkey: `RB_CONFIRM#${token}`,
        skey: 'TOKEN',
      },
      UpdateExpression: 'SET used = :used, usedAt = :usedAt',
      ExpressionAttributeValues: {
        ':used': true,
        ':usedAt': new Date().toISOString(),
      },
    })

    // Handle deny action
    if (action === 'deny') {
      // Mark nomination as withdrawn if exists
      if (tokenData.nominationId) {
        try {
          await rbNominationRepository.update(
            `RB_NOM#${tokenData.ecclesiaName}`,
            `NOMINATION#${tokenData.nominationId}`,
            { status: 'withdrawn' } as any
          )
        } catch (e) {
          console.error('Failed to update nomination status:', e)
        }
      }

      return htmlResponse(
        'Declined',
        `You have declined the Recording Brother designation for ${tokenData.ecclesiaName}. You can close this page.`,
        false
      )
    }

    // Activate RB designation (confirm action)
    await setRecordingBrother({
      ecclesiaName: tokenData.ecclesiaName,
      newPersonId: tokenData.personId,
      emailPreference: tokenData.emailPreference || 'personal',
      rbEcclesiaEmail: tokenData.rbEcclesiaEmail || undefined,
      callerEmail: 'system-rb-confirm',
    })

    // If there's a nomination, mark it as accepted
    if (tokenData.nominationId) {
      try {
        await rbNominationRepository.update(
          `RB_NOM#${tokenData.ecclesiaName}`,
          `NOMINATION#${tokenData.nominationId}`,
          { status: 'accepted' } as any
        )
      } catch (e) {
        // Non-critical — nomination record update failing shouldn't block confirmation
        console.error('Failed to update nomination status:', e)
      }
    }

    return htmlResponse(
      'Confirmed!',
      `You are now the Recording Brother for ${tokenData.ecclesiaName}. You can close this page.`,
      true
    )
  } catch (error) {
    console.error('RB confirmation error:', error)
    return htmlResponse('Error', 'An error occurred while processing your request. Please try again.', false)
  }
}

function htmlResponse(title: string, message: string, success: boolean): NextResponse {
  const color = success ? '#16a34a' : '#dc2626'
  const icon = success ? '&#10003;' : '&#10007;'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${title} — TEE Admin</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 500px; margin: 40px auto; padding: 20px; text-align: center;">
        <div style="background-color: #f8f9fa; padding: 40px; border-radius: 12px;">
          <div style="font-size: 48px; color: ${color}; margin-bottom: 16px;">${icon}</div>
          <h1 style="color: #333; margin-bottom: 12px;">${title}</h1>
          <p style="color: #666; line-height: 1.6;">${message}</p>
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">TEE Admin ${new Date().getFullYear()}</p>
      </body>
    </html>
  `

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
