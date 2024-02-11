import Head from 'next/head'
import { Events } from 'app/features/events'

export default function Page() {
  return (
    <>
      <Head>
        <title>Toronto East Christadelphians - Events</title>
      </Head>
      <Events eventId={undefined} />
    </>
  )
}
