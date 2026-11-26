import { useState } from 'react'
import { YStack, XStack, Text, Card, Input, Separator, Spinner } from 'tamagui'
import { Button } from '../Button'
import { Archive, ArchiveRestore, Merge } from '@tamagui/lucide-icons'
import { brandColors } from '../branding/brand-colors'
import { closedLabel, isClosedEcclesia, type EcclesiaClosure } from '@my/app/utils/ecclesia-name'

export type ClosureChange =
  | { status: 'closed'; closedYear: number; closedNote: string | null }
  | { status: 'active' }

/**
 * Owner/admin "Danger Zone" of an ecclesia page.
 *
 * We never delete an ecclesia. One that stops meeting is CLOSED: it stays in
 * the directory, marked "Closed {year}", and is no longer offered anywhere it
 * would be chosen or sent to. A duplicate record is MERGED into the real one
 * (the only thing that ever removes a record).
 */
export function EcclesiaDangerZone({
  ecclesia,
  onSetClosed,
  onMerge,
}: {
  ecclesia: EcclesiaClosure & { name: string }
  onSetClosed?: (change: ClosureChange) => Promise<boolean>
  onMerge?: () => void
}) {
  const closed = isClosedEcclesia(ecclesia)
  const [confirming, setConfirming] = useState(false)
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = () => {
    setYear(String(new Date().getFullYear()))
    setNote('')
    setError(null)
    setConfirming(true)
  }

  const submit = async () => {
    if (!onSetClosed) return
    let change: ClosureChange
    if (closed) {
      change = { status: 'active' }
    } else {
      const y = Number(year)
      if (!Number.isInteger(y) || y < 1800 || y > new Date().getFullYear()) {
        setError(`Enter a year between 1800 and ${new Date().getFullYear()}.`)
        return
      }
      change = { status: 'closed', closedYear: y, closedNote: note.trim() || null }
    }
    setSaving(true)
    setError(null)
    try {
      const ok = await onSetClosed(change)
      if (ok) setConfirming(false)
      else setError('That did not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const red = brandColors.light.error
  const redButton = {
    backgroundColor: red,
    color: 'white',
    borderWidth: 2,
    borderColor: red,
    hoverStyle: { backgroundColor: red, borderColor: red, opacity: 0.9 },
    pressStyle: { backgroundColor: red, borderColor: red, opacity: 0.8 },
  } as const

  return (
    <Card padding="$4" borderWidth={1} borderColor="$red6" backgroundColor="$red2">
      <YStack gap="$3">
        <Text fontSize="$4" fontWeight="600" color="$red10">Danger Zone</Text>
        <Separator borderColor="$red6" />

        {onSetClosed ? (
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
              <YStack flex={1} gap="$1" minWidth={220}>
                <Text fontSize="$3" fontWeight="600">{closed ? 'Reopen this ecclesia' : 'Close this ecclesia'}</Text>
                <Text fontSize="$3" color="$textSecondary">
                  {closed
                    ? `${ecclesia.name} is marked ${closedLabel(ecclesia)}. Reopening offers it again for members, offices, invitations, lists and event sharing.`
                    : 'For an ecclesia that no longer meets. It stays in the directory and search, marked closed, and is no longer offered for new members, offices, invitations, mailing lists or event sharing.'}
                </Text>
              </YStack>
              {confirming ? null : (
                <Button icon={closed ? ArchiveRestore : Archive} {...redButton} onPress={start}>
                  {closed ? 'Reopen Ecclesia' : 'Close Ecclesia'}
                </Button>
              )}
            </XStack>

            {confirming ? (
              <YStack gap="$3" padding="$3" borderRadius="$3" borderWidth={1} borderColor="$red6" backgroundColor="$background">
                {closed ? (
                  <Text fontSize="$3">Reopen {ecclesia.name}? The closed year and note are cleared.</Text>
                ) : (
                  <>
                    <Text fontSize="$3">Close {ecclesia.name}?</Text>
                    <YStack gap="$1">
                      <Text fontSize="$3" fontWeight="600">Year closed</Text>
                      <Input
                        value={year}
                        onChangeText={(t) => setYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
                        keyboardType="number-pad"
                        maxWidth={160}
                        aria-label="Year closed"
                      />
                    </YStack>
                    <YStack gap="$1">
                      <Text fontSize="$3" fontWeight="600">Note (optional)</Text>
                      <Input
                        value={note}
                        onChangeText={setNote}
                        placeholder="e.g. Members have joined other ecclesias"
                        maxLength={280}
                        aria-label="Note"
                      />
                    </YStack>
                  </>
                )}
                {error ? <Text fontSize="$3" color="$red10">{error}</Text> : null}
                <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
                  <Button variant="outlined" borderWidth={2} borderColor="$textTertiary" onPress={() => setConfirming(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button
                    {...redButton}
                    icon={saving ? <Spinner size="small" width={16} height={16} /> : undefined}
                    onPress={submit}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : closed ? 'Reopen' : 'Close ecclesia'}
                  </Button>
                </XStack>
              </YStack>
            ) : null}
          </YStack>
        ) : null}

        {onMerge ? (
          <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
            <YStack flex={1} gap="$1" minWidth={220}>
              <Text fontSize="$3" fontWeight="600">Merge a duplicate record into another</Text>
              <Text fontSize="$3" color="$textSecondary">
                Moves this record&apos;s people, offices, posts, events and lists to the ecclesia you choose, then removes
                this duplicate. You see every change before anything is saved.
              </Text>
            </YStack>
            <Button
              icon={Merge}
              variant="outlined"
              borderWidth={2}
              borderColor={red}
              color={red}
              hoverStyle={{ borderColor: red, opacity: 0.9 }}
              onPress={onMerge}
            >
              Merge…
            </Button>
          </XStack>
        ) : null}
      </YStack>
    </Card>
  )
}
