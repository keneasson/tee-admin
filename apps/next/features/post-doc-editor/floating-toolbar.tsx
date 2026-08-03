'use client'

/**
 * FloatingToolbar — the Photoshop-style floating, draggable, collapsible tool
 * palette (Consolidated CMS Phase 2R-1 keystone). Each tool maps to a structured
 * block kind; clicking a tool ARMS it (highlighted), and the next click in the
 * document drops that block at the caret (see {@link ArmedToolPlugin}). Clicking
 * the armed tool again — or pressing Escape — disarms.
 *
 * Web-only editor chrome: uses raw DOM drag (this never runs on native), with
 * Tamagui components for the visual shell so it matches the brand system.
 * KEYSTONE: only Location is enabled; the rest render as disabled "soon" tools so
 * the mechanic is fully visible ahead of 2R-2.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { YStack, XStack, Text, Button } from '@my/ui'
import { GripVertical, ChevronDown, ChevronRight, MapPin } from '@tamagui/lucide-icons'
import { TOOLS, type ToolKind } from './tool-blocks'

export interface FloatingToolbarProps {
  armed: ToolKind | null
  onArm: (kind: ToolKind | null) => void
}

export function FloatingToolbar({ armed, onArm }: FloatingToolbarProps) {
  const [pos, setPos] = useState({ x: 24, y: 120 })
  const [collapsed, setCollapsed] = useState(false)
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null)

  const onHandleDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragOffset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
      const move = (ev: MouseEvent) => {
        if (!dragOffset.current) return
        setPos({ x: ev.clientX - dragOffset.current.dx, y: ev.clientY - dragOffset.current.dy })
      }
      const up = () => {
        dragOffset.current = null
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    [pos.x, pos.y]
  )

  // Escape disarms the current tool.
  useEffect(() => {
    if (!armed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onArm(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [armed, onArm])

  const armedLabel = TOOLS.find((t) => t.kind === armed)?.label

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 1000, width: 244 }}>
      <YStack
        borderWidth={1}
        borderColor="$borderColor"
        backgroundColor="$background"
        borderRadius="$4"
        shadowColor="$shadowColor"
        shadowRadius={16}
        shadowOffset={{ width: 0, height: 4 }}
        elevation="$4"
        overflow="hidden"
      >
        {/* Drag handle / header — a native div so DOM mouse-drag is reliable. */}
        <div onMouseDown={onHandleDown} style={{ cursor: 'grab' }}>
          <XStack
            alignItems="center"
            justifyContent="space-between"
            paddingHorizontal="$3"
            paddingVertical="$2"
            backgroundColor="$backgroundHover"
          >
            <XStack alignItems="center" gap="$2">
              <GripVertical size={16} color="$color10" />
              <Text fontSize="$3" fontWeight="700">
                Insert
              </Text>
            </XStack>
            <Button
              size="$1"
              chromeless
              circular
              icon={collapsed ? ChevronRight : ChevronDown}
              aria-label={collapsed ? 'Expand toolbar' : 'Collapse toolbar'}
              onPress={() => setCollapsed((c) => !c)}
            />
          </XStack>
        </div>

        {collapsed ? null : (
          <YStack padding="$2" gap="$2">
            {armed ? (
              <XStack
                alignItems="center"
                gap="$2"
                padding="$2"
                borderRadius="$3"
                backgroundColor="$blue3"
              >
                <MapPin size={14} color="$blue10" />
                <Text fontSize="$2" color="$blue11" flex={1}>
                  Click in the document to place {armedLabel}. Esc to cancel.
                </Text>
              </XStack>
            ) : (
              <Text fontSize="$2" color="$color10" paddingHorizontal="$1">
                Pick a tool, then click where it should go.
              </Text>
            )}

            <YStack gap="$1">
              {TOOLS.map((tool) => {
                const isArmed = armed === tool.kind
                return (
                  <Button
                    key={tool.kind}
                    size="$3"
                    justifyContent="flex-start"
                    disabled={!tool.enabled}
                    opacity={tool.enabled ? 1 : 0.5}
                    theme={isArmed ? 'blue' : undefined}
                    backgroundColor={isArmed ? '$blue5' : undefined}
                    hoverStyle={isArmed ? { backgroundColor: '$blue6' } : undefined}
                    onPress={() => (tool.enabled ? onArm(isArmed ? null : tool.kind) : undefined)}
                  >
                    <XStack flex={1} justifyContent="space-between" alignItems="center">
                      <Text fontSize="$3">{tool.label}</Text>
                      {tool.enabled ? null : (
                        <Text fontSize="$1" color="$color10">
                          soon
                        </Text>
                      )}
                    </XStack>
                  </Button>
                )
              })}
            </YStack>
          </YStack>
        )}
      </YStack>
    </div>
  )
}
