import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ name: string }>
}

export default async function EcclesiaDetailPage({ params }: Props) {
  const { name } = await params
  redirect(`/directory/ecclesias/${name}`)
}
