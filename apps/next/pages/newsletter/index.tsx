import Head from 'next/head'
import { NewsletterScreen } from '@my/app/features/newsletter/newsletter-screen'

export default function Page({}) {
  return (
    <>
      <Head>
        <title>TEE Newsletter</title>
      </Head>
      <NewsletterScreen />
    </>
  )
}
