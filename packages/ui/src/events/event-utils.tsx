/**
 * Shared utility functions for event components
 */

/**
 * Generate URL stub from title and date
 * Format: /events/[title-slug]-[YYYY-MM]
 */
export function generateEventStub(title: string, date?: Date | string): string {
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 12)
    .replace(/-+$/, '') // Remove trailing dashes
  
  const dateStr = date 
    ? new Date(date).toISOString().slice(0, 7) 
    : new Date().toISOString().slice(0, 7)
  
  return `${titleSlug}-${dateStr}`
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string | undefined): string {
  if (!date) return 'Date TBD'
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { 
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Format date range
 */
export function formatDateRange(startDate?: Date | string, endDate?: Date | string): string {
  if (!startDate) return 'Dates TBD'
  
  const start = formatDate(startDate)
  if (!endDate || startDate === endDate) return start
  
  const end = formatDate(endDate)
  return `${start} to ${end}`
}

/**
 * Format time for display
 */
export function formatTime(time?: string): string {
  if (!time) return ''
  // Assuming time is in HH:MM format
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${minutes} ${ampm}`
}

/**
 * Format time range
 */
export function formatTimeRange(startTime?: string, endTime?: string): string {
  if (!startTime) return ''
  const start = formatTime(startTime)
  if (!endTime) return start
  const end = formatTime(endTime)
  return `${start} to ${end}`
}

/**
 * Get event type display name
 */
export function getEventTypeDisplayName(type?: string): string {
  if (!type) return 'Event'
  
  const typeMap: Record<string, string> = {
    'study-weekend': 'Study Weekend',
    'funeral': 'Funeral',
    'wedding': 'Wedding',
    'baptism': 'Baptism',
    'general': 'General Event',
    'recurring': 'Recurring Event'
  }
  
  return typeMap[type] || type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

/**
 * Get event type color
 */
export function getEventTypeColor(type?: string): string {
  const colorMap: Record<string, string> = {
    'study-weekend': '$blue10',
    'funeral': '$gray10',
    'wedding': '$pink10',
    'baptism': '$green10',
    'general': '$purple10',
    'recurring': '$orange10'
  }
  
  return colorMap[type || ''] || '$blue10'
}

/**
 * Format location for display
 */
export function formatLocation(location?: any): string {
  if (!location) return ''
  
  // If it's already a string, return it
  if (typeof location === 'string') return location
  
  // If it's an object, format it
  if (typeof location === 'object') {
    const parts: string[] = []
    
    if (location.name) parts.push(location.name)
    if (location.city) parts.push(location.city)
    if (location.province) parts.push(location.province)
    
    return parts.join(', ')
  }
  
  return String(location)
}

/**
 * Format address for display
 */
export function formatAddress(address?: any): string {
  if (!address) return ''
  
  // If it's already a string, return it
  if (typeof address === 'string') return address
  
  // If it's an object, format it
  if (typeof address === 'object') {
    const parts: string[] = []
    
    if (address.address) parts.push(address.address)
    if (address.city) parts.push(address.city)
    if (address.province) parts.push(address.province)
    if (address.postalCode) parts.push(address.postalCode)
    
    return parts.join(', ')
  }
  
  return String(address)
}