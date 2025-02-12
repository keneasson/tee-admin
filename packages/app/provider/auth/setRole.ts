import Constants from 'expo-constants'

const API_PATH =
  process.env.NEXT_PUBLIC_API_PATH || Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_PATH

async function setRole({ email }: { email: string }) {
  const url = `${API_PATH}api/security/${email}`
  const rawResponse = await fetch(url, { next: { revalidate: 3600 } })
  console.log('setRole', rawResponse)
}

export { setRole }
