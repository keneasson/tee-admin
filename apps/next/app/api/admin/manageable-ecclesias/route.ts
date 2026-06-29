import { NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { listSelectableEcclesias } from '@/utils/ecclesia-permissions'

/**
 * Ecclesias the signed-in user may author content for — powers the "operating
 * as" ecclesia picker on the content forms. OWNER gets every ecclesia; scoped
 * roles get their own + managed-region ecclesias. `home` is the natural default.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = (session.user as any).role || ROLES.GUEST
  const ecclesias = await listSelectableEcclesias(session.user.email, role)
  return NextResponse.json({
    ecclesias,
    home: (session.user as any).ecclesia ?? null,
  })
}
