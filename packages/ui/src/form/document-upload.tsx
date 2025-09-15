import { useState, useCallback } from 'react'
import { YStack, XStack, Text, Button, Spinner } from 'tamagui'
import { Upload, X, File, AlertCircle } from '@tamagui/lucide-icons'
import { useDropzone } from 'react-dropzone'
import { DocumentAttachment } from '@my/app/types/events'

interface DocumentUploadProps {
  documents: DocumentAttachment[]
  onChange: (documents: DocumentAttachment[]) => void
  maxFiles?: number
  maxSizeBytes?: number
  allowedTypes?: string[]
  disabled?: boolean
}

export function DocumentUpload({
  documents,
  onChange,
  maxFiles = 10,
  maxSizeBytes = 10 * 1024 * 1024, // 10MB
  allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'text/plain',
  ],
  disabled = false,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])

  const uploadFile = async (file: File): Promise<DocumentAttachment | null> => {
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
      return result.document
    } catch (error) {
      console.error('Upload error:', error)
      throw error
    }
  }

  const deleteFile = async (document: DocumentAttachment) => {
    try {
      // Extract file key from URL
      const url = new URL(document.fileUrl)
      const fileKey = url.pathname.substring(1) // Remove leading slash

      const response = await fetch(`/api/files/${encodeURIComponent(fileKey)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Delete failed: ${response.status}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      throw error
    }
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: any[]) => {
      // Clear previous errors
      setErrors([])

      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const newErrors = rejectedFiles.map((rejected) => {
          const error = rejected.errors[0]
          if (error.code === 'file-too-large') {
            return `${rejected.file.name}: File is too large (max ${Math.round(maxSizeBytes / 1024 / 1024)}MB)`
          }
          if (error.code === 'file-invalid-type') {
            return `${rejected.file.name}: File type not allowed`
          }
          return `${rejected.file.name}: ${error.message}`
        })
        setErrors(newErrors)
      }

      // Check max files limit
      if (documents.length + acceptedFiles.length > maxFiles) {
        setErrors((prev) => [...prev, `Maximum ${maxFiles} files allowed`])
        return
      }

      // Upload accepted files
      const fileNames = acceptedFiles.map((f) => f.name)
      setUploading((prev) => [...prev, ...fileNames])

      try {
        const uploadPromises = acceptedFiles.map(uploadFile)
        const uploadedDocuments = await Promise.all(uploadPromises)

        const validDocuments = uploadedDocuments.filter(
          (doc): doc is DocumentAttachment => doc !== null
        )
        onChange([...documents, ...validDocuments])
      } catch (error) {
        setErrors((prev) => [
          ...prev,
          `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ])
      } finally {
        setUploading((prev) => prev.filter((name) => !fileNames.includes(name)))
      }
    },
    [documents, onChange, maxFiles, maxSizeBytes]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: allowedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize: maxSizeBytes,
    disabled: disabled || documents.length >= maxFiles,
  })

  const handleRemove = async (documentToRemove: DocumentAttachment) => {
    try {
      setUploading((prev) => [...prev, documentToRemove.fileName])
      await deleteFile(documentToRemove)
      onChange(documents.filter((doc) => doc.id !== documentToRemove.id))
    } catch (error) {
      setErrors((prev) => [...prev, `Failed to delete ${documentToRemove.originalName}`])
    } finally {
      setUploading((prev) => prev.filter((name) => name !== documentToRemove.fileName))
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <YStack gap="$3">
      {/* Upload Area */}
      {documents.length < maxFiles && (
        <YStack
          {...getRootProps()}
          borderWidth={2}
          borderStyle="dashed"
          borderColor={isDragActive ? '$blue8' : '$gray6'}
          borderRadius="$4"
          padding="$4"
          alignItems="center"
          justifyContent="center"
          backgroundColor={isDragActive ? '$blue2' : '$gray1'}
          cursor={disabled ? 'not-allowed' : 'pointer'}
          opacity={disabled ? 0.5 : 1}
          minHeight={120}
        >
          <input {...getInputProps()} />
          <Upload size={32} color="$gray10" />
          <Text fontSize="$4" fontWeight="500" color="$gray11" textAlign="center">
            {isDragActive ? 'Drop files here...' : 'Drag & drop files here, or click to select'}
          </Text>
          <Text fontSize="$3" color="$gray10" textAlign="center">
            Max {maxFiles} files, up to {Math.round(maxSizeBytes / 1024 / 1024)}MB each
          </Text>
        </YStack>
      )}

      {/* Error Messages */}
      {errors.length > 0 && (
        <YStack gap="$2">
          {errors.map((error, index) => (
            <XStack key={index} gap="$2" alignItems="center">
              <AlertCircle size={16} color="$red10" />
              <Text fontSize="$3" color="$red10">
                {error}
              </Text>
            </XStack>
          ))}
        </YStack>
      )}

      {/* Uploaded Documents */}
      {documents.length > 0 && (
        <YStack gap="$2">
          <Text fontSize="$4" fontWeight="500" color="$gray12">
            Documents ({documents.length}/{maxFiles})
          </Text>

          {documents.map((document) => (
            <XStack
              key={document.id}
              gap="$3"
              alignItems="center"
              padding="$3"
              backgroundColor="$gray2"
              borderRadius="$3"
            >
              <File size={20} color="$blue10" />

              <YStack flex={1} gap="$1">
                <Text fontSize="$4" fontWeight="500" color="$gray12">
                  {document.originalName}
                </Text>
                <Text fontSize="$3" color="$gray10">
                  {formatFileSize(document.fileSize)} •{' '}
                  {new Date(document.uploadedAt).toLocaleDateString()}
                </Text>
              </YStack>

              {uploading.includes(document.fileName) ? (
                <Spinner size="small" />
              ) : (
                <Button
                  size="$2"
                  variant="ghost"
                  icon={<X size={16} />}
                  onPress={() => handleRemove(document)}
                  disabled={disabled}
                />
              )}
            </XStack>
          ))}
        </YStack>
      )}
    </YStack>
  )
}
