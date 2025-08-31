import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check admin permissions
    const userRole = (session.user as any).role || 'guest'
    if (!['admin', 'owner'].includes(userRole)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    console.log('🎭 Running Playwright automation for Google Sheets manipulation')

    // Run the Playwright test
    try {
      const { stdout, stderr } = await execAsync(
        'npx playwright test apps/next/tests/automation/google-sheets-sync.spec.ts --headed',
        { 
          cwd: path.join(process.cwd()),
          timeout: 180000 // 3 minutes
        }
      )

      console.log('Playwright output:', stdout)
      if (stderr) console.error('Playwright errors:', stderr)

      // Check for snapshots
      const snapshotDir = path.join(process.cwd(), 'snapshots/sheets')
      const snapshots = fs.existsSync(snapshotDir) 
        ? fs.readdirSync(snapshotDir).filter(f => f.endsWith('.json'))
        : []

      // Get the latest verification result if available
      const verificationFiles = snapshots.filter(f => f.startsWith('verification-'))
      let latestVerification = null
      
      if (verificationFiles.length > 0) {
        const latestFile = verificationFiles.sort().pop()
        const verificationPath = path.join(snapshotDir, latestFile!)
        latestVerification = JSON.parse(fs.readFileSync(verificationPath, 'utf8'))
      }

      return NextResponse.json({
        success: true,
        message: 'Playwright automation completed successfully',
        snapshots: snapshots.length,
        verification: latestVerification,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      console.error('Playwright execution failed:', error)
      return NextResponse.json({
        success: false,
        message: 'Playwright automation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('❌ Failed to run Playwright test:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to run automation',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check last automation results
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const snapshotDir = path.join(process.cwd(), 'snapshots/sheets')
    
    if (!fs.existsSync(snapshotDir)) {
      return NextResponse.json({
        message: 'No automation runs yet',
        snapshots: []
      })
    }

    const files = fs.readdirSync(snapshotDir)
    const snapshots = files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const filePath = path.join(snapshotDir, f)
        const stats = fs.statSync(filePath)
        return {
          name: f,
          size: stats.size,
          modified: stats.mtime,
          type: f.startsWith('before-') ? 'before' :
                f.startsWith('after-') ? 'after' :
                f.startsWith('verification-') ? 'verification' : 'other'
        }
      })
      .sort((a, b) => b.modified.getTime() - a.modified.getTime())

    return NextResponse.json({
      snapshots,
      count: snapshots.length,
      lastRun: snapshots[0]?.modified || null
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get automation status' },
      { status: 500 }
    )
  }
}