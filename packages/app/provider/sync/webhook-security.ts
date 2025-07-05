import { createHmac } from 'crypto'

// Rate limiting storage (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; lastReset: number }>()

export class WebhookSecurity {
  private static readonly WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'dev-webhook-secret-change-in-production'
  private static readonly RATE_LIMIT_WINDOW = 60000 // 1 minute
  private static readonly RATE_LIMIT_MAX_REQUESTS = 20 // Max 20 requests per minute per sheet

  /**
   * Validate webhook signature using HMAC
   */
  static validateSignature(payload: string, signature: string | null): boolean {
    if (!signature) {
      console.warn('⚠️ No signature provided for webhook validation')
      return false
    }

    try {
      // Remove 'sha256=' prefix if present
      const providedSignature = signature.startsWith('sha256=') 
        ? signature.slice(7) 
        : signature

      // Calculate expected signature
      const expectedSignature = createHmac('sha256', this.WEBHOOK_SECRET)
        .update(payload, 'utf8')
        .digest('hex')

      // Use timing-safe comparison
      return this.timingSafeEqual(providedSignature, expectedSignature)
    } catch (error) {
      console.error('❌ Error validating webhook signature:', error)
      return false
    }
  }

  /**
   * Rate limiting by sheet ID
   */
  static rateLimitBySheet(sheetId: string): boolean {
    const now = Date.now()
    const key = `sheet:${sheetId}`
    
    // Get or create rate limit record
    let record = rateLimitStore.get(key)
    
    if (!record) {
      record = { count: 0, lastReset: now }
      rateLimitStore.set(key, record)
    }
    
    // Reset counter if window has passed
    if (now - record.lastReset > this.RATE_LIMIT_WINDOW) {
      record.count = 0
      record.lastReset = now
    }
    
    // Check if limit exceeded
    if (record.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      console.warn(`⚠️ Rate limit exceeded for sheet ${sheetId}: ${record.count} requests in window`)
      return false
    }
    
    // Increment counter
    record.count++
    
    return true
  }

  /**
   * Validate sheet access permissions (future enhancement)
   */
  static validateSheetAccess(sheetId: string, userId?: string): boolean {
    // For now, allow all sheets
    // In the future, implement proper ACL checking
    
    const allowedSheets = [
      // Add your sheet IDs here
      process.env.SCHEDULE_SHEET_ID,
      process.env.DIRECTORY_SHEET_ID,
      process.env.EVENTS_SHEET_ID,
    ].filter(Boolean)

    // If no allowed sheets configured, allow all (development mode)
    if (allowedSheets.length === 0) {
      return true
    }

    return allowedSheets.includes(sheetId)
  }

  /**
   * Generate webhook signature for testing
   */
  static generateSignature(payload: string): string {
    return createHmac('sha256', this.WEBHOOK_SECRET)
      .update(payload, 'utf8')
      .digest('hex')
  }

  /**
   * Timing-safe string comparison
   */
  private static timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
  }

  /**
   * Clean up old rate limit records
   */
  static cleanupRateLimitStore(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    rateLimitStore.forEach((record, key) => {
      if (now - record.lastReset > this.RATE_LIMIT_WINDOW * 2) {
        expiredKeys.push(key)
      }
    })

    expiredKeys.forEach(key => {
      rateLimitStore.delete(key)
    })

    if (expiredKeys.length > 0) {
      console.log(`🧹 Cleaned up ${expiredKeys.length} expired rate limit records`)
    }
  }

  /**
   * Get rate limit status for monitoring
   */
  static getRateLimitStatus(): Array<{ sheetId: string; count: number; window: string }> {
    const status: Array<{ sheetId: string; count: number; window: string }> = []
    const now = Date.now()

    rateLimitStore.forEach((record, key) => {
      if (key.startsWith('sheet:')) {
        const sheetId = key.slice(6) // Remove 'sheet:' prefix
        const windowAge = now - record.lastReset
        
        status.push({
          sheetId,
          count: record.count,
          window: `${Math.floor(windowAge / 1000)}s ago`,
        })
      }
    })

    return status
  }
}

// Periodic cleanup of rate limit store
setInterval(() => {
  WebhookSecurity.cleanupRateLimitStore()
}, WebhookSecurity['RATE_LIMIT_WINDOW']) // Access private static property