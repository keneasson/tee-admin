import Head from 'next/head'
import { EmailTester } from '@my/app/features/email-tester'

export default function Page({}) {
  return (
    <>
      <Head>
        <title>TEE Email Tester</title>
      </Head>
      <EmailTester />
    </>
  )
}
