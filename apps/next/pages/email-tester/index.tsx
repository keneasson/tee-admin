import Head from 'next/head'
import { EmailTester } from 'app/features/email-tester'

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
