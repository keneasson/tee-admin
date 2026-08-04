'use client'

/**
 * TemplatePicker — "Use Template" entry point for the document editor
 * (Consolidated CMS Phase 2R-1d). Pick a template (Obituary for now), toggle which
 * optional sections to include, and Apply — which seeds the document with the
 * template's placeholder structures via {@link applyTemplate}. A scaffold, not a
 * lock: once applied it is just an open document.
 *
 * Web-only authoring chrome (Tamagui shell). Emits the built `Block[]`; the host
 * decides how to seed (the showcase remounts the editor with them).
 */

import { useMemo, useState } from 'react'
import { YStack, XStack, Text, Button, Separator } from '@my/ui'
import { CheckSquare, Square, FileText, Wand2 } from '@tamagui/lucide-icons'
import type { Block } from '@my/app/types/post'
import { TEMPLATES, applyTemplate, type TemplateDef } from './templates'

export interface TemplatePickerProps {
  onApply: (blocks: Block[]) => void
}

export function TemplatePicker({ onApply }: TemplatePickerProps) {
  const [template, setTemplate] = useState<TemplateDef | null>(null)

  if (!template) {
    return (
      <YStack gap="$3">
        <XStack alignItems="center" gap="$2">
          <Wand2 size={18} color="$color11" />
          <Text fontSize="$4" fontWeight="700" color="$color12">
            Start from a template
          </Text>
        </XStack>
        <Text fontSize="$2" color="$color10">
          A warm start for a recurring shape — it drops in labelled, movable placeholders you
          fill in. Nothing is locked; edit, reorder, or delete anything after applying.
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          {TEMPLATES.map((t) => (
            <Button key={t.id} size="$3" icon={FileText} onPress={() => setTemplate(t)}>
              {t.label}
            </Button>
          ))}
        </XStack>
      </YStack>
    )
  }

  return <TemplateConfig template={template} onBack={() => setTemplate(null)} onApply={onApply} />
}

function TemplateConfig({
  template,
  onBack,
  onApply,
}: {
  template: TemplateDef
  onBack: () => void
  onApply: (blocks: Block[]) => void
}) {
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(template.sections.filter((s) => s.defaultOn).map((s) => s.key))
  )

  const toggle = (key: string) =>
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const blocks = useMemo(
    () => applyTemplate(template, Array.from(enabled)),
    [template, enabled]
  )

  return (
    <YStack gap="$3">
      <XStack alignItems="center" gap="$2">
        <Wand2 size={18} color="$color11" />
        <Text fontSize="$4" fontWeight="700" color="$color12">
          {template.label} template
        </Text>
      </XStack>
      <Text fontSize="$2" color="$color10">
        {template.description}
      </Text>

      <Separator />
      <Text fontSize="$2" fontWeight="600" color="$color11">
        Include which sections?
      </Text>
      <YStack gap="$1">
        {template.sections.map((s) => {
          const on = enabled.has(s.key)
          return (
            <Button
              key={s.key}
              size="$3"
              justifyContent="flex-start"
              chromeless
              onPress={() => toggle(s.key)}
              icon={on ? CheckSquare : Square}
              theme={on ? 'blue' : undefined}
            >
              <YStack flex={1} alignItems="flex-start">
                <Text fontSize="$3" fontWeight="600" color="$color12">
                  {s.label}
                </Text>
                <Text fontSize="$1" color="$color10">
                  {s.hint}
                </Text>
              </YStack>
            </Button>
          )
        })}
      </YStack>

      <Separator />
      <XStack gap="$2" justifyContent="space-between">
        <Button size="$3" chromeless onPress={onBack}>
          ← Templates
        </Button>
        <Button size="$3" theme="blue" icon={Wand2} onPress={() => onApply(blocks)}>
          Apply template
        </Button>
      </XStack>
    </YStack>
  )
}
