import Head from 'next/head'
import { Events } from '@my/app/features/events'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function Page() {
  const router = useRouter()

  const [eventId, setEventId] = useState('')
  useEffect(() => {
    if (router.query.eventId) {
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
