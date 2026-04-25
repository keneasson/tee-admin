import { useState, useEffect, useCallback } from 'react'
import { YStack, XStack, Text, Card, Input, Separator, Spinner, H2, ScrollView } from '@my/ui'
import { Button } from '../Button'
import {
  Flag,
  Plus,
  Trash,
  Save,
  X,
  RefreshCw,
  UserPlus,
  Eye,
  EyeOff,
  AlertTriangle,
} from '@tamagui/lucide-icons'
import type { FeatureFlagConfig, FlagVisibility } from '@my/app/features/feature-flags/feature-flags'

interface FeatureFlagManagerProps {
  userEmail: string
  userRole: string
}

type FlagEntry = {
  name: string
  config: FeatureFlagConfig
  isActiveForUser: boolean
}

const VISIBILITY_OPTIONS: { value: FlagVisibility; label: string; description: string }[] = [
  { value: 'off', label: 'Off', description: 'Disabled for everyone, including owner' },
  { value: 'owner', label: 'Owner only', description: 'Only you and users on the list' },
  { value: 'admin', label: 'Admins', description: 'All admins + users on the list' },
  { value: 'everyone', label: 'Everyone', description: 'Released — ready to remove flag from code' },
]

export function FeatureFlagManager({ userEmail, userRole }: FeatureFlagManagerProps) {
  const [flags, setFlags] = useState<FlagEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingFlag, setEditingFlag] = useState<string | null>(null)
  const [editState, setEditState] = useState<FeatureFlagConfig | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newFlagName, setNewFlagName] = useState('')
  const [newFlagDescription, setNewFlagDescription] = useState('')

  const fetchFlags = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/feature-flags')
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load')
      const data = await res.json()
      const entries: FlagEntry[] = Object.entries(data.flags).map(([name, config]) => ({
        name,
        config: config as FeatureFlagConfig,
        isActiveForUser: data.evaluated?.[name] ?? false,
      }))
      entries.sort((a, b) => a.name.localeCompare(b.name))
      setFlags(entries)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchFlags() }, [fetchFlags])

  const startEditing = (flag: FlagEntry) => {
    setEditingFlag(flag.name)
    setEditState({ ...flag.config, users: [...flag.config.users] })
  }

  const cancelEditing = () => {
    setEditingFlag(null)
    setEditState(null)
  }

  const saveFlag = async (flagName: string) => {
    if (!editState) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/feature-flags/${flagName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editState),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      cancelEditing()
      await fetchFlags()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteFlag = async (flagName: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/feature-flags/${flagName}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed')
      await fetchFlags()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const createFlag = async () => {
    if (!newFlagName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flagName: newFlagName.trim(),
          config: {
            description: newFlagDescription.trim() || newFlagName.trim(),
            visibleTo: 'owner',
            users: [],
          },
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Create failed')
      setShowNewForm(false)
      setNewFlagName('')
      setNewFlagDescription('')
      await fetchFlags()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" gap="$3">
        <Spinner size="large" width={36} height={36} />
        <Text theme="alt2">Loading feature flags...</Text>
      </YStack>
    )
  }

  const isOwner = userRole === 'owner'

  return (
    <ScrollView>
      <YStack padding="$4" gap="$4" maxWidth={800} marginHorizontal="auto">
        {/* Header */}
        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
          <YStack gap="$1">
            <XStack gap="$2" alignItems="center">
              <Flag size={24} color="$blue10" />
              <H2>Feature Flags</H2>
            </XStack>
            <Text theme="alt2" fontSize="$3">
              Each flag gates an unreleased feature. Add users to let them see it. Delete the flag when released.
            </Text>
          </YStack>
          <XStack gap="$2">
            <Button size="$3" icon={RefreshCw} variant="outlined" onPress={fetchFlags} disabled={saving}>
              Refresh
            </Button>
            {isOwner ? (
              <Button size="$3" icon={Plus} theme="blue" onPress={() => setShowNewForm(true)} disabled={saving}>
                New Flag
              </Button>
            ) : null}
          </XStack>
        </XStack>

        {error ? (
          <Card padding="$3" backgroundColor="$red2" borderWidth={1} borderColor="$red6">
            <XStack gap="$2" alignItems="center">
              <AlertTriangle size={16} color="$red10" />
              <Text color="$red10" fontSize="$3">{error}</Text>
              <Button size="$2" variant="outlined" onPress={() => setError(null)} marginLeft="auto">
                Dismiss
              </Button>
            </XStack>
          </Card>
        ) : null}

        {/* New Flag Form */}
        {showNewForm ? (
          <Card padding="$4" borderWidth={2} borderColor="$blue8" backgroundColor="$blue1">
            <YStack gap="$3">
              <Text fontSize="$5" fontWeight="600">New Feature Flag</Text>
              <YStack gap="$1">
                <Text fontSize="$3" fontWeight="600">Flag Name</Text>
                <Input
                  value={newFlagName}
                  onChangeText={setNewFlagName}
                  placeholder="my_new_feature"
                  autoCapitalize="none"
                  fontFamily="$mono"
                />
                <Text fontSize="$2" theme="alt2">Lowercase, underscores. e.g. multi_tenant_newsletter</Text>
              </YStack>
              <YStack gap="$1">
                <Text fontSize="$3" fontWeight="600">Description</Text>
                <Input
                  value={newFlagDescription}
                  onChangeText={setNewFlagDescription}
                  placeholder="What does this feature do?"
                />
              </YStack>
              <XStack gap="$2" justifyContent="flex-end">
                <Button icon={X} onPress={() => { setShowNewForm(false); setNewFlagName(''); setNewFlagDescription('') }} disabled={saving}>
                  Cancel
                </Button>
                <Button icon={saving ? undefined : Save} theme="blue" onPress={createFlag} disabled={saving || !newFlagName.trim()}>
                  {saving ? 'Creating...' : 'Create'}
                </Button>
              </XStack>
            </YStack>
          </Card>
        ) : null}

        {/* Flag List */}
        {flags.length === 0 ? (
          <Card padding="$4" borderWidth={1} borderColor="$borderColor">
            <Text theme="alt2" textAlign="center">No feature flags. Create one to start gating a new feature.</Text>
          </Card>
        ) : null}

        {flags.map((flag) => {
          const isEditing = editingFlag === flag.name
          const visibilityInfo = VISIBILITY_OPTIONS.find((v) => v.value === flag.config.visibleTo)

          return (
            <Card key={flag.name} padding="$4" borderWidth={1} borderColor="$borderColor">
              <YStack gap="$3">
                {/* Header row */}
                <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
                  <YStack gap="$1" flex={1}>
                    <XStack gap="$2" alignItems="center">
                      <Text fontSize="$5" fontWeight="700" fontFamily="$mono">{flag.name}</Text>
                      <VisibilityBadge visibleTo={flag.config.visibleTo} />
                    </XStack>
                    <Text fontSize="$3" theme="alt2">{flag.config.description}</Text>
                  </YStack>
                  <XStack
                    backgroundColor={flag.isActiveForUser ? '$green2' : '$gray3'}
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                    borderRadius="$2"
                    gap="$1"
                    alignItems="center"
                  >
                    {flag.isActiveForUser ? <Eye size={12} color="$green11" /> : <EyeOff size={12} color="$gray11" />}
                    <Text fontSize="$2" fontWeight="600" color={flag.isActiveForUser ? '$green11' : '$gray11'}>
                      {flag.isActiveForUser ? 'You can see this' : 'Hidden from you'}
                    </Text>
                  </XStack>
                </XStack>

                {/* Non-editing view */}
                {!isEditing ? (
                  <YStack gap="$2">
                    {/* Users list */}
                    {flag.config.users.length > 0 ? (
                      <YStack gap="$1">
                        <Text fontSize="$2" fontWeight="600" theme="alt2">Users with access:</Text>
                        <XStack gap="$1" flexWrap="wrap">
                          {flag.config.users.map((email) => (
                            <XStack key={email} backgroundColor="$blue2" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
                              <Text fontSize="$2">{email}</Text>
                            </XStack>
                          ))}
                        </XStack>
                      </YStack>
                    ) : null}

                    {isOwner ? (
                      <XStack gap="$2" marginTop="$1">
                        <Button size="$2" variant="outlined" onPress={() => startEditing(flag)}>
                          Edit
                        </Button>
                        <Button size="$2" icon={Trash} theme="red" variant="outlined" onPress={() => deleteFlag(flag.name)} disabled={saving}>
                          Delete
                        </Button>
                      </XStack>
                    ) : null}
                  </YStack>
                ) : null}

                {/* Editing form */}
                {isEditing && editState ? (
                  <EditForm
                    config={editState}
                    onChange={setEditState}
                    onSave={() => saveFlag(flag.name)}
                    onCancel={cancelEditing}
                    saving={saving}
                  />
                ) : null}
              </YStack>
            </Card>
          )
        })}
      </YStack>
    </ScrollView>
  )
}

// --- Sub-components ---

function VisibilityBadge({ visibleTo }: { visibleTo: FlagVisibility }) {
  const colors = {
    off: { bg: '$gray3', text: '$gray11', label: 'Off' },
    owner: { bg: '$purple2', text: '$purple11', label: 'Owner' },
    admin: { bg: '$orange2', text: '$orange11', label: 'Admins' },
    everyone: { bg: '$green2', text: '$green11', label: 'Everyone' },
  }
  const c = colors[visibleTo] || colors.owner
  return (
    <XStack backgroundColor={c.bg} paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
      <Text fontSize="$1" fontWeight="700" color={c.text}>{c.label}</Text>
    </XStack>
  )
}

interface EditFormProps {
  config: FeatureFlagConfig
  onChange: (config: FeatureFlagConfig) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}

function EditForm({ config, onChange, onSave, onCancel, saving }: EditFormProps) {
  const [newEmail, setNewEmail] = useState('')

  const update = (partial: Partial<FeatureFlagConfig>) => {
    onChange({ ...config, ...partial })
  }

  const addUser = () => {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    if (config.users.includes(email)) return
    update({ users: [...config.users, email] })
    setNewEmail('')
  }

  const removeUser = (email: string) => {
    update({ users: config.users.filter((u) => u !== email) })
  }

  return (
    <YStack gap="$3">
      <Separator />

      <YStack gap="$1">
        <Text fontSize="$3" fontWeight="600">Description</Text>
        <Input
          value={config.description}
          onChangeText={(v: string) => update({ description: v })}
          placeholder="What does this feature do?"
        />
      </YStack>

      <YStack gap="$1">
        <Text fontSize="$3" fontWeight="600">Visible to</Text>
        <XStack gap="$2" flexWrap="wrap">
          {VISIBILITY_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="$3"
              variant={config.visibleTo === opt.value ? undefined : 'outlined'}
              theme={config.visibleTo === opt.value ? 'blue' : undefined}
              onPress={() => update({ visibleTo: opt.value })}
            >
              <YStack alignItems="center">
                <Text fontSize="$3" fontWeight="600">{opt.label}</Text>
                <Text fontSize="$1" theme="alt2">{opt.description}</Text>
              </YStack>
            </Button>
          ))}
        </XStack>
      </YStack>

      <YStack gap="$2">
        <Text fontSize="$3" fontWeight="600">Users with access</Text>
        <Text fontSize="$2" theme="alt2">
          These users can see the feature regardless of their role.
        </Text>
        <XStack gap="$2" alignItems="center">
          <Input
            flex={1}
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="user@example.com"
            autoCapitalize="none"
            onSubmitEditing={addUser}
          />
          <Button size="$3" icon={UserPlus} theme="blue" onPress={addUser} disabled={!newEmail.trim()}>
            Add
          </Button>
        </XStack>
        {config.users.length > 0 ? (
          <YStack gap="$1">
            {config.users.map((email) => (
              <XStack key={email} gap="$2" alignItems="center">
                <XStack flex={1} backgroundColor="$blue2" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
                  <Text fontSize="$3">{email}</Text>
                </XStack>
                <Button size="$2" icon={X} variant="outlined" onPress={() => removeUser(email)} />
              </XStack>
            ))}
          </YStack>
        ) : (
          <Text fontSize="$2" theme="alt2" fontStyle="italic">No specific users added.</Text>
        )}
      </YStack>

      <XStack gap="$2" justifyContent="flex-end">
        <Button icon={X} onPress={onCancel} disabled={saving}>Cancel</Button>
        <Button icon={saving ? undefined : Save} theme="blue" onPress={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </XStack>
    </YStack>
  )
}
