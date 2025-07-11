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
 * Load sheet configuration from Google service account file or environment variables
 */
function loadSheetConfig(): Record<string, string> {
  try {
    // Try to load from config file (development)
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
    console.warn('⚠️ Could not load sheet configuration from file (this is normal in production):', error.message)
    
    // Fallback: Load from environment variables (production)
    const sheetIdMap: Record<string, string> = {}
    
    // Environment variable mapping for production
    const envMapping = {
      'GOOGLE_SHEET_MEMORIAL': 'memorial',
      'GOOGLE_SHEET_BIBLE_CLASS': 'bibleClass', 
      'GOOGLE_SHEET_SUNDAY_SCHOOL': 'sundaySchool',
      'GOOGLE_SHEET_DIRECTORY': 'directory',
      'GOOGLE_SHEET_CYC': 'cyc',
    }
    
    Object.entries(envMapping).forEach(([envVar, type]) => {
      const sheetId = process.env[envVar]
      if (sheetId) {
        sheetIdMap[sheetId] = type
        console.log(`📋 Loaded ${type} sheet ID from environment variable ${envVar}`)
      }
    })
    
    if (Object.keys(sheetIdMap).length === 0) {
      console.warn('⚠️ No sheet configuration found in file or environment variables')
    }
    
    return sheetIdMap
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
    // Try to load from config file first
    const serviceConfig = require('../tee-services-db47a9e534d3.json')
    const sheetIds = serviceConfig.sheet_ids
    
    const config = sheetIds[sheetType]
    return config?.key || null
  } catch (error) {
    // Fallback to environment variables (production)
    const envMapping: Record<string, string> = {
      'memorial': process.env.GOOGLE_SHEET_MEMORIAL || '',
      'bibleClass': process.env.GOOGLE_SHEET_BIBLE_CLASS || '',
      'sundaySchool': process.env.GOOGLE_SHEET_SUNDAY_SCHOOL || '',
      'directory': process.env.GOOGLE_SHEET_DIRECTORY || '',
      'cyc': process.env.GOOGLE_SHEET_CYC || '',
    }
    
    return envMapping[sheetType] || null
  }
}

/**
 * Get all configured Google Sheet IDs and their types
 */
export function getAllSheetMappings(): Array<{id: string, type: string, name: string}> {
  try {
    // Try to load from config file first (development)
    const serviceConfig = require('../tee-services-db47a9e534d3.json')
    const sheetIds = serviceConfig.sheet_ids
    
    return Object.entries(sheetIds).map(([type, config]: [string, any]) => ({
      id: config.key || 'not-configured',
      type,
      name: config.name || type,
    }))
  } catch (error) {
    console.warn('⚠️ Could not load sheet configuration from file (this is normal in production):', error.message)
    
    // Fallback: Load from environment variables (production)
    const envMappings = [
      { 
        id: process.env.GOOGLE_SHEET_MEMORIAL || 'not-configured',
        type: 'memorial',
        name: 'Memorial Service Schedule'
      },
      { 
        id: process.env.GOOGLE_SHEET_BIBLE_CLASS || 'not-configured',
        type: 'bibleClass',
        name: 'Bible Class Schedule'
      },
      { 
        id: process.env.GOOGLE_SHEET_SUNDAY_SCHOOL || 'not-configured',
        type: 'sundaySchool',
        name: 'Sunday School Schedule'
      },
      { 
        id: process.env.GOOGLE_SHEET_DIRECTORY || 'not-configured',
        type: 'directory',
        name: 'Directory Data'
      },
      { 
        id: process.env.GOOGLE_SHEET_CYC || 'not-configured',
        type: 'cyc',
        name: 'CYC Schedule'
      },
    ]
    
    // Filter out any entries that don't have valid sheet IDs
    const validMappings = envMappings.filter(mapping => mapping.id !== 'not-configured')
    
    if (validMappings.length === 0) {
      console.warn('⚠️ No valid sheet configuration found in environment variables')
    } else {
      console.log(`📋 Loaded ${validMappings.length} sheet mappings from environment variables`)
    }
    
    return validMappings
  }
}