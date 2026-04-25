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

  // Events data tags
  EVENTS_ALL: 'events:all',
  EVENTS_PUBLIC: 'events:public',

  // Combined tags for bulk invalidation
  ALL_SCHEDULE_DATA: 'data:schedules',
  ALL_API_RESPONSES: 'api:all',
} as const

/**
 * Get cache tags for a specific sheet type
 */
export function getScheduleCacheTags(sheetType: string): string[] {
  const tags: string[] = [CACHE_TAGS.SCHEDULES_ALL, CACHE_TAGS.ALL_SCHEDULE_DATA]
  
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
 * Invalidate cache for event updates
 */
export async function invalidateEventsCache(): Promise<void> {
  const tags = [
    CACHE_TAGS.EVENTS_ALL,
    CACHE_TAGS.EVENTS_PUBLIC,
    CACHE_TAGS.NEWSLETTER,
    CACHE_TAGS.ALL_API_RESPONSES
  ]

  console.log('🗄️ Invalidating events cache tags:', tags)

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

// No longer needed - using GoogleSheetsConfig service

/**
 * Determine sheet type from Google Sheets ID
 */
export function getSheetTypeFromId(sheetId: string): string {
  // Lazy import to avoid eagerly loading Google service account file
  const { googleSheetsConfig } = require('@my/app/config/google-sheets')
  const sheetType = googleSheetsConfig.getSheetType(sheetId)

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
  const { googleSheetsConfig } = require('@my/app/config/google-sheets')
  return googleSheetsConfig.getSheetId(sheetType)
}

/**
 * Get all configured Google Sheet IDs and their types
 */
export function getAllSheetMappings(): Array<{id: string, type: string, name: string}> {
  const { googleSheetsConfig } = require('@my/app/config/google-sheets')
  return googleSheetsConfig.getAllSheets()
}