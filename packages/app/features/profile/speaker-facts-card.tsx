import { useState } from 'react'
import { YStack, XStack, Text, Card, Input, Button } from '@my/ui'
import { Choice } from '../speaker-invites/choice'
import { Pencil, Check, X } from '@tamagui/lucide-icons'

/**
 * Brother / Sister and Baptized (docs/SPEAKER_INVITATIONS.md §9b): recorded
 * facts, edited by the person themselves (profile) or on the admin person
 * form. "Not set" clears a fact. Never inferred from anything else; the
 * server records who set it and when.
 */
export interface SpeakerFacts {
  gender: 'male' | 'female' | null
  baptized: boolean | null
  baptismDate: string | null
}

export interface SpeakerFactsCardProps {
  facts: SpeakerFacts
  /** Returns an error message, or null when saved. */
  onSave: (facts: SpeakerFacts) => Promise<string | null>
  testID?: string
}

const GENDER_LABEL = { male: 'Brother', female: 'Sister' } as const

export function describeSpeakerFacts(f: SpeakerFacts): string {
  const g = f.gender ? GENDER_LABEL[f.gender] : 'Brother/Sister not set'
  const b =
    f.baptized === true
      ? `Baptized${f.baptismDate ? ` (${f.baptismDate})` : ''}`
      : f.baptized === false
        ? 'Not baptized'
        : 'Baptism not set'
  return `${g} · ${b}`
}

export function SpeakerFactsCard({ facts, onSave, testID = 'speaker-facts' }: SpeakerFactsCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<SpeakerFacts>(facts)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const start = () => {
    setDraft(facts)
    setError('')
    setEditing(true)
  }
  const dateOk = !draft.baptismDate || /^\d{4}-\d{2}-\d{2}$/.test(draft.baptismDate)
  const save = async () => {
    setSaving(true)
    setError('')
    const message = await onSave({
      ...draft,
      baptismDate: draft.baptized === true && draft.baptismDate ? draft.baptismDate : null,
    })
    setSaving(false)
    if (message) setError(message)
    else setEditing(false)
  }

  if (!editing) {
    return (
      <Card padding="$3" backgroundColor="$backgroundHover" testID={testID}>
        <XStack gap="$2" alignItems="center">
          <XStack width={34} justifyContent="flex-start">
            <Button size="$2" icon={Pencil} chromeless circular aria-label="Edit Brother/Sister and baptism" onPress={start} />
          </XStack>
          <Text fontSize="$3">{describeSpeakerFacts(facts)}</Text>
        </XStack>
      </Card>
    )
  }

  return (
    <Card padding="$3" backgroundColor="$backgroundHover" testID={`${testID}-edit`}>
      <YStack gap="$3">
        <Choice
          label="Brother / Sister"
          value={draft.gender ?? 'unset'}
          options={[
            { value: 'male', label: 'Brother' },
            { value: 'female', label: 'Sister' },
            { value: 'unset', label: 'Not set' },
          ]}
          onChange={(v) => setDraft({ ...draft, gender: v === 'unset' ? null : (v as 'male' | 'female') })}
          testID={`${testID}-gender`}
        />
        <Choice
          label="Baptized"
          value={draft.baptized === true ? 'yes' : draft.baptized === false ? 'no' : 'unset'}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'unset', label: 'Not set' },
          ]}
          onChange={(v) => setDraft({ ...draft, baptized: v === 'yes' ? true : v === 'no' ? false : null })}
          testID={`${testID}-baptized`}
        />
        {draft.baptized === true ? (
          <YStack gap="$1">
            <Text fontSize="$2" fontWeight="600">
              Baptism date (optional)
            </Text>
            <Input
              width={160}
              value={draft.baptismDate ?? ''}
              onChangeText={(t) => setDraft({ ...draft, baptismDate: t.trim() || null })}
              placeholder="YYYY-MM-DD"
              aria-label="Baptism date"
            />
          </YStack>
        ) : null}
        {error ? (
          <Text fontSize="$2" color="$red10">
            {error}
          </Text>
        ) : null}
        {dateOk ? null : (
          <Text fontSize="$2" color="$red10">
            The baptism date must be YYYY-MM-DD.
          </Text>
        )}
        <XStack gap="$2" justifyContent="flex-end">
          <Button size="$2" icon={X} onPress={() => setEditing(false)} disabled={saving}>
            Cancel
          </Button>
          <Button size="$2" icon={Check} theme="blue" onPress={save} disabled={saving || !dateOk}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </XStack>
      </YStack>
    </Card>
  )
}

