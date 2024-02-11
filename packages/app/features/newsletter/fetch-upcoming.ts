import Constants from 'expo-constants'

const API_PATH =
  process.env.NEXT_PUBLIC_API_PATH || Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_PATH

export const fetchUpcoming = async () => {
  const url = `${API_PATH}api/upcoming-program`
  const rawSchedule = await fetch(url, { next: { revalidate: 3600 } })
  return await rawSchedule.json()
}
