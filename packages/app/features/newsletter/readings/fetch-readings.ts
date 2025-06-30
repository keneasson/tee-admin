// Use dynamic import for expo-constants to avoid SSR issues
const getApiPath = () => {
  // For web environments, use NEXT_PUBLIC_API_PATH or default to '/'
  if (typeof window !== 'undefined' || process.env.NEXT_PUBLIC_API_PATH) {
    return process.env.NEXT_PUBLIC_API_PATH || '/'
  }
  
  // For mobile environments, try to get expo constants
  try {
    const Constants = require('expo-constants')
    return Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_PATH || '/'
  } catch {
    return '/'
  }
}

export const fetchReadings = async () => {
  const API_PATH = getApiPath()
  const url = `${API_PATH}api/json/range`
  try {
    const rawSchedule = await fetch(url, { next: { revalidate: 3600 } })
    if (!rawSchedule.ok) {
      throw new Error(`HTTP error! status: ${rawSchedule.status}`)
    }
    return await rawSchedule.json()
  } catch (error) {
    console.error('Failed to fetch readings:', error)
    return []
  }
}
