import { isWeb } from '@tamagui/constants'
import { NativeToast as Toast } from './NativeToast'

export const CustomToast = () => {
  // On web, always show the toast. Only hide on native Expo client.
  if (isWeb) {
    return <Toast />
  }
  
  // For native platforms, check if we're in Expo
  try {
    const Constants = require('expo-constants')
    const isExpo = Constants.executionEnvironment === Constants.ExecutionEnvironment?.StoreClient
    return isExpo ? null : <Toast />
  } catch {
    // If expo-constants is not available, assume we want the toast
    return <Toast />
  }
}
