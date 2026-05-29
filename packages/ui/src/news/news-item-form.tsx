'use client'

import React from 'react'
import { useForm } from 'react-hook-form'
import { Button, Paragraph, XStack, YStack } from 'tamagui'
import { FormInput } from '../form/form-input'
import { OptimizedTextarea } from '../form/optimized-textarea'
import { EventFormSelect } from '../form/event-form-select'

export type NewsFormValues = {
  title: string
  body: string
  category: '' | 'medical' | 'general' | 'announcement'
  durationWeeks: '1' | '2' | '3'
  sharingScope: 'own' | 'region' | 'global'
}

export type NewsItemFormProps = {
  initialValues?: Partial<NewsFormValues>
  isSaving?: boolean
  isExisting?: boolean
  alertAlreadySent?: boolean
  onSave: (values: NewsFormValues) => void | Promise<void>
  onCancel: () => void
  onDelete?: () => void | Promise<void>
  onSendAlert?: (test: boolean) => void | Promise<void>
}

const CATEGORY_OPTIONS = [
  { value: '', label: 'No category' },
  { value: 'medical', label: 'Medical' },
  { value: 'general', label: 'General' },
  { value: 'announcement', label: 'Announcement' },
]

const DURATION_OPTIONS = [
  { value: '1', label: '1 week' },
  { value: '2', label: '2 weeks' },
  { value: '3', label: '3 weeks' },
]

const SCOPE_OPTIONS = [
  { value: 'own', label: 'Own ecclesia only (default)' },
  { value: 'region', label: 'Nearby ecclesias' },
  { value: 'global', label: 'All ecclesias' },
]

export function NewsItemForm({
  initialValues,
  isSaving = false,
  isExisting = false,
  alertAlreadySent = false,
  onSave,
  onCancel,
  onDelete,
  onSendAlert,
}: NewsItemFormProps) {
  const { control, handleSubmit, formState } = useForm<NewsFormValues>({
    defaultValues: {
      title: initialValues?.title || '',
      body: initialValues?.body || '',
      category: initialValues?.category || '',
      durationWeeks: initialValues?.durationWeeks || '1',
      sharingScope: initialValues?.sharingScope || 'own',
    },
  })

  return (
    <YStack gap="$4" padding="$4">
      <FormInput
        control={control}
        name="title"
        label="Title"
        rules={{ required: 'Title is required' }}
      />

      <OptimizedTextarea
        control={control}
        name="body"
        label="Body"
        placeholder="What happened? Use # for headings, **bold** for emphasis, plain URLs auto-link."
        required
        rows={8}
        maxLength={4000}
      />

      <EventFormSelect
        control={control}
        name="category"
        label="Category"
        options={CATEGORY_OPTIONS}
        placeholder="No category"
      />

      <EventFormSelect
        control={control}
        name="durationWeeks"
        label="Show for"
        options={DURATION_OPTIONS}
        required
      />

      <EventFormSelect
        control={control}
        name="sharingScope"
        label="Visibility"
        options={SCOPE_OPTIONS}
        required
      />

      <XStack gap="$3" flexWrap="wrap" marginTop="$2">
        <Button
          theme="active"
          backgroundColor="$primary"
          color="white"
          hoverStyle={{ backgroundColor: '$primaryHover' }}
          disabled={isSaving || formState.isSubmitting}
          onPress={handleSubmit(onSave)}
        >
          {isSaving ? 'Saving…' : isExisting ? 'Save changes' : 'Create news item'}
        </Button>
        <Button
          variant="outlined"
          borderColor="$borderColor"
          hoverStyle={{ borderColor: '$textSecondary' }}
          onPress={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        {isExisting && onSendAlert ? (
          <>
            <Button
              backgroundColor="$info"
              color="white"
              hoverStyle={{ backgroundColor: '$infoHover' }}
              onPress={() => onSendAlert(true)}
              disabled={isSaving}
            >
              Send test alert
            </Button>
            <Button
              backgroundColor={alertAlreadySent ? '$gray8' : '$warning'}
              color="white"
              hoverStyle={{ backgroundColor: alertAlreadySent ? '$gray8' : '$warningHover' }}
              onPress={() => onSendAlert(false)}
              disabled={isSaving || alertAlreadySent}
            >
              {alertAlreadySent ? 'Alert already sent' : 'Send alert to subscribers'}
            </Button>
          </>
        ) : null}
        {isExisting && onDelete ? (
          <Button
            backgroundColor="$error"
            color="white"
            hoverStyle={{ backgroundColor: '$errorHover' }}
            onPress={onDelete}
            disabled={isSaving}
            marginLeft="auto"
          >
            Delete
          </Button>
        ) : null}
      </XStack>

      {alertAlreadySent ? (
        <Paragraph color="$textSecondary" fontSize="$3">
          An email alert has already been sent for this news item. Sending again is disabled to
          prevent duplicates.
        </Paragraph>
      ) : null}
    </YStack>
  )
}
