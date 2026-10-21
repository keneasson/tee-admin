import React from 'react'
import { Card, Heading, Text, YStack } from 'tamagui'

/** One office the person holds (from /api/user/offices). */
export interface YourRoleEntry {
  title: string
  ecclesiaName: string
  /** Where the ecclesia's mail for this role goes. */
  email: string | null
  /** 'office' → the role's own address; 'holder' → the person's own primary email. */
  via: 'office' | 'holder' | 'none'
}

/**
 * "Your role" (R3): the offices a person holds, separate from their own
 * emails. An office address belongs to the role and goes to whoever holds it
 * next; it is never one of the person's own addresses.
 */
export const YourRole: React.FC<{ roles: YourRoleEntry[] }> = ({ roles }) => {
  if (roles.length === 0) return null
  return (
    <YStack gap="$3">
      <Heading size="$5">Your role</Heading>
      {roles.map((r) => (
        <Card key={`${r.ecclesiaName}|${r.title}`} padding="$3" backgroundColor="$backgroundHover">
          <YStack gap="$1">
            <Text fontSize="$4" fontWeight="600">{`${r.title}, ${r.ecclesiaName}`}</Text>
            <Text fontSize="$3" style={{ overflowWrap: 'anywhere' }}>
              {r.via === 'office'
                ? `${r.email} — goes with the role`
                : r.via === 'holder'
                  ? `No role address — ${r.ecclesiaName} mail comes to your own email (${r.email})`
                  : `No role address, and no email of yours on file: ${r.ecclesiaName} mail reaches nobody`}
            </Text>
            <Text fontSize="$2" color="$color11">
              {r.via === 'office'
                ? 'This address belongs to the role, not to you: it moves to the next person who holds it.'
                : 'Ecclesia mail goes to the role address when there is one, otherwise to the holder’s own email.'}
            </Text>
          </YStack>
        </Card>
      ))}
    </YStack>
  )
}
