import Head from 'next/head'
import {SchedulesScreen} from "app/features/schedules/schedules-screen";

export default function Page() {
  return (
    <>
      <Head>
        <title>TEE Schedules</title>
      </Head>
      <SchedulesScreen/>
    </>
  )
}
