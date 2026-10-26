import type { ReactNode } from 'react'
import { requirePageAccess } from '@/utils/admin-page-guard'

// Server-side role gate for every page in this group: owner only.
// See utils/admin-page-guard.ts.
export const dynamic = 'force-dynamic'

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  await requirePageAccess('owner')
  return children
}
