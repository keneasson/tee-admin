'use client'

import { useEffect, useState } from 'react'
import { YStack, XStack, Text, Spinner, Card, Input, ScrollView, Button } from '@my/ui'
import { Dialog } from 'tamagui'
import { Merge, Search, Users, AlertTriangle } from '@tamagui/lucide-icons'
import { brandColors } from '@my/ui/src/branding/brand-colors'
import { isClosedEcclesia } from '@my/app/utils/ecclesia-name'
import type { EcclesiaListItem } from '@my/ui/src/directory/types'
import type { MergePlan } from '@/utils/ecclesia-merge'

/**
 * "Merge into another ecclesia" — the only way to fold a duplicate record into
 * the real one. Pick the ecclesia to keep, see EXACTLY what will move (a dry
 * run: nothing is saved), then confirm. The server re-checks everything on the
 * real run and refuses if anything now blocks it.
 */
export function MergeEcclesiaDialog({
  open,
  onOpenChange,
  sourceName,
  ecclesias,
  onMerged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The record that will be merged away (and deleted). */
  sourceName: string
  /** Candidates to keep; the source and closed ecclesias are not offered. */
  ecclesias: EcclesiaListItem[]
  onMerged: (targetName: string) => void
}) {
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<EcclesiaListItem | null>(null)
  const [plan, setPlan] = useState<MergePlan | null>(null)
  const [busy, setBusy] = useState<'preview' | 'merge' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSearch('')
      setTarget(null)
      setPlan(null)
      setError(null)
    }
  }, [open])

  const options = ecclesias.filter((e) => {
    if (e.name === sourceName) return false
    if (isClosedEcclesia(e)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return e.name.toLowerCase().includes(q) || !!e.city?.toLowerCase().includes(q)
  })

  const call = async (dryRun: boolean) => {
    if (!target) return null
    const res = await fetch('/api/admin/ecclesias/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: sourceName, target: target.name, dryRun }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.plan) setPlan(data.plan)
    if (!res.ok) throw new Error(data.error || 'The merge could not be completed')
    return data
  }

  const preview = async () => {
    setBusy('preview')
    setError(null)
    try {
      await call(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const merge = async () => {
    setBusy('merge')
    setError(null)
    try {
      await call(false)
      onOpenChange(false)
      onMerged(target!.name)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const blocked = !!plan && plan.blockers.length > 0

  return (
    <Dialog modal open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <Dialog.Portal>
        <Dialog.Overlay key="merge-overlay" animation="quick" opacity={0.5} enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
        <Dialog.Content
          key="merge-content"
          bordered
          elevate
          animation="quick"
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          gap="$3"
          padding="$4"
          width={560}
          maxWidth="95vw"
          maxHeight="85vh"
        >
          <Dialog.Title fontSize="$6" fontWeight="600">
            <XStack gap="$2" alignItems="center">
              <Merge size="$1" />
              <Text fontSize="$6" fontWeight="600">Merge &quot;{sourceName}&quot;</Text>
            </XStack>
          </Dialog.Title>
          <Dialog.Description fontSize="$3" color="$gray11">
            Choose the ecclesia to keep. Everything that points at &quot;{sourceName}&quot; moves to it, then
            &quot;{sourceName}&quot; is deleted.
          </Dialog.Description>

          {plan ? null : (
            <>
              <XStack gap="$2" alignItems="center">
                <Search size="$1" color="$gray11" />
                <Input flex={1} placeholder="Search ecclesias..." value={search} onChangeText={setSearch} size="$4" />
              </XStack>
              <ScrollView maxHeight={240}>
                <YStack gap="$2">
                  {options.map((e) => {
                    const selected = target?.name === e.name
                    return (
                      <Card
                        key={e.id}
                        padding="$3"
                        borderWidth={2}
                        borderColor={selected ? '$blue10' : '$borderColor'}
                        backgroundColor={selected ? '$blue2' : undefined}
                        pressStyle={{ backgroundColor: '$blue2' }}
                        hoverStyle={{ borderColor: '$blue8' }}
                        cursor="pointer"
                        onPress={() => setTarget(e)}
                      >
                        <XStack justifyContent="space-between" alignItems="center">
                          <YStack gap="$1">
                            <Text fontSize="$4" fontWeight="600">{e.name}</Text>
                            {e.city ? <Text fontSize="$3" color="$gray11">{e.city}</Text> : null}
                          </YStack>
                          {e.memberCount ? (
                            <XStack gap="$1" alignItems="center">
                              <Users size={14} color="$gray11" />
                              <Text fontSize="$3" color="$gray11">{e.memberCount}</Text>
                            </XStack>
                          ) : null}
                        </XStack>
                      </Card>
                    )
                  })}
                  {options.length === 0 ? (
                    <Text color="$gray11" textAlign="center" padding="$4">No matching ecclesias found</Text>
                  ) : null}
                </YStack>
              </ScrollView>
            </>
          )}

          {plan ? <MergePlanSummary plan={plan} /> : null}

          {error ? (
            <Card padding="$3" backgroundColor="$red2" borderWidth={1} borderColor="$red8">
              <Text fontSize="$3" color="$red11">{error}</Text>
            </Card>
          ) : null}

          <XStack gap="$3" justifyContent="flex-end" marginTop="$2" flexWrap="wrap">
            <Button variant="outlined" borderWidth={2} borderColor="$textTertiary" disabled={!!busy} onPress={() => onOpenChange(false)}>
              Cancel
            </Button>
            {plan ? (
              <Button variant="outlined" borderWidth={2} borderColor="$textTertiary" disabled={!!busy} onPress={() => setPlan(null)}>
                Back
              </Button>
            ) : null}
            {plan ? (
              <Button
                backgroundColor={brandColors.light.error}
                color="white"
                borderWidth={2}
                borderColor={brandColors.light.error}
                hoverStyle={{ backgroundColor: brandColors.light.error, borderColor: brandColors.light.error, opacity: 0.9 }}
                pressStyle={{ backgroundColor: brandColors.light.error, opacity: 0.8 }}
                onPress={merge}
                disabled={blocked || !!busy}
                icon={busy === 'merge' ? <Spinner size="small" /> : Merge}
              >
                {busy === 'merge' ? 'Merging…' : `Merge and delete "${sourceName}"`}
              </Button>
            ) : (
              <Button theme="blue" onPress={preview} disabled={!target || !!busy} icon={busy === 'preview' ? <Spinner size="small" /> : undefined}>
                {busy === 'preview' ? 'Checking…' : 'Show what will change'}
              </Button>
            )}
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function MergePlanSummary({ plan }: { plan: MergePlan }) {
  const s = plan.summary
  const lines = [
    s.people > 0 ? `${plural(s.people, 'person', 'people')} move to ${plan.target.name}` : null,
    s.offices > 0 ? `${plural(s.offices, 'office')} (inbox, phone, holder) folded into ${plan.target.name}'s` : null,
    s.posts > 0 ? `${plural(s.posts, 'post')} re-pointed` : null,
    s.events > 0 ? `${plural(s.events, 'event')} re-pointed` : null,
    s.mailingLists > 0 ? `${plural(s.mailingLists, 'mailing list')} handed to ${plan.target.name}` : null,
    s.neighbourLists > 0 ? `${plural(s.neighbourLists, 'nearby/excluded list')} on other ecclesias updated` : null,
    s.nominationsWithdrawn > 0 ? `${plural(s.nominationsWithdrawn, 'open Recording Brother nomination')} withdrawn` : null,
    s.fieldsCopied.length > 0 ? `Copied to ${plan.target.name} (it had none): ${s.fieldsCopied.join(', ')}` : null,
    `"${plan.source.name}" is deleted`,
  ].filter((l): l is string => !!l)

  return (
    <ScrollView maxHeight={300}>
      <YStack gap="$3">
        {plan.blockers.length > 0 ? (
          <Card padding="$3" backgroundColor="$red2" borderWidth={1} borderColor="$red8">
            <YStack gap="$1">
              <Text fontSize="$3" fontWeight="600" color="$red11">This merge can&apos;t run yet</Text>
              {plan.blockers.map((b) => (
                <Text key={b} fontSize="$3" color="$red11">• {b}</Text>
              ))}
            </YStack>
          </Card>
        ) : null}
        <Card padding="$3" backgroundColor="$gray2" borderWidth={1} borderColor="$borderColor">
          <YStack gap="$1">
            <Text fontSize="$3" fontWeight="600">
              {plan.source.name} → {plan.target.name}
            </Text>
            {lines.map((l) => (
              <Text key={l} fontSize="$3">• {l}</Text>
            ))}
          </YStack>
        </Card>
        {plan.warnings.length > 0 ? (
          <Card padding="$3" backgroundColor="$yellow2" borderWidth={1} borderColor="$yellow8">
            <YStack gap="$1">
              <XStack gap="$2" alignItems="center">
                <AlertTriangle size={14} color="$yellow11" />
                <Text fontSize="$3" fontWeight="600" color="$yellow11">Check before merging</Text>
              </XStack>
              {plan.warnings.map((w) => (
                <Text key={w} fontSize="$3" color="$yellow11">• {w}</Text>
              ))}
            </YStack>
          </Card>
        ) : null}
      </YStack>
    </ScrollView>
  )
}
