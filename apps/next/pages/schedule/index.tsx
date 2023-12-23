import Head from 'next/head'
import {SchedulesScreen} from "app/features/schedules/schedules-screen";

import keys from '../../tee-services-db47a9e534d3.json'

export default function Page({}) {
   return (
        <>
            <Head>
                <title>TEE Schedules</title>
            </Head>
            <SchedulesScreen googleSheets={keys.sheet_ids}/>
        </>
    )
}
