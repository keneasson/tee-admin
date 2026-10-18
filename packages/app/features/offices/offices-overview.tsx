import React, { useCallback, useEffect, useState } from 'react'
import { YStack, XStack, Text, Card, Button, Spinner } from '@my/ui'

/**
 * Every ecclesia and its offices (R3): the Recording Brother office and any
 * Rep offices, each with its holder (a person reference) and its address (the
 * office's own inbox, or else the holder's). Read-only. Holders change through
 * nomination; assignments come from the owner's confirmed review page.
 */

interface OfficeRow {
  officeId: string
  kind: string
  title: string
  email?: string
  phone?: string
  emailVia?: 'office' | 'holder' | 'none'
  holderPersonId?: string
  holderName?: string
}

interface EcclesiaOfficesRow {
  ecclesiaId: string
  name: string
  city?: string
  province?: string
  country?: string
  hasRecordingBrotherOffice: boolean
  recordingBrother: { name?: string; email?: string; source: 'office' | 'legacy' } | null
  offices: OfficeRow[]
}

interface OfficesResponse {
  officesAssigned: boolean
  totals: { ecclesias: number; withRecordingBrotherOffice: number; offices: number }
  ecclesias: EcclesiaOfficesRow[]
}

const viaLabel = (via?: OfficeRow['emailVia']) =>
  via === 'office' ? 'office inbox' : via === 'holder' ? "holder's address" : 'no address'

function OfficeLine({ office }: { office: OfficeRow }) {
  return (
    <XStack gap="$2" flexWrap="wrap" alignItems="baseline">
      <Text fontSize="$3" fontWeight="600" minWidth={150}>
        {office.title}
      </Text>
      <Text fontSize="$3">{office.holderName || 'Vacant'}</Text>
      <Text fontSize="$3" color="$colorSecondary">
        {office.email ? `${office.email} (${viaLabel(office.emailVia)})` : viaLabel(office.emailVia)}
      </Text>
      {office.phone ? (
        <Text fontSize="$3" color="$colorSecondary">
          {office.phone}
        </Text>
      ) : null}
    </XStack>
  )
}

function EcclesiaCard({ row }: { row: EcclesiaOfficesRow }) {
  const place = [row.city, row.province, row.country].filter(Boolean).join(', ')
  return (
    <Card padding="$3" borderWidth={1} borderColor={row.hasRecordingBrotherOffice ? '$borderColor' : '$orange7'}>
      <YStack gap="$2">
        <XStack justifyContent="space-between" flexWrap="wrap" gap="$2">
          <Text fontSize="$4" fontWeight="700">
            {row.name}
          </Text>
          <Text fontSize="$2" color="$colorSecondary">
            {place} · id {row.ecclesiaId}
          </Text>
        </XStack>
        {row.offices.map((office) => (
          <OfficeLine key={office.officeId} office={office} />
        ))}
        {row.hasRecordingBrotherOffice ? null : (
          <YStack gap="$1">
            <Text fontSize="$3" color="$orange10">
              No Recording Brother office yet.
            </Text>
            {row.recordingBrother ? (
              <Text fontSize="$3" color="$colorSecondary">
                Until offices are assigned, sends and sign-in use the old copied contact:{' '}
                {[row.recordingBrother.name, row.recordingBrother.email].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </YStack>
        )}
      </YStack>
    </Card>
  )
}

export function OfficesOverview() {
  const [data, setData] = useState<OfficesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/offices', { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
      setData(body as OfficesResponse)
    } catch (e: any) {
      setError(e?.message || 'Failed to load offices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) {
    return (
      <XStack gap="$2" alignItems="center">
        <Spinner size="small" width={20} height={20} />
        <Text>Loading offices…</Text>
      </XStack>
    )
  }

  if (error) {
    return (
      <YStack gap="$2">
        <Text color="$red10">{error}</Text>
        <Button alignSelf="flex-start" onPress={load}>
          Retry
        </Button>
      </YStack>
    )
  }

  if (!data) return null

  return (
    <YStack gap="$3">
      <Text fontSize="$3">
        {data.totals.withRecordingBrotherOffice} of {data.totals.ecclesias} ecclesias have a Recording Brother office ·{' '}
        {data.totals.offices} offices ·{' '}
        {data.officesAssigned ? 'assignments applied' : 'assignments not applied yet (awaiting the review page)'}
      </Text>
      {data.ecclesias.map((row) => (
        <EcclesiaCard key={row.ecclesiaId} row={row} />
      ))}
    </YStack>
  )
}
