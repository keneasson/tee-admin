import { revalidateTag } from 'next/cache'

/**
 * Cache tags for different data types to enable selective invalidation
 */
export const CACHE_TAGS = {
  // Schedule data tags
  SCHEDULES_ALL: 'schedules:all',
  SCHEDULES_MEMORIAL: 'schedules:memorial',
  SCHEDULES_BIBLE_CLASS: 'schedules:bibleClass',
  SCHEDULES_SUNDAY_SCHOOL: 'schedules:sundaySchool',
  SCHEDULES_CYC: 'schedules:cyc',
  
  // API endpoint tags
  UPCOMING_PROGRAM: 'api:upcoming-program',
  NEWSLETTER: 'api:newsletter',
  
  // Directory data
  DIRECTORY: 'directory:all',
  
  // Combined tags for bulk invalidation
  ALL_SCHEDULE_DATA: 'data:schedules',
  ALL_API_RESPONSES: 'api:all',
} as const

/**
 * Get cache tags for a specific sheet type
 */
export function getScheduleCacheTags(sheetType: string): string[] {
  const tags = [CACHE_TAGS.SCHEDULES_ALL, CACHE_TAGS.ALL_SCHEDULE_DATA]
  
  switch (sheetType.toLowerCase()) {
    case 'memorial':
      tags.push(CACHE_TAGS.SCHEDULES_MEMORIAL)
      break
    case 'bibleclass':
      tags.push(CACHE_TAGS.SCHEDULES_BIBLE_CLASS)
      break
    case 'sundayschool':
      tags.push(CACHE_TAGS.SCHEDULES_SUNDAY_SCHOOL)
      break
    case 'cyc':
      tags.push(CACHE_TAGS.SCHEDULES_CYC)
      break
  }
  
  // APIs that depend on schedule data
  tags.push(CACHE_TAGS.UPCOMING_PROGRAM, CACHE_TAGS.NEWSLETTER, CACHE_TAGS.ALL_API_RESPONSES)
  
  return tags
}

/**
 * Get cache tags for directory data
 */
export function getDirectoryCacheTags(): string[] {
  return [CACHE_TAGS.DIRECTORY, CACHE_TAGS.ALL_API_RESPONSES]
}

/**
 * Invalidate cache for specific sheet type updates
 */
export async function invalidateScheduleCache(sheetType: string): Promise<void> {
  const tags = getScheduleCacheTags(sheetType)
  
  console.log(`🗄️ Invalidating cache tags for ${sheetType}:`, tags)
  
  // Invalidate each tag
  for (const tag of tags) {
    try {
      revalidateTag(tag)
      console.log(`✅ Invalidated cache tag: ${tag}`)
    } catch (error) {
      console.error(`❌ Failed to invalidate cache tag ${tag}:`, error)
    }
  }
}

/**
 * Invalidate cache for directory updates
 */
export async function invalidateDirectoryCache(): Promise<void> {
  const tags = getDirectoryCacheTags()
  
  console.log('🗄️ Invalidating directory cache tags:', tags)
  
  for (const tag of tags) {
    try {
      revalidateTag(tag)
      console.log(`✅ Invalidated cache tag: ${tag}`)
    } catch (error) {
      console.error(`❌ Failed to invalidate cache tag ${tag}:`, error)
    }
  }
}

/**
 * Invalidate all cached data (nuclear option)
 */
export async function invalidateAllCache(): Promise<void> {
  const allTags = Object.values(CACHE_TAGS)
  
  console.log('🗄️ Invalidating ALL cache tags:', allTags)
  
  for (const tag of allTags) {
    try {
      revalidateTag(tag)
      console.log(`✅ Invalidated cache tag: ${tag}`)
    } catch (error) {
      console.error(`❌ Failed to invalidate cache tag ${tag}:`, error)
    }
  }
}

/**
 * Load sheet configuration from Google service account file
 */
function loadSheetConfig(): Record<string, string> {
  try {
    // Load sheet IDs from the secure config file
    const serviceConfig = require('../tee-services-db47a9e534d3.json')
    const sheetIds = serviceConfig.sheet_ids
    
    const sheetIdMap: Record<string, string> = {}
    
    // Build mapping from config file
    Object.entries(sheetIds).forEach(([type, config]: [string, any]) => {
      if (config.key) {
        sheetIdMap[config.key] = type
      }
    })
    
    return sheetIdMap
  } catch (error) {
    console.error('❌ Failed to load sheet configuration:', error)
    // Return empty map if config file not found (for development/testing)
    return {}
  }
}

// Cache the sheet config on first load
let sheetIdMapCache: Record<string, string> | null = null

/**
 * Determine sheet type from Google Sheets ID
 */
export function getSheetTypeFromId(sheetId: string): string {
  // Load config on first use
  if (!sheetIdMapCache) {
    sheetIdMapCache = loadSheetConfig()
  }
  
  const sheetType = sheetIdMapCache[sheetId]
  
  if (!sheetType) {
    console.warn(`⚠️ Unknown sheet ID: ${sheetId}`)
    return 'unknown'
  }
  
  console.log(`📋 Mapped sheet ID ${sheetId} to type: ${sheetType}`)
  return sheetType
}

/**
 * Get Google Sheet ID from sheet type (reverse mapping)
 */
export function getSheetIdFromType(sheetType: string): string | null {
  try {
    const serviceConfig = require('../tee-services-db47a9e534d3.json')
    const sheetIds = serviceConfig.sheet_ids
    
    const config = sheetIds[sheetType]
    return config?.key || null
  } catch (error) {
    console.error('❌ Failed to load sheet configuration for reverse mapping:', error)
    return null
  }
}

/**
 * Get all configured Google Sheet IDs and their types
 */
export function getAllSheetMappings(): Array<{id: string, type: string, name: string}> {
  try {
    const serviceConfig = require('../tee-services-db47a9e534d3.json')
    const sheetIds = serviceConfig.sheet_ids
    
    return Object.entries(sheetIds).map(([type, config]: [string, any]) => ({
      id: config.key || 'not-configured',
      type,
      name: config.name || type,
    }))
  } catch (error) {
    console.error('❌ Failed to load sheet configuration for listings:', error)
    return []
  }
}