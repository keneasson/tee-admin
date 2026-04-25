import Constants from 'expo-constants'

const API_PATH =
  process.env.NEXT_PUBLIC_API_PATH || Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_PATH

export const fetchUpcoming = async ({ key, bypassCache }: { key?: string; bypassCache?: boolean }) => {
  const cacheBuster = bypassCache ? `?_t=${Date.now()}` : ''
  const url = `${API_PATH}api/upcoming-program${key ? `/${key}` : ''}${cacheBuster}`
  const rawSchedule = await fetch(url, {
    cache: 'no-store' // Let the server handle caching
  })
  return await rawSchedule.json()
}
