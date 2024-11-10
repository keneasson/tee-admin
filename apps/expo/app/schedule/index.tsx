import { Stack } from 'expo-router'
import { SchedulesScreen } from '@my/app/features/schedules/schedules-screen'

import keys from '../../../next/tee-services-db47a9e534d3.json'

export default function Screen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Schedules',
        }}
      />
      <SchedulesScreen googleSheets={keys.sheet_ids} />
    </>
  )
}
