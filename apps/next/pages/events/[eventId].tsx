import Head from 'next/head'
import { Events } from 'app/features/events'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function Page() {
  const router = useRouter()
  console.log('router', router)

  const [eventId, setEventId] = useState('')
  useEffect(() => {
    if (router.query.eventId) {
      console.log('effect router', router)
      setEventId(router.query.eventId as string)
    }
  }, [router.query])

  return (
    <>
      <Head>
        <title>Toronto East Christadelphians - Events</title>
      </Head>
      <Events eventId={eventId} />
    </>
  )
}
