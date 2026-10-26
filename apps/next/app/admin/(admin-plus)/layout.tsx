import type { ReactNode } from 'react'
import { requirePageAccess } from '@/utils/admin-page-guard'

// Server-side role gate for every page in this group: admin or owner.
// See utils/admin-page-guard.ts.
export const dynamic = 'force-dynamic'

export default async function AdminPlusLayout({ children }: { children: ReactNode }) {
  await requirePageAccess('admin-plus')
  return children
}
