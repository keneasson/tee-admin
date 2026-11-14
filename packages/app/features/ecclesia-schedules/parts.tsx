import { useState, type ReactNode } from 'react'
import { Adapt, Button, Card, Select, Sheet, Text, XStack, YStack } from '@my/ui'
import { AlertTriangle, Check, ChevronDown, Copy, Info } from '@tamagui/lucide-icons'

/** A coloured message box. */
export function Notice({
  tone,
  children,
  testID,
}: {
  tone: 'info' | 'warning' | 'error' | 'success'
  children: ReactNode
  testID?: string
}) {
  const palette = {
    info: { bg: '$blue2', border: '$blue6', fg: '$blue11' },
    warning: { bg: '$yellow2', border: '$yellow7', fg: '$yellow11' },
    error: { bg: '$red2', border: '$red6', fg: '$red11' },
    success: { bg: '$green2', border: '$green6', fg: '$green11' },
  }[tone]
  return (
    <Card padding="$3" backgroundColor={palette.bg} borderWidth={1} borderColor={palette.border} testID={testID}>
      <XStack gap="$2" alignItems="flex-start">
        {tone === 'info' || tone === 'success' ? (
          <Info size={16} color={palette.fg} />
        ) : (
          <AlertTriangle size={16} color={palette.fg} />
        )}
        <Text flex={1} color={palette.fg}>
          {children}
        </Text>
      </XStack>
    </Card>
  )
}

/** A value shown in full with a Copy button (the service-account address). */
export function CopyText({ value, testID }: { value: string; testID?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      const nav = typeof navigator === 'undefined' ? undefined : navigator
      await nav?.clipboard?.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  return (
    <XStack
      gap="$2"
      alignItems="center"
      flexWrap="wrap"
      padding="$2"
      borderRadius="$3"
      borderWidth={1}
      borderColor="$borderColor"
      backgroundColor="$background"
    >
      <Text flex={1} minWidth={200} fontSize="$3" selectable testID={testID}>
        {value}
      </Text>
      <Button size="$2" variant="outlined" icon={copied ? Check : Copy} onPress={copy} testID={testID ? `${testID}-copy` : undefined}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </XStack>
  )
}

export const NONE = '__none__'

/** A labelled dropdown. `NONE` is the "not used" option. */
export function PickOne({
  label,
  value,
  options,
  onChange,
  placeholder,
  testID,
  width = 220,
}: {
  label?: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
  placeholder?: string
  testID?: string
  width?: number
}) {
  return (
    <YStack gap="$1">
      {label ? <Text fontSize="$2">{label}</Text> : null}
      <Select value={value} onValueChange={onChange}>
        <Select.Trigger width={width} iconAfter={ChevronDown} backgroundColor="$background" testID={testID} aria-label={label}>
          <Select.Value placeholder={placeholder ?? 'Choose…'} />
        </Select.Trigger>
        <Adapt when="sm" platform="touch">
          <Sheet native modal dismissOnSnapToBottom>
            <Sheet.Frame>
              <Sheet.ScrollView>
                <Adapt.Contents />
              </Sheet.ScrollView>
            </Sheet.Frame>
            <Sheet.Overlay animation="lazy" enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
          </Sheet>
        </Adapt>
        <Select.Content zIndex={200000 as any}>
          <Select.Viewport>
            <Select.Group>
              {options.map((o, idx) => (
                <Select.Item key={o.value} index={idx} value={o.value}>
                  <Select.ItemText>{o.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check size={16} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Group>
          </Select.Viewport>
        </Select.Content>
      </Select>
    </YStack>
  )
}

/** "Names a person" toggle: a small two-state button so it reads the same on web and mobile. */
export function PersonToggle({
  on,
  disabled,
  onChange,
  testID,
}: {
  on: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
  testID?: string
}) {
  return (
    <Button
      size="$2"
      variant={on ? 'action' : 'outlined'}
      disabled={disabled}
      icon={on ? Check : undefined}
      role="switch"
      aria-checked={on}
      onPress={() => onChange(!on)}
      testID={testID}
    >
      Names a person
    </Button>
  )
}
