import { useState, useEffect, useCallback } from 'react'
import { YStack, XStack, Text, Card, Input, Separator, Spinner, H2, Switch, ScrollView } from '@my/ui'
import { Button } from '../Button'
import {
  Flag,
  Plus,
  Trash,
  Save,
  X,
  RefreshCw,
  Shield,
  Users,
  Globe,
  Percent,
  UserCheck,
  AlertTriangle,
} from '@tamagui/lucide-icons'
import type { FeatureFlagConfig } from '@my/app/features/feature-flags/feature-flags'

interface FeatureFlagManagerProps {
  userEmail: string
  userRole: string
}

type FlagEntry = {
  name: string
  config: FeatureFlagConfig
  isActiveForUser?: boolean
}

const ENVIRONMENT_OPTIONS = ['all', 'development', 'staging', 'production'] as const
const ROLE_OPTIONS = ['owner', 'admin', 'recorder', 'rep', 'member', 'guest'] as const

export function FeatureFlagManager({ userEmail, userRole }: FeatureFlagManagerProps) {
  const [flags, setFlags] = useState<FlagEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingFlag, setEditingFlag] = useState<string | null>(null)
  const [editState, setEditState] = useState<FeatureFlagConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newFlagName, setNewFlagName] = useState('')
  const [newFlagConfig, setNewFlagConfig] = useState<FeatureFlagConfig>({
    enabled: false,
    rolloutPercentage: 0,
    userRoles: [],
    description: '',
    environment: 'all',
    userOverrides: {},
  })

  const fetchFlags = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/feature-flags?evaluated=true')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to load')
      }
      const data = await res.json()
      const entries: FlagEntry[] = Object.entries(data.flags).map(([name, config]) => ({
        name,
        config: config as FeatureFlagConfig,
        isActiveForUser: data.evaluated?.[name],
      }))
      entries.sort((a, b) => a.name.localeCompare(b.name))
      setFlags(entries)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFlags()
  }, [fetchFlags])

  const startEditing = (flag: FlagEntry) => {
    setEditingFlag(flag.name)
    setEditState({ ...flag.config })
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
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Save failed')
      }
      setEditingFlag(null)
      setEditState(null)
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
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Delete failed')
      }
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
        body: JSON.stringify({ flagName: newFlagName.trim(), config: newFlagConfig }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Create failed')
      }
      setShowNewForm(false)
      setNewFlagName('')
      setNewFlagConfig({
        enabled: false,
        rolloutPercentage: 0,
        userRoles: [],
        description: '',
        environment: 'all',
        userOverrides: {},
      })
      await fetchFlags()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleQuickEnable = async (flagName: string, currentEnabled: boolean) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/feature-flags/${flagName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      })
      if (res.ok) {
        await fetchFlags()
      }
    } catch {
      // Silently fail — user can retry
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

  return (
    <ScrollView>
      <YStack padding="$4" gap="$4" maxWidth={900} marginHorizontal="auto">
        {/* Header */}
        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
          <YStack gap="$1">
            <XStack gap="$2" alignItems="center">
              <Flag size={24} color="$blue10" />
              <H2>Feature Flags</H2>
            </XStack>
            <Text theme="alt2" fontSize="$3">
              DynamoDB-backed feature flag management. Changes take effect within 60 seconds.
            </Text>
          </YStack>
          <XStack gap="$2">
            <Button size="$3" icon={RefreshCw} variant="outlined" onPress={fetchFlags} disabled={saving}>
              Refresh
            </Button>
            {userRole === 'owner' ? (
              <Button size="$3" icon={Plus} theme="blue" onPress={() => setShowNewForm(true)} disabled={saving}>
                New Flag
              </Button>
            ) : null}
          </XStack>
        </XStack>

        {/* Current user context */}
        <Card padding="$3" backgroundColor="$blue2" borderWidth={1} borderColor="$blue6">
          <XStack gap="$3" alignItems="center" flexWrap="wrap">
            <XStack gap="$1" alignItems="center">
              <UserCheck size={14} color="$blue10" />
              <Text fontSize="$2" fontWeight="600">You:</Text>
              <Text fontSize="$2">{userEmail}</Text>
            </XStack>
            <XStack gap="$1" alignItems="center">
              <Shield size={14} color="$blue10" />
              <Text fontSize="$2" fontWeight="600">Role:</Text>
              <Text fontSize="$2">{userRole}</Text>
            </XStack>
          </XStack>
        </Card>

        {error ? (
          <Card padding="$3" backgroundColor="$red2" borderWidth={1} borderColor="$red6">
            <XStack gap="$2" alignItems="center">
              <AlertTriangle size={16} color="$red10" />
              <Text color="$red10" fontSize="$3">{error}</Text>
            </XStack>
          </Card>
        ) : null}

        {/* New Flag Form */}
        {showNewForm ? (
          <Card padding="$4" borderWidth={2} borderColor="$blue8" backgroundColor="$blue1">
            <YStack gap="$3">
              <Text fontSize="$5" fontWeight="600">Create New Flag</Text>
              <FlagConfigForm
                flagName={newFlagName}
                onFlagNameChange={setNewFlagName}
                config={newFlagConfig}
                onConfigChange={setNewFlagConfig}
                showNameField
              />
              <XStack gap="$2" justifyContent="flex-end">
                <Button icon={X} onPress={() => setShowNewForm(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button icon={saving ? undefined : Save} theme="blue" onPress={createFlag} disabled={saving || !newFlagName.trim()}>
                  {saving ? 'Creating...' : 'Create Flag'}
                </Button>
              </XStack>
            </YStack>
          </Card>
        ) : null}

        {/* Flag List */}
        {flags.length === 0 ? (
          <Card padding="$4" borderWidth={1} borderColor="$borderColor">
            <Text theme="alt2" textAlign="center">
              No feature flags configured. Create one to get started.
            </Text>
          </Card>
        ) : null}

        {flags.map((flag) => {
          const isEditing = editingFlag === flag.name

          return (
            <Card key={flag.name} padding="$4" borderWidth={1} borderColor={flag.config.enabled ? '$green6' : '$borderColor'}>
              <YStack gap="$3">
                {/* Flag header */}
                <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
                  <YStack gap="$1" flex={1}>
                    <XStack gap="$2" alignItems="center">
                      <Text fontSize="$5" fontWeight="700" fontFamily="$mono">
                        {flag.name}
                      </Text>
                      <StatusBadge enabled={flag.config.enabled} />
                      {flag.isActiveForUser !== undefined ? (
                        <XStack
                          backgroundColor={flag.isActiveForUser ? '$green3' : '$gray3'}
                          paddingHorizontal="$2"
                          paddingVertical="$1"
                          borderRadius="$2"
                        >
                          <Text fontSize="$1" fontWeight="600" color={flag.isActiveForUser ? '$green11' : '$gray11'}>
                            {flag.isActiveForUser ? 'ACTIVE FOR YOU' : 'INACTIVE FOR YOU'}
                          </Text>
                        </XStack>
                      ) : null}
                    </XStack>
                    <Text fontSize="$3" theme="alt2">{flag.config.description}</Text>
                  </YStack>
                  <XStack gap="$2" alignItems="center">
                    <Switch
                      size="$3"
                      checked={flag.config.enabled}
                      onCheckedChange={() => toggleQuickEnable(flag.name, flag.config.enabled)}
                      disabled={saving || userRole !== 'owner'}
                    >
                      <Switch.Thumb animation="quick" />
                    </Switch>
                  </XStack>
                </XStack>

                {/* Config summary (non-editing) */}
                {!isEditing ? (
                  <YStack gap="$2">
                    <XStack gap="$4" flexWrap="wrap">
                      <ConfigChip icon={<Percent size={12} />} label="Rollout" value={`${flag.config.rolloutPercentage}%`} />
                      <ConfigChip icon={<Globe size={12} />} label="Env" value={flag.config.environment || 'all'} />
                      <ConfigChip
                        icon={<Users size={12} />}
                        label="Roles"
                        value={flag.config.userRoles?.length ? flag.config.userRoles.join(', ') : 'all'}
                      />
                    </XStack>
                    {flag.config.userOverrides && Object.keys(flag.config.userOverrides).length > 0 ? (
                      <YStack gap="$1">
                        <Text fontSize="$2" fontWeight="600" theme="alt2">User Overrides:</Text>
                        <XStack gap="$2" flexWrap="wrap">
                          {Object.entries(flag.config.userOverrides).map(([email, enabled]) => (
                            <XStack
                              key={email}
                              backgroundColor={enabled ? '$green2' : '$red2'}
                              paddingHorizontal="$2"
                              paddingVertical="$1"
                              borderRadius="$2"
                              gap="$1"
                            >
                              <Text fontSize="$2">{email}</Text>
                              <Text fontSize="$2" fontWeight="600" color={enabled ? '$green10' : '$red10'}>
                                {enabled ? 'ON' : 'OFF'}
                              </Text>
                            </XStack>
                          ))}
                        </XStack>
                      </YStack>
                    ) : null}

                    {userRole === 'owner' ? (
                      <XStack gap="$2" marginTop="$2">
                        <Button size="$2" variant="outlined" onPress={() => startEditing(flag)}>
                          Edit
                        </Button>
                        <Button
                          size="$2"
                          icon={Trash}
                          theme="red"
                          variant="outlined"
                          onPress={() => deleteFlag(flag.name)}
                          disabled={saving}
                        >
                          Delete
                        </Button>
                      </XStack>
                    ) : null}
                  </YStack>
                ) : null}

                {/* Editing form */}
                {isEditing && editState ? (
                  <YStack gap="$3">
                    <Separator />
                    <FlagConfigForm
                      config={editState}
                      onConfigChange={setEditState}
                    />
                    <XStack gap="$2" justifyContent="flex-end">
                      <Button icon={X} onPress={cancelEditing} disabled={saving}>
                        Cancel
                      </Button>
                      <Button icon={saving ? undefined : Save} theme="blue" onPress={() => saveFlag(flag.name)} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </XStack>
                  </YStack>
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

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <XStack
      backgroundColor={enabled ? '$green3' : '$red3'}
      paddingHorizontal="$2"
      paddingVertical="$1"
      borderRadius="$2"
    >
      <Text fontSize="$1" fontWeight="700" color={enabled ? '$green11' : '$red11'}>
        {enabled ? 'ENABLED' : 'DISABLED'}
      </Text>
    </XStack>
  )
}

function ConfigChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <XStack gap="$1" alignItems="center">
      {icon}
      <Text fontSize="$2" fontWeight="600" theme="alt2">{label}:</Text>
      <Text fontSize="$2">{value}</Text>
    </XStack>
  )
}

interface FlagConfigFormProps {
  flagName?: string
  onFlagNameChange?: (name: string) => void
  config: FeatureFlagConfig
  onConfigChange: (config: FeatureFlagConfig) => void
  showNameField?: boolean
}

function FlagConfigForm({ flagName, onFlagNameChange, config, onConfigChange, showNameField }: FlagConfigFormProps) {
  const [overrideEmail, setOverrideEmail] = useState('')

  const update = (partial: Partial<FeatureFlagConfig>) => {
    onConfigChange({ ...config, ...partial })
  }

  const toggleRole = (role: string) => {
    const current = config.userRoles || []
    const updated = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role]
    update({ userRoles: updated })
  }

  const addOverride = (enabled: boolean) => {
    if (!overrideEmail.trim()) return
    const overrides = { ...(config.userOverrides || {}), [overrideEmail.trim().toLowerCase()]: enabled }
    update({ userOverrides: overrides })
    setOverrideEmail('')
  }

  const removeOverride = (email: string) => {
    const overrides = { ...(config.userOverrides || {}) }
    delete overrides[email]
    update({ userOverrides: overrides })
  }

  return (
    <YStack gap="$3">
      {showNameField ? (
        <YStack gap="$1">
          <Text fontSize="$3" fontWeight="600">Flag Name</Text>
          <Input
            value={flagName}
            onChangeText={onFlagNameChange}
            placeholder="my_feature_flag"
            autoCapitalize="none"
            fontFamily="$mono"
          />
          <Text fontSize="$2" theme="alt2">Lowercase, alphanumeric, underscores only</Text>
        </YStack>
      ) : null}

      <YStack gap="$1">
        <Text fontSize="$3" fontWeight="600">Description</Text>
        <Input
          value={config.description}
          onChangeText={(v: string) => update({ description: v })}
          placeholder="What does this flag control?"
        />
      </YStack>

      <XStack gap="$4" flexWrap="wrap">
        <YStack gap="$1" minWidth={120}>
          <Text fontSize="$3" fontWeight="600">Rollout %</Text>
          <Input
            value={String(config.rolloutPercentage)}
            onChangeText={(v: string) => {
              const num = parseInt(v, 10)
              if (!isNaN(num) && num >= 0 && num <= 100) {
                update({ rolloutPercentage: num })
              } else if (v === '') {
                update({ rolloutPercentage: 0 })
              }
            }}
            keyboardType="numeric"
            maxWidth={100}
          />
        </YStack>

        <YStack gap="$1" minWidth={150}>
          <Text fontSize="$3" fontWeight="600">Environment</Text>
          <XStack gap="$1" flexWrap="wrap">
            {ENVIRONMENT_OPTIONS.map((env) => (
              <Button
                key={env}
                size="$2"
                variant={config.environment === env ? undefined : 'outlined'}
                theme={config.environment === env ? 'blue' : undefined}
                onPress={() => update({ environment: env })}
              >
                {env}
              </Button>
            ))}
          </XStack>
        </YStack>
      </XStack>

      <YStack gap="$1">
        <Text fontSize="$3" fontWeight="600">Allowed Roles</Text>
        <Text fontSize="$2" theme="alt2">Empty = all roles. Selected = only these roles.</Text>
        <XStack gap="$1" flexWrap="wrap">
          {ROLE_OPTIONS.map((role) => {
            const isSelected = config.userRoles?.includes(role)
            return (
              <Button
                key={role}
                size="$2"
                variant={isSelected ? undefined : 'outlined'}
                theme={isSelected ? 'blue' : undefined}
                onPress={() => toggleRole(role)}
              >
                {role}
              </Button>
            )
          })}
        </XStack>
      </YStack>

      <Separator />

      <YStack gap="$2">
        <Text fontSize="$3" fontWeight="600">User Overrides</Text>
        <Text fontSize="$2" theme="alt2">
          Override the flag for specific users. Overrides bypass rollout percentage.
        </Text>
        <XStack gap="$2" alignItems="center">
          <Input
            flex={1}
            value={overrideEmail}
            onChangeText={setOverrideEmail}
            placeholder="user@example.com"
            autoCapitalize="none"
          />
          <Button size="$2" theme="green" onPress={() => addOverride(true)} disabled={!overrideEmail.trim()}>
            + Enable
          </Button>
          <Button size="$2" theme="red" onPress={() => addOverride(false)} disabled={!overrideEmail.trim()}>
            + Disable
          </Button>
        </XStack>
        {config.userOverrides && Object.keys(config.userOverrides).length > 0 ? (
          <YStack gap="$1">
            {Object.entries(config.userOverrides).map(([email, enabled]) => (
              <XStack key={email} gap="$2" alignItems="center">
                <XStack
                  flex={1}
                  backgroundColor={enabled ? '$green2' : '$red2'}
                  paddingHorizontal="$2"
                  paddingVertical="$1"
                  borderRadius="$2"
                  gap="$2"
                  alignItems="center"
                >
                  <Text fontSize="$3" flex={1}>{email}</Text>
                  <Text fontSize="$2" fontWeight="600" color={enabled ? '$green10' : '$red10'}>
                    {enabled ? 'ENABLED' : 'DISABLED'}
                  </Text>
                </XStack>
                <Button size="$2" icon={X} variant="outlined" onPress={() => removeOverride(email)} />
              </XStack>
            ))}
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  )
}
