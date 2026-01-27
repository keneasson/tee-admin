import React from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { View } from 'tamagui'

interface DraggableContactCardProps {
  id: string
  children: React.ReactNode
  disabled?: boolean
}

export function DraggableContactCard({ id, children, disabled = false }: DraggableContactCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    disabled,
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id,
    disabled,
  })

  // Combine refs for both draggable and droppable
  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: disabled ? 'default' : 'grab',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    position: 'relative' as const,
    zIndex: isDragging ? 1000 : 1,
  }

  return (
    <View
      ref={setNodeRef as any}
      style={style}
      {...listeners}
      {...attributes}
      borderWidth={isOver ? 3 : 0}
      borderColor={isOver ? '$blue10' : 'transparent'}
      borderRadius="$3"
      backgroundColor={isOver ? '$blue3' : 'transparent'}
    >
      {children}
      {isOver ? (
        <View
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          backgroundColor="$blue5"
          opacity={0.3}
          borderRadius="$3"
          pointerEvents="none"
        />
      ) : null}
    </View>
  )
}

// Type exports for parent components
export interface PersonEntry {
  type: 'directory' | 'ses-only'
  baseSkey?: string
  firstName?: string
  lastName?: string
  ecclesia?: string
  emails: EmailRow[]
  sesOnlyEmail?: string
}

export interface EmailRow {
  email: string
  inSES: boolean
  inSESMembers: boolean
  skey: string
}

export interface MergeData {
  source: PersonEntry
  target: PersonEntry
}
