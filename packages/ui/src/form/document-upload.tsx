import { useState, useCallback } from 'react'
import { YStack, XStack, Text, Button, Spinner, Input } from 'tamagui'
import { Upload, X, File, AlertCircle, FileText, Link2, Pencil, GripVertical } from '@tamagui/lucide-icons'
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
  const [googleDocUrl, setGoogleDocUrl] = useState('')
  const [importingGoogleDoc, setImportingGoogleDoc] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

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

  const handleImportGoogleDoc = async () => {
    if (!googleDocUrl.trim()) {
      setErrors(['Please enter a Google Doc URL'])
      return
    }

    // Check max files limit
    if (documents.length >= maxFiles) {
      setErrors([`Maximum ${maxFiles} files allowed`])
      return
    }

    setImportingGoogleDoc(true)
    setErrors([])

    try {
      const response = await fetch('/api/admin/google-docs/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: googleDocUrl.trim() }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to import Google Doc')
      }

      const result = await response.json()
      onChange([...documents, result.document])
      setGoogleDocUrl('') // Clear input after successful import
    } catch (error) {
      setErrors([
        `Failed to import Google Doc: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ])
    } finally {
      setImportingGoogleDoc(false)
    }
  }

  const handleEditTitle = (document: DocumentAttachment) => {
    setEditingId(document.id)
    setEditingName(document.originalName)
  }

  const handleSaveTitle = (document: DocumentAttachment) => {
    if (editingName.trim()) {
      const updatedDocuments = documents.map((doc) =>
        doc.id === document.id ? { ...doc, originalName: editingName.trim() } : doc
      )
      onChange(updatedDocuments)
    }
    setEditingId(null)
    setEditingName('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const newDocuments = [...documents]
    const [draggedDocument] = newDocuments.splice(draggedIndex, 1)
    newDocuments.splice(dropIndex, 0, draggedDocument)

    onChange(newDocuments)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <YStack gap="$3">
      {/* Google Doc URL Import */}
      {documents.length < maxFiles && (
        <YStack gap="$2">
          <Text fontSize="$4" fontWeight="500" color="$gray12">
            Insert Google Doc URL
          </Text>
          <XStack gap="$2" alignItems="center">
            <Input
              flex={1}
              value={googleDocUrl}
              onChangeText={setGoogleDocUrl}
              placeholder="https://docs.google.com/document/d/..."
              disabled={disabled || importingGoogleDoc}
              onSubmitEditing={handleImportGoogleDoc}
            />
            <Button
              size="$3"
              theme="blue"
              icon={importingGoogleDoc ? <Spinner size="small" /> : <Link2 size={16} />}
              onPress={handleImportGoogleDoc}
              disabled={disabled || importingGoogleDoc || !googleDocUrl.trim()}
            >
              {importingGoogleDoc ? 'Importing...' : 'Import'}
            </Button>
          </XStack>
          <Text fontSize="$3" color="$gray10">
            Paste a link to a Google Doc, Sheet, or Slides. We'll ensure it's viewable by everyone.
          </Text>
        </YStack>
      )}

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

          {documents.map((document, index) => {
            const isGoogleDoc = document.documentType === 'google-doc'
            const isEditing = editingId === document.id
            const isDragging = draggedIndex === index
            const isDragOver = dragOverIndex === index

            return (
              <XStack
                key={document.id}
                gap="$3"
                alignItems="center"
                padding="$3"
                backgroundColor={isGoogleDoc ? '$blue2' : '$gray2'}
                borderRadius="$3"
                borderWidth={isDragOver ? 2 : isGoogleDoc ? 1 : 0}
                borderColor={isDragOver ? '$blue8' : isGoogleDoc ? '$blue5' : 'transparent'}
                opacity={isDragging ? 0.5 : 1}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                cursor={isDragging ? 'grabbing' : 'grab'}
              >
                {/* Drag Handle */}
                <GripVertical size={20} color="$gray10" cursor="grab" />

                {isGoogleDoc ? (
                  <FileText size={20} color="$blue10" />
                ) : (
                  <File size={20} color="$blue10" />
                )}

                <YStack flex={1} gap="$1">
                  {isEditing ? (
                    <XStack gap="$2" alignItems="center">
                      <Input
                        flex={1}
                        value={editingName}
                        onChangeText={setEditingName}
                        size="$3"
                        onSubmitEditing={() => handleSaveTitle(document)}
                        autoFocus
                      />
                      <Button
                        size="$2"
                        theme="green"
                        onPress={() => handleSaveTitle(document)}
                      >
                        Save
                      </Button>
                      <Button
                        size="$2"
                        variant="outlined"
                        onPress={handleCancelEdit}
                      >
                        Cancel
                      </Button>
                    </XStack>
                  ) : (
                    <>
                      <XStack gap="$2" alignItems="center">
                        <Text fontSize="$4" fontWeight="500" color="$gray12">
                          {document.originalName}
                        </Text>
                        {isGoogleDoc && document.editable && (
                          <Button
                            size="$2"
                            chromeless
                            icon={<Pencil size={14} />}
                            onPress={() => handleEditTitle(document)}
                            padding="$1"
                          />
                        )}
                      </XStack>
                      <Text fontSize="$3" color="$gray10">
                        {isGoogleDoc ? (
                          <>
                            <Link2 size={12} /> Google Doc •{' '}
                            {new Date(document.uploadedAt).toLocaleDateString()}
                          </>
                        ) : (
                          <>
                            {formatFileSize(document.fileSize)} •{' '}
                            {new Date(document.uploadedAt).toLocaleDateString()}
                          </>
                        )}
                      </Text>
                    </>
                  )}
                </YStack>

                {uploading.includes(document.fileName) ? (
                  <Spinner size="small" />
                ) : (
                  !isEditing && (
                    <Button
                      size="$2"
                      chromeless
                      icon={<X size={16} />}
                      onPress={() => handleRemove(document)}
                      disabled={disabled}
                    />
                  )
                )}
              </XStack>
            )
          })}
        </YStack>
      )}
    </YStack>
  )
}
