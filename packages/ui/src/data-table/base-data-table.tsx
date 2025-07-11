'use client'

import React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  View,
  Text,
  Button,
  Input,
  YStack,
  XStack,
  ScrollView,
  useThemeName,
} from '@my/ui'
import { brandColors } from '../branding/brand-colors'

export interface BaseDataTableProps<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]
  searchPlaceholder?: string
  pageSize?: number
  maxPageSize?: number
}

export function BaseDataTable<TData>({
  data,
  columns,
  searchPlaceholder = 'Search...',
  pageSize = 10,
  maxPageSize = 100,
}: BaseDataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = React.useState('')
  
  const themeName = useThemeName()
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
  })

  return (
    <YStack gap="$4" flex={1}>
      {/* Search Bar */}
      <XStack gap="$2" alignItems="center">
        <Input
          flex={1}
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChangeText={setGlobalFilter}
        />
      </XStack>

      {/* Table Container */}
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View
          borderWidth={1}
          borderColor={colors.border}
          borderRadius="$4"
          overflow="hidden"
          minWidth="100%"
        >
          {/* Table Header */}
          <View backgroundColor={colors.backgroundSecondary}>
            {table.getHeaderGroups().map((headerGroup) => (
              <XStack key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <View
                    key={header.id}
                    flex={1}
                    minWidth={150}
                    padding="$3"
                    borderRightWidth={1}
                    borderRightColor={colors.border}
                  >
                    {header.isPlaceholder ? null : (
                      <Button
                        unstyled
                        justifyContent="flex-start"
                        padding="$2"
                        borderRadius="$2"
                        backgroundColor="transparent"
                        hoverStyle={{
                          backgroundColor: colors.backgroundSecondary,
                        }}
                        pressStyle={{
                          backgroundColor: colors.backgroundTertiary,
                        }}
                        onPress={header.column.getToggleSortingHandler()}
                        disabled={!header.column.getCanSort()}
                      >
                        <Text fontWeight="600" color={colors.textPrimary}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: ' 🔼',
                            desc: ' 🔽',
                          }[header.column.getIsSorted() as string] ?? null}
                        </Text>
                      </Button>
                    )}
                  </View>
                ))}
              </XStack>
            ))}
          </View>

          {/* Table Body */}
          <View>
            {table.getRowModel().rows.map((row, index) => (
              <XStack
                key={row.id}
                backgroundColor={index % 2 === 0 ? colors.surface : colors.backgroundSecondary}
                hoverStyle={{
                  backgroundColor: colors.primaryHover,
                }}
                pressStyle={{
                  backgroundColor: colors.primaryPressed,
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <View
                    key={cell.id}
                    flex={1}
                    minWidth={150}
                    padding="$3"
                    borderRightWidth={1}
                    borderRightColor={colors.border}
                  >
                    <Text color={colors.textPrimary}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Text>
                  </View>
                ))}
              </XStack>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Pagination Footer */}
      <XStack gap="$2" alignItems="center" justifyContent="space-between">
        <XStack gap="$2" alignItems="center">
          <Text fontSize="$3" color={colors.textSecondary}>
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{' '}
            of {table.getFilteredRowModel().rows.length} entries
          </Text>
        </XStack>

        <XStack gap="$2" alignItems="center">
          <Button
            variant="outlined"
            size="$3"
            onPress={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          
          <Text fontSize="$3" color={colors.textPrimary}>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </Text>
          
          <Button
            variant="outlined"
            size="$3"
            onPress={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </XStack>
      </XStack>
    </YStack>
  )
}