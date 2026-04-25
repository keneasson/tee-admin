import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Christadelphian Directory',
}

export default function DirectoryLayout({ children }: { children: React.ReactNode }) {
  return children
}
