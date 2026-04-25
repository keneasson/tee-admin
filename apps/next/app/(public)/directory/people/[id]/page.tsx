import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DirectoryPersonDetailPage({ params }: Props) {
  const { id } = await params
  redirect(`/people/${id}`)
}
