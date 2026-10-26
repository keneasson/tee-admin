import type { ReactNode } from 'react'
import { requirePageAccess } from '@/utils/admin-page-guard'

// Server-side role gate for every page in this group: admin or owner, plus
// Recording Brothers and Reps (events / news / meetings / community; their
// APIs scope them to their own ecclesia). See utils/admin-page-guard.ts.
export const dynamic = 'force-dynamic'

export default async function RepPlusLayout({ children }: { children: ReactNode }) {
  await requirePageAccess('rep-plus')
  return children
}
