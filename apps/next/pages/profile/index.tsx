import Head from 'next/head'
import { Profile } from '@my/app/features/profile'

export default function Page({}) {
  return (
    <>
      <Head>
        <title>Profile</title>
      </Head>
      <Profile />
    </>
  )
}
