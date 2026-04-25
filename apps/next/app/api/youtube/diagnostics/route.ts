import { NextRequest, NextResponse } from 'next/server'
import { auth as nextAuth } from '@/utils/auth'
import { google } from 'googleapis'

/**
 * YouTube API Diagnostics Endpoint
 * Tests each step of the authentication and API access chain
 */
export async function GET(request: NextRequest) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    steps: [],
  }

  try {
    // Check authentication
    const session = await nextAuth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    diagnostics.user = session.user.email

    // Step 1: Check service account file
    diagnostics.steps.push({ step: 1, name: 'Check service account file' })
    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE

    if (!keyFile) {
      diagnostics.steps[0].status = 'FAIL'
      diagnostics.steps[0].error = 'GOOGLE_SERVICE_ACCOUNT_KEY_FILE not set'
      return NextResponse.json(diagnostics, { status: 500 })
    }

    diagnostics.steps[0].status = 'OK'
    diagnostics.steps[0].keyFile = keyFile

    // Step 2: Load credentials
    diagnostics.steps.push({ step: 2, name: 'Load service account credentials' })
    let credentials: any = null

    try {
      const fs = require('fs')
      const path = require('path')

      const possiblePaths = [
        keyFile,
        './apps/next/tee-services-db47a9e534d3.json',
        '../apps/next/tee-services-db47a9e534d3.json',
        '../../apps/next/tee-services-db47a9e534d3.json',
        process.cwd() + '/apps/next/tee-services-db47a9e534d3.json',
        process.cwd() + '/tee-services-db47a9e534d3.json',
      ]

      for (const filePath of possiblePaths) {
        try {
          if (fs.existsSync(filePath)) {
            credentials = JSON.parse(fs.readFileSync(filePath, 'utf8'))
            diagnostics.steps[1].status = 'OK'
            diagnostics.steps[1].foundAt = filePath
            diagnostics.steps[1].clientEmail = credentials.client_email
            diagnostics.steps[1].projectId = credentials.project_id
            break
          }
        } catch (e) {
          // Continue to next path
        }
      }

      if (!credentials) {
        diagnostics.steps[1].status = 'FAIL'
        diagnostics.steps[1].error = 'Service account file not found'
        diagnostics.steps[1].searchedPaths = possiblePaths
        return NextResponse.json(diagnostics, { status: 500 })
      }
    } catch (error) {
      diagnostics.steps[1].status = 'FAIL'
      diagnostics.steps[1].error = error instanceof Error ? error.message : 'Unknown error'
      return NextResponse.json(diagnostics, { status: 500 })
    }

    // Step 3: Initialize auth with YouTube scopes
    diagnostics.steps.push({ step: 3, name: 'Initialize Google Auth with YouTube scopes' })
    let googleAuth: any

    try {
      googleAuth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/youtube',
          'https://www.googleapis.com/auth/youtube.force-ssl',
          'https://www.googleapis.com/auth/youtube.readonly',
        ],
      })

      diagnostics.steps[2].status = 'OK'
      diagnostics.steps[2].scopes = [
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtube.force-ssl',
        'https://www.googleapis.com/auth/youtube.readonly',
      ]
    } catch (error) {
      diagnostics.steps[2].status = 'FAIL'
      diagnostics.steps[2].error = error instanceof Error ? error.message : 'Unknown error'
      return NextResponse.json(diagnostics, { status: 500 })
    }

    // Step 4: Test auth client
    diagnostics.steps.push({ step: 4, name: 'Get auth client' })
    let authClient: any

    try {
      authClient = await googleAuth.getClient()
      diagnostics.steps[3].status = 'OK'
      diagnostics.steps[3].email = (authClient as any).email
    } catch (error) {
      diagnostics.steps[3].status = 'FAIL'
      diagnostics.steps[3].error = error instanceof Error ? error.message : 'Unknown error'
      return NextResponse.json(diagnostics, { status: 500 })
    }

    // Step 5: Initialize YouTube API
    diagnostics.steps.push({ step: 5, name: 'Initialize YouTube API client' })
    let youtube: any

    try {
      youtube = google.youtube({ version: 'v3', auth: googleAuth })
      diagnostics.steps[4].status = 'OK'
    } catch (error) {
      diagnostics.steps[4].status = 'FAIL'
      diagnostics.steps[4].error = error instanceof Error ? error.message : 'Unknown error'
      return NextResponse.json(diagnostics, { status: 500 })
    }

    // Step 6: Test simple API call - get channel info
    diagnostics.steps.push({ step: 6, name: 'Test YouTube API - Get own channel info (mine=true)' })

    try {
      const channelResponse = await youtube.channels.list({
        part: ['snippet', 'contentDetails'],
        mine: true,
      })

      diagnostics.steps[5].status = 'OK'
      diagnostics.steps[5].channelsFound = channelResponse.data.items?.length || 0
      diagnostics.steps[5].channels = channelResponse.data.items?.map((ch: any) => ({
        id: ch.id,
        title: ch.snippet?.title,
        customUrl: ch.snippet?.customUrl,
      }))
    } catch (error: any) {
      diagnostics.steps[5].status = 'FAIL'
      diagnostics.steps[5].error = error.message
      diagnostics.steps[5].code = error.code
      diagnostics.steps[5].errors = error.errors
      // Continue to next test
    }

    // Step 7: Test with specific channel ID
    const channelId = 'UCyJamaI5mQImCF8hWE7Yp-w'
    diagnostics.steps.push({ step: 7, name: `Test YouTube API - Get specific channel (${channelId})` })

    try {
      const channelResponse = await youtube.channels.list({
        part: ['snippet', 'contentDetails', 'brandingSettings'],
        id: [channelId],
      })

      diagnostics.steps[6].status = 'OK'
      diagnostics.steps[6].channelFound = channelResponse.data.items?.length > 0
      if (channelResponse.data.items?.length > 0) {
        const channel = channelResponse.data.items[0]
        diagnostics.steps[6].channel = {
          id: channel.id,
          title: channel.snippet?.title,
          customUrl: channel.snippet?.customUrl,
          description: channel.snippet?.description?.substring(0, 100),
        }
      }
    } catch (error: any) {
      diagnostics.steps[6].status = 'FAIL'
      diagnostics.steps[6].error = error.message
      diagnostics.steps[6].code = error.code
      diagnostics.steps[6].errors = error.errors
    }

    // Step 8: Test liveBroadcasts.list with mine=true
    diagnostics.steps.push({ step: 8, name: 'Test liveBroadcasts.list with mine=true' })

    try {
      const broadcastResponse = await youtube.liveBroadcasts.list({
        part: ['snippet', 'status'],
        mine: true,
        maxResults: 5,
      })

      diagnostics.steps[7].status = 'OK'
      diagnostics.steps[7].broadcastsFound = broadcastResponse.data.items?.length || 0
      diagnostics.steps[7].broadcasts = broadcastResponse.data.items?.map((b: any) => ({
        id: b.id,
        title: b.snippet?.title,
        scheduledStartTime: b.snippet?.scheduledStartTime,
        status: b.status?.lifeCycleStatus,
      }))
    } catch (error: any) {
      diagnostics.steps[7].status = 'FAIL'
      diagnostics.steps[7].error = error.message
      diagnostics.steps[7].code = error.code
      diagnostics.steps[7].errors = error.errors
      diagnostics.steps[7].details = {
        message: error.message,
        response: error.response?.data,
      }
    }

    // Step 9: Test liveBroadcasts.list with broadcastStatus filter
    diagnostics.steps.push({ step: 9, name: 'Test liveBroadcasts.list with broadcastStatus=all' })

    try {
      const broadcastResponse = await youtube.liveBroadcasts.list({
        part: ['snippet', 'status'],
        broadcastStatus: 'all',
        maxResults: 5,
      })

      diagnostics.steps[8].status = 'OK'
      diagnostics.steps[8].broadcastsFound = broadcastResponse.data.items?.length || 0
    } catch (error: any) {
      diagnostics.steps[8].status = 'FAIL'
      diagnostics.steps[8].error = error.message
      diagnostics.steps[8].code = error.code
      diagnostics.steps[8].errors = error.errors
    }

    // Summary
    const failedSteps = diagnostics.steps.filter((s: any) => s.status === 'FAIL')
    diagnostics.summary = {
      totalSteps: diagnostics.steps.length,
      passed: diagnostics.steps.filter((s: any) => s.status === 'OK').length,
      failed: failedSteps.length,
      firstFailure: failedSteps.length > 0 ? failedSteps[0] : null,
    }

    return NextResponse.json(diagnostics, { status: 200 })

  } catch (error) {
    diagnostics.error = error instanceof Error ? error.message : 'Unknown error'
    diagnostics.stack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(diagnostics, { status: 500 })
  }
}
