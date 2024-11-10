import Head from 'next/head'
import { Welfare } from '@my/app/features/welfare'

export default function Page({}) {
  return (
    <>
      <Head>
        <title>TEE Newsletter</title>
      </Head>
      <Welfare />
    </>
  )
}
