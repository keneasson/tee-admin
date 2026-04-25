import React from 'react'
import { YStack, XStack, Text, Spinner } from 'tamagui'
import { Button } from '../Button'
import { ResponsiveDataTable } from '../data-table/responsive-data-table'
import { brandColors } from '../branding/brand-colors'
import type { ColumnDef } from '@tanstack/react-table'
import type { GuestUser } from './types'

interface GuestListProps {
  guests: GuestUser[]
  loading: boolean
  onViewGuest: (id: string) => void
  onPromoteGuest: (email: string, name: string) => void
  /** "Make Member" for admin/owner, "Accept" for recorder */
  actionLabel: string
  promotingEmail?: string | null
}

export function GuestList({
  guests,
  loading,
  onViewGuest,
  onPromoteGuest,
  actionLabel,
  promotingEmail,
}: GuestListProps) {
  const columns: ColumnDef<GuestUser>[] = React.useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        size: 200,
        cell: ({ row }) => (
          <Text
            color={brandColors.light.primary}
            fontWeight="600"
            cursor="pointer"
            onPress={() => onViewGuest(row.original.id)}
            hoverStyle={{ textDecorationLine: 'underline' } as any}
          >
            {row.original.name}
          </Text>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        size: 250,
      },
      {
        accessorKey: 'ecclesia',
        header: 'Ecclesia',
        size: 180,
        cell: ({ getValue }) => getValue() || '—',
      },
      {
        accessorKey: 'createdAt',
        header: 'Joined',
        size: 140,
        cell: ({ getValue }) => {
          const val = getValue() as string
          if (!val) return '—'
          try {
            return new Date(val).toLocaleDateString()
          } catch {
            return '—'
          }
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 200,
        enableSorting: false,
        cell: ({ row }) => {
          const isPromoting = promotingEmail === row.original.email
          return (
            <XStack gap="$2" alignItems="center">
              <Button
                size="$2"
                variant="outlined"
                borderWidth={1}
                borderColor="$borderColor"
                onPress={() => onViewGuest(row.original.id)}
              >
                View
              </Button>
              <Button
                size="$2"
                backgroundColor={brandColors.light.success}
                disabled={isPromoting}
                icon={isPromoting ? <Spinner size="small" width={14} height={14} /> : undefined}
                onPress={() => onPromoteGuest(row.original.email, row.original.name)}
              >
                <Text color="white" fontSize="$2">
                  {isPromoting ? 'Promoting...' : actionLabel}
                </Text>
              </Button>
            </XStack>
          )
        },
      },
    ],
    [onViewGuest, onPromoteGuest, actionLabel, promotingEmail]
  )

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$8">
        <Spinner size="small" width={20} height={20} />
        <Text marginTop="$4" color="$gray11">Loading guest users...</Text>
      </YStack>
    )
  }

  if (guests.length === 0) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$8">
        <Text color="$gray11" fontSize="$5">No guest users</Text>
        <Text color="$gray11" fontSize="$3" marginTop="$2">
          Guest users who sign up will appear here for review.
        </Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1}>
      <ResponsiveDataTable
        data={guests}
        columns={columns}
        searchPlaceholder="Search guests..."
        pageSize={15}
      />
    </YStack>
  )
}
