import { useState, useCallback } from 'react'
import { YStack, XStack, Text, Button, Spinner, Image } from 'tamagui'
import { Upload, X, AlertCircle, Image as ImageLucideIcon } from '@tamagui/lucide-icons'
import { useDropzone } from 'react-dropzone'

interface ImageUploadProps {
  value?: {
    url: string
    fileName: string
    originalName: string
    uploadedAt: Date
  }
  onChange: (image: {
    url: string
    fileName: string
    originalName: string
    uploadedAt: Date
  } | undefined) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  maxSizeBytes?: number
}

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
]

export function ImageUpload({
  value,
  onChange,
  label = 'Upload Image',
  placeholder = 'If you have an image, upload here',
  disabled = false,
  maxSizeBytes = 10 * 1024 * 1024, // 10MB
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadImage = async (file: File): Promise<{
    url: string
    fileName: string
    originalName: string
    uploadedAt: Date
  } | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('description', '')

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Upload failed: ${response.status}`)
      }

      const result = await response.json()
      return {
        url: result.document.fileUrl,
        fileName: result.document.fileName,
        originalName: result.document.originalName,
        uploadedAt: new Date(result.document.uploadedAt),
      }
    } catch (error) {
      console.error('Image upload error:', error)
      throw error
    }
  }

  const deleteImage = async (url: string) => {
    try {
      const urlObj = new URL(url)
      const fileKey = urlObj.pathname.substring(1)

      const response = await fetch(`/api/files/${encodeURIComponent(fileKey)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Delete failed: ${response.status}`)
      }
    } catch (error) {
      console.error('Image delete error:', error)
      throw error
    }
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null)

      if (rejectedFiles.length > 0) {
        const rejected = rejectedFiles[0]
        const err = rejected.errors[0]
        if (err.code === 'file-too-large') {
          setError(`Image is too large (max ${Math.round(maxSizeBytes / 1024 / 1024)}MB)`)
        } else if (err.code === 'file-invalid-type') {
          setError('File type not supported. Please use JPG, PNG, HEIC, or WebP.')
        } else {
          setError(err.message)
        }
        return
      }

      if (acceptedFiles.length === 0) return

      const file = acceptedFiles[0]
      setUploading(true)

      try {
        const uploadedImage = await uploadImage(file)
        if (uploadedImage) {
          onChange(uploadedImage)
        }
      } catch (err) {
        setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      } finally {
        setUploading(false)
      }
    },
    [onChange, maxSizeBytes]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_IMAGE_TYPES.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize: maxSizeBytes,
    disabled: disabled || uploading,
    multiple: false,
  })

  const handleRemove = async () => {
    if (!value) return

    try {
      setUploading(true)
      await deleteImage(value.url)
      onChange(undefined)
    } catch (err) {
      setError(`Failed to remove image: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <YStack gap="$3">
      {label ? <Text fontSize="$4" fontWeight="500" color="$gray12">
          {label}
        </Text> : null}

      {value ? (
        <YStack gap="$2">
          <XStack
            gap="$3"
            alignItems="flex-start"
            padding="$3"
            backgroundColor="$gray2"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$gray6"
          >
            <YStack
              width={120}
              height={150}
              minWidth={120}
              maxWidth={120}
              minHeight={150}
              maxHeight={150}
              borderRadius="$3"
              overflow="hidden"
            >
              <Image
                source={{ uri: value.url }}
                width={120}
                height={150}
                style={{ width: 120, height: 150 }}
                resizeMode="cover"
              />
            </YStack>
            <YStack flex={1} gap="$1">
              <Text fontSize="$4" fontWeight="500" color="$gray12" numberOfLines={2}>
                {value.originalName}
              </Text>
              <Text fontSize="$3" color="$gray10">
                Uploaded {new Date(value.uploadedAt).toLocaleDateString()}
              </Text>
            </YStack>
            {uploading ? (
              <Spinner size="small" />
            ) : (
              <Button
                size="$2"
                chromeless
                icon={<X size={16} />}
                onPress={handleRemove}
                disabled={disabled}
              />
            )}
          </XStack>
        </YStack>
      ) : (
        <YStack
          {...(getRootProps() as any)}
          borderWidth={2}
          borderStyle="dashed"
          borderColor={isDragActive ? '$blue8' : '$gray6'}
          borderRadius="$4"
          padding="$4"
          alignItems="center"
          justifyContent="center"
          backgroundColor={isDragActive ? '$blue2' : '$gray1'}
          cursor={disabled || uploading ? 'not-allowed' : 'pointer'}
          opacity={disabled ? 0.5 : 1}
          minHeight={120}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <YStack alignItems="center" gap="$2">
              <Spinner size="large" />
              <Text fontSize="$4" color="$gray11">
                Uploading...
              </Text>
            </YStack>
          ) : (
            <>
              <ImageLucideIcon size={32} color="$gray10" />
              <Text fontSize="$4" fontWeight="500" color="$gray11" textAlign="center">
                {isDragActive ? 'Drop image here...' : placeholder}
              </Text>
              <Text fontSize="$3" color="$gray10" textAlign="center">
                Supports JPG, PNG, HEIC (iPhone), WebP
              </Text>
              <Text fontSize="$2" color="$gray9" textAlign="center">
                Max {Math.round(maxSizeBytes / 1024 / 1024)}MB
              </Text>
            </>
          )}
        </YStack>
      )}

      {error ? <XStack gap="$2" alignItems="center">
          <AlertCircle size={16} color="$red10" />
          <Text fontSize="$3" color="$red10">
            {error}
          </Text>
        </XStack> : null}
    </YStack>
  )
}
