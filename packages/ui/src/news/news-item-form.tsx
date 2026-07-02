'use client'

import React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Paragraph, XStack, YStack } from 'tamagui'
// Project Button (not raw tamagui): disables hoverTheme so a colored button's
// background doesn't swap to the page background on hover (white-on-white).
import { Button } from '../Button'
import { FormInput } from '../form/form-input'
import { OptimizedTextarea } from '../form/optimized-textarea'
import { EventFormSelect } from '../form/event-form-select'
import { DocumentUpload } from '../form/document-upload'
import type { DocumentAttachment } from '@my/app/types/events'

// One uploader for everything a News item can carry — images (rendered inline
// on the details page) and documents (rendered as links). Type is derived from
// the file itself; the user never has to pick the "right" uploader.
const NEWS_UPLOAD_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

export type NewsFormValues = {
  title: string
  body: string
  category: '' | 'medical' | 'general' | 'announcement'
  durationWeeks: '1' | '2' | '3'
  sharingScope: 'own' | 'region' | 'global'
  documents: DocumentAttachment[]
  /** Owning ecclesia ("operating as"). Only meaningful when ecclesiaOptions > 1. */
  ecclesiaId?: string
}

export type AudienceOption = { key: string; label: string }

export type NewsItemFormProps = {
  initialValues?: Partial<NewsFormValues>
  isSaving?: boolean
  isExisting?: boolean
  /**
   * Audiences (EmailListTypes keys) this item has already been blasted to live.
   * The "Send alert" button disables only for the currently-selected audience,
   * so the same post can still go to a different list.
   */
  sentAudiences?: string[]
  /** Selectable send audiences ({ key, label }), e.g. Newsletter, Inter-Ecclesia Leaders. */
  audiences?: AudienceOption[]
  /** Default selected audience key. Falls back to 'newsletter'. */
  defaultAudience?: string
  /**
   * Ecclesias the signed-in user may post for. When more than one, a picker is
   * shown so an owner / regional admin can choose which ecclesia owns the item.
   * When 0–1, no picker is rendered (the server defaults to the user's home).
   */
  ecclesiaOptions?: string[]
  onSave: (values: NewsFormValues) => void | Promise<void>
  onCancel: () => void
  onDelete?: () => void | Promise<void>
  onSendAlert?: (test: boolean, audience: string) => void | Promise<void>
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
  sentAudiences = [],
  audiences = [],
  defaultAudience = 'newsletter',
  ecclesiaOptions,
  onSave,
  onCancel,
  onDelete,
  onSendAlert,
}: NewsItemFormProps) {
  const [selectedAudience, setSelectedAudience] = React.useState(defaultAudience)
  const alertAlreadySent = sentAudiences.includes(selectedAudience)
  const { control, handleSubmit, formState } = useForm<NewsFormValues>({
    defaultValues: {
      title: initialValues?.title || '',
      body: initialValues?.body || '',
      category: initialValues?.category || '',
      durationWeeks: initialValues?.durationWeeks || '1',
      sharingScope: initialValues?.sharingScope || 'own',
      documents: initialValues?.documents || [],
      ecclesiaId: initialValues?.ecclesiaId || ecclesiaOptions?.[0] || '',
    },
  })

  const showEcclesiaPicker = (ecclesiaOptions?.length ?? 0) > 1

  return (
    <YStack gap="$4" padding="$4">
      {showEcclesiaPicker ? (
        <EventFormSelect
          control={control}
          name="ecclesiaId"
          label="Posting for ecclesia"
          options={ecclesiaOptions!.map((name) => ({ value: name, label: name }))}
          required
        />
      ) : null}

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
        placeholder="What happened? Use # for headings, **bold** for emphasis, - for bullet lists, plain URLs auto-link."
        required
        rows={8}
        maxLength={4000}
      />

      <Controller
        control={control}
        name="documents"
        render={({ field }) => (
          <YStack gap="$2">
            <Paragraph fontSize="$4" fontWeight="600" color="$gray12">
              Photos & files (optional)
            </Paragraph>
            <Paragraph fontSize="$3" color="$gray10">
              Add anything: images and PDF posters appear on the details page;
              other files become download links. Already online (e.g. a Google
              Doc)? Paste its link below instead of uploading.
            </Paragraph>
            <DocumentUpload
              documents={field.value || []}
              onChange={field.onChange}
              disabled={isSaving}
              allowedTypes={NEWS_UPLOAD_TYPES}
            />
          </YStack>
        )}
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

      {isExisting && onSendAlert && audiences.length > 0 ? (
        <YStack gap="$2" marginTop="$2">
          <Paragraph fontSize="$3" fontWeight="600" color="$gray12">
            Send alert to
          </Paragraph>
          <XStack gap="$2" flexWrap="wrap">
            {audiences.map((a) => {
              const selected = a.key === selectedAudience
              const sent = sentAudiences.includes(a.key)
              return (
                <Button
                  key={a.key}
                  size="$2"
                  backgroundColor={selected ? '$info' : '$backgroundStrong'}
                  color={selected ? 'white' : '$color'}
                  borderColor={selected ? '$info' : '$borderColor'}
                  hoverStyle={{
                    backgroundColor: selected ? '$infoHover' : '$backgroundHover',
                    borderColor: '$textSecondary',
                  }}
                  onPress={() => setSelectedAudience(a.key)}
                >
                  {sent ? `${a.label} ✓` : a.label}
                </Button>
              )
            })}
          </XStack>
        </YStack>
      ) : null}

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
              onPress={() => onSendAlert(true, selectedAudience)}
              disabled={isSaving}
            >
              Send test alert
            </Button>
            <Button
              backgroundColor={alertAlreadySent ? '$gray4' : '$warning'}
              color={alertAlreadySent ? '$gray11' : 'white'}
              borderColor={alertAlreadySent ? '$gray6' : undefined}
              hoverStyle={{ backgroundColor: alertAlreadySent ? '$gray4' : '$warningHover' }}
              disabledStyle={{ opacity: 1 }}
              onPress={() => onSendAlert(false, selectedAudience)}
              disabled={isSaving || alertAlreadySent}
            >
              {alertAlreadySent ? 'Already sent to this list' : 'Send alert to subscribers'}
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
          An alert has already been sent to this audience. Sending to it again is disabled to
          prevent duplicates — pick a different audience above to reach another list.
        </Paragraph>
      ) : null}
    </YStack>
  )
}
