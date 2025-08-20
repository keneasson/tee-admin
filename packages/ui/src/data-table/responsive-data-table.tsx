'use client'

import React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type ExpandedState,
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
  useMedia,
} from '@my/ui'
import { brandColors } from '../branding/brand-colors'

export interface ResponsiveDataTableProps<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]
  searchPlaceholder?: string
  pageSize?: number
  maxPageSize?: number
  renderSubComponent?: (props: { row: any }) => React.ReactElement
  getRowCanExpand?: (row: any) => boolean
}

export function ResponsiveDataTable<TData>({
  data,
  columns,
  searchPlaceholder = 'Search...',
  pageSize = 10,
  maxPageSize = 100,
  renderSubComponent,
  getRowCanExpand,
}: ResponsiveDataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [expanded, setExpanded] = React.useState<ExpandedState>({})
  
  const themeName = useThemeName()
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]
  
  const media = useMedia()
  // Use cards on small screens (phones), horizontal tables on large screens
  // media.xs = true when screen <= 660px (small screens)
  const isMobile = media.xs

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    globalFilterFn: 'includesString',
    getRowCanExpand: getRowCanExpand || (() => false),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      expanded,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
    columnResizeMode: 'onChange',
    defaultColumn: {
      minSize: 80,
      maxSize: 400,
    },
  })

  // Mobile Card Layout
  const renderMobileCard = (row: any) => (
    <View
      key={row.id}
      backgroundColor={colors.surface}
      borderWidth={1}
      borderColor={colors.border}
      borderRadius="$4"
      padding="$4"
      marginBottom="$2"
    >
      {row.getVisibleCells().map((cell: any, index: number) => {
        const header = cell.column.columnDef.header
        return (
          <XStack key={cell.id} justifyContent="space-between" marginBottom={index === row.getVisibleCells().length - 1 ? 0 : '$2'}>
            <Text fontWeight="600" color={colors.textSecondary} fontSize="$2" flex={0.4}>
              {typeof header === 'string' ? header : cell.column.id}
            </Text>
            <View flex={0.6} alignItems="flex-end">
              <Text color={colors.textPrimary} fontSize="$2" textAlign="right" numberOfLines={2}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </Text>
            </View>
          </XStack>
        )
      })}
    </View>
  )

  // Desktop Table Layout with Fixed Sizing
  const renderDesktopTable = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View width="100%" minWidth="100%">
        {/* Table Header */}
        <XStack
          backgroundColor={colors.backgroundSecondary}
          borderTopLeftRadius="$4"
          borderTopRightRadius="$4"
          borderWidth={1}
          borderColor={colors.border}
        >
          {table.getHeaderGroups().map((headerGroup) =>
            headerGroup.headers.map((header, index) => (
              <View
                key={header.id}
                width={getColumnWidth(index, headerGroup.headers.length)}
                minWidth={120}
                maxWidth={300}
                padding="$3"
                borderRightWidth={index === headerGroup.headers.length - 1 ? 0 : 1}
                borderRightColor={colors.border}
              >
                {header.isPlaceholder ? null : header.column.getCanSort() ? (
                  <Button
                    unstyled
                    justifyContent="flex-start"
                    padding="$2"
                    backgroundColor="transparent"
                    borderWidth={0}
                    borderRadius={0}
                    hoverStyle={{
                      backgroundColor: colors.backgroundTertiary,
                    }}
                    pressStyle={{
                      backgroundColor: colors.backgroundTertiary,
                    }}
                    onPress={header.column.getToggleSortingHandler()}
                  >
                    <Text fontWeight="600" color={colors.textPrimary} numberOfLines={1}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: ' 🔼',
                        desc: ' 🔽',
                      }[header.column.getIsSorted() as string] ?? null}
                    </Text>
                  </Button>
                ) : (
                  <View padding="$2">
                    <Text fontWeight="600" color={colors.textPrimary} numberOfLines={1}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </XStack>

        {/* Table Body */}
        <View
          borderLeftWidth={1}
          borderRightWidth={1}
          borderBottomWidth={1}
          borderColor={colors.border}
          borderBottomLeftRadius="$4"
          borderBottomRightRadius="$4"
        >
          {table.getRowModel().rows.map((row, rowIndex) => (
            <React.Fragment key={row.id}>
              {/* Main Row */}
              <XStack
                backgroundColor={rowIndex % 2 === 0 ? colors.surface : colors.backgroundSecondary}
                hoverStyle={{
                  backgroundColor: colors.backgroundTertiary,
                }}
              >
                {row.getVisibleCells().map((cell, cellIndex) => (
                  <View
                    key={cell.id}
                    width={getColumnWidth(cellIndex, row.getVisibleCells().length)}
                    minWidth={120}
                    maxWidth={300}
                    padding="$3"
                    borderRightWidth={cellIndex === row.getVisibleCells().length - 1 ? 0 : 1}
                    borderRightColor={colors.border}
                    justifyContent="center"
                  >
                    <XStack gap="$2" alignItems="center">
                      {/* Expand/Collapse button only on first cell if row can expand */}
                      {cellIndex === 0 && row.getCanExpand() && (
                        <Button
                          size="$1"
                          variant="outlined"
                          onPress={row.getToggleExpandedHandler()}
                          backgroundColor="transparent"
                          padding="$1"
                          minHeight="auto"
                          minWidth="auto"
                        >
                          <Text fontSize="$2" color={colors.textSecondary}>
                            {row.getIsExpanded() ? '▼' : '▶'}
                          </Text>
                        </Button>
                      )}
                      
                      <View maxWidth="100%" overflow="hidden" flex={1}>
                        <Text 
                          color={colors.textPrimary} 
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </Text>
                      </View>
                    </XStack>
                  </View>
                ))}
              </XStack>
              
              {/* Expanded Secondary Row */}
              {row.getIsExpanded() && renderSubComponent && (
                <XStack
                  backgroundColor={colors.backgroundSecondary}
                  borderTopWidth={1}
                  borderTopColor={colors.border + '40'}
                  padding="$3"
                >
                  <View width="100%">
                    {renderSubComponent({ row })}
                  </View>
                </XStack>
              )}
            </React.Fragment>
          ))}
        </View>
      </View>
    </ScrollView>
  )

  // Helper function to calculate column widths
  const getColumnWidth = (index: number, totalColumns: number) => {
    // Distribute width more evenly, with slight variations for different column types
    const baseWidth = 100 / totalColumns
    switch (index) {
      case 0: return `${baseWidth * 1.2}%` // First column slightly wider
      case totalColumns - 1: return `${baseWidth * 0.8}%` // Last column slightly narrower
      default: return `${baseWidth}%`
    }
  }

  return (
    <YStack flex={1} gap="$4">
      {/* Search and Column Visibility */}
      <XStack gap="$2" alignItems="center">
        <Input
          flex={1}
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChangeText={setGlobalFilter}
        />
        
        {/* Column Visibility - Temporarily disabled due to Tamagui animation issues */}
        {/* TODO: Re-implement with simpler approach once core table is stable */}
      </XStack>

      {/* Responsive Table Container */}
      {isMobile ? (
        <ScrollView>
          <YStack gap="$2">
            {table.getRowModel().rows.map(renderMobileCard)}
          </YStack>
        </ScrollView>
      ) : (
        renderDesktopTable()
      )}

      {/* Pagination Footer */}
      <XStack gap="$2" alignItems="center" justifyContent="space-between">
        <XStack gap="$2" alignItems="center" $sm={{ display: 'none' }}>
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