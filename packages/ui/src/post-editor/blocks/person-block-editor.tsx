import { YStack, XStack, Label, Text, Input, TextArea, Card } from 'tamagui'
import { Plus, Trash2 } from '@tamagui/lucide-icons'
import type { BlockPerson, PersonBlock } from '@my/app/types/post'
import type { BlockEditorProps } from '../registry'
import { genId } from '../post-reducer'
import { PlainSelect } from '../plain-select'
import { Button } from '../../Button'

/**
 * PersonBlock editor — a `role` (design vocabulary for the block's people —
 * speaker/candidate/deceased/etc) plus a repeatable list of
 * {@link BlockPerson}. `firstName` is the only required field (the PII
 * "first-name floor" — always shown even to anon; design §8.2); the rest are
 * `pii:'name'|'bio'|'contact'` and gated by the redactor at read time, not
 * here — the editor just captures them.
 *
 * Fully controlled: `onChange` emits the full next PersonBlock.
 */
export function makePersonBlock(): PersonBlock {
  return { id: genId(), kind: 'person', role: 'speaker', people: [] }
}

const ROLE_OPTIONS: Array<{ value: PersonBlock['role']; label: string }> = [
  { value: 'speaker', label: 'Speaker' },
  { value: 'candidate', label: 'Candidate' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'bride', label: 'Bride' },
  { value: 'groom', label: 'Groom' },
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'contact', label: 'Contact' },
  { value: 'other', label: 'Other' },
]

function emptyPerson(): BlockPerson {
  return { firstName: '' }
}

export function PersonBlockEditor({ block, onChange }: BlockEditorProps<PersonBlock>) {
  const updatePerson = (index: number, patch: Partial<BlockPerson>) => {
    const people = block.people.map((p, i) => (i === index ? { ...p, ...patch } : p))
    onChange({ ...block, people })
  }

  const removePerson = (index: number) => {
    onChange({ ...block, people: block.people.filter((_, i) => i !== index) })
  }

  const addPerson = () => {
    onChange({ ...block, people: [...block.people, emptyPerson()] })
  }

  return (
    <YStack gap="$3">
      <YStack minWidth={200} maxWidth={280}>
        <PlainSelect
          id={`${block.id}-role`}
          label="Role"
          value={block.role}
          options={ROLE_OPTIONS}
          onValueChange={(role) => onChange({ ...block, role: role as PersonBlock['role'] })}
        />
      </YStack>

      <YStack gap="$3">
        {block.people.map((person, index) => (
          <Card key={index} bordered padding="$3" gap="$3" backgroundColor="$backgroundHover">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$3" fontWeight="600">
                Person {index + 1}
              </Text>
              <Button
                size="$2"
                theme="red"
                icon={Trash2}
                aria-label="Remove person"
                onPress={() => removePerson(index)}
              />
            </XStack>

            <XStack gap="$3" flexWrap="wrap">
              <YStack flex={1} minWidth={160} gap="$2">
                <Label htmlFor={`${block.id}-${index}-first`} fontSize="$3" fontWeight="600">
                  First name
                </Label>
                <Input
                  id={`${block.id}-${index}-first`}
                  value={person.firstName}
                  onChangeText={(firstName) => updatePerson(index, { firstName })}
                  placeholder="First name"
                />
              </YStack>
              <YStack flex={1} minWidth={160} gap="$2">
                <Label htmlFor={`${block.id}-${index}-last`} fontSize="$3" fontWeight="600">
                  Last name
                </Label>
                <Input
                  id={`${block.id}-${index}-last`}
                  value={person.lastName ?? ''}
                  onChangeText={(lastName) => updatePerson(index, { lastName })}
                  placeholder="Last name"
                />
              </YStack>
            </XStack>

            <XStack gap="$3" flexWrap="wrap">
              <YStack flex={1} minWidth={160} gap="$2">
                <Label htmlFor={`${block.id}-${index}-title`} fontSize="$3" fontWeight="600">
                  Title
                </Label>
                <Input
                  id={`${block.id}-${index}-title`}
                  value={person.title ?? ''}
                  onChangeText={(title) => updatePerson(index, { title })}
                  placeholder="e.g. Brother, Sister"
                />
              </YStack>
              <YStack flex={1} minWidth={160} gap="$2">
                <Label htmlFor={`${block.id}-${index}-ecclesia`} fontSize="$3" fontWeight="600">
                  Ecclesia
                </Label>
                <Input
                  id={`${block.id}-${index}-ecclesia`}
                  value={person.ecclesia ?? ''}
                  onChangeText={(ecclesia) => updatePerson(index, { ecclesia })}
                  placeholder="Ecclesia name"
                />
              </YStack>
              <YStack minWidth={100} gap="$2">
                <Label htmlFor={`${block.id}-${index}-age`} fontSize="$3" fontWeight="600">
                  Age
                </Label>
                <Input
                  id={`${block.id}-${index}-age`}
                  value={person.age !== undefined ? String(person.age) : ''}
                  onChangeText={(v) => {
                    const age = v.trim() === '' ? undefined : Number(v)
                    updatePerson(index, { age: age !== undefined && Number.isNaN(age) ? undefined : age })
                  }}
                  placeholder="Age"
                  keyboardType="numeric"
                />
              </YStack>
            </XStack>

            <YStack gap="$2">
              <Label htmlFor={`${block.id}-${index}-label`} fontSize="$3" fontWeight="600">
                Label (sub-role)
              </Label>
              <Input
                id={`${block.id}-${index}-label`}
                value={person.label ?? ''}
                onChangeText={(label) => updatePerson(index, { label })}
                placeholder="e.g. proposer, best man"
              />
            </YStack>

            <YStack gap="$2">
              <Label htmlFor={`${block.id}-${index}-contact`} fontSize="$3" fontWeight="600">
                Contact
              </Label>
              <Input
                id={`${block.id}-${index}-contact`}
                value={person.contact ?? ''}
                onChangeText={(contact) => updatePerson(index, { contact })}
                placeholder="Phone or personal email"
              />
            </YStack>

            <YStack gap="$2">
              <Label htmlFor={`${block.id}-${index}-bio`} fontSize="$3" fontWeight="600">
                Bio
              </Label>
              <TextArea
                id={`${block.id}-${index}-bio`}
                value={person.bio ?? ''}
                onChangeText={(bio) => updatePerson(index, { bio })}
                placeholder="Obituary / testimony / about…"
                minHeight={80}
                numberOfLines={3}
              />
            </YStack>
          </Card>
        ))}

        {block.people.length === 0 ? (
          <Text fontSize="$3" color="$color10" textAlign="center" paddingVertical="$2">
            No people added yet.
          </Text>
        ) : null}

        <XStack>
          <Button size="$3" icon={Plus} variant="outlined" onPress={addPerson}>
            Add person
          </Button>
        </XStack>
      </YStack>
    </YStack>
  )
}
