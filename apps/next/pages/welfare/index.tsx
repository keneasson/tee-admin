import Head from 'next/head'
import { Welfare } from 'app/features/welfare'

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
