import { ApiSandbox } from '@/components/api-sandbox'
import { connection } from 'next/server'
import { getSoftdreamsDomain } from '@/lib/softdreams/config.server'

export default async function Page() {
  await connection()
  return <ApiSandbox domain={getSoftdreamsDomain()} />
}
