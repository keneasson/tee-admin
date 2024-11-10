import { Stack } from 'expo-router'
import { NewsletterScreen } from '@my/app/features/newsletter/newsletter-screen'

export default function Screen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Newsletter',
        }}
      />
      <NewsletterScreen />
    </>
  )
}
