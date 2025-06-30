import { NextResponse } from 'next/server'
import { getAwsDbConfig } from '../../../../utils/email/sesClient'

export async function GET() {
  try {
    const config = getAwsDbConfig()
    
    return NextResponse.json({
      success: true,
      environment: process.env.NODE_ENV,
      aws: {
        region: config.region,
        hasCredentials: !!config.credentials,
        credentialsType: typeof config.credentials,
      },
      nextauth: {
        url: process.env.NEXTAUTH_URL,
        hasSecret: !!process.env.NEXT_PUBLIC_SECRET,
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}