import { useState } from 'react'
import { YStack, XStack, Text, Card, Input, Separator } from '@my/ui'
import { Image } from 'tamagui'
import { Button } from '../Button'
import { Globe, Youtube, Pencil, Save, X, Plus, Trash, ExternalLink, Newspaper } from '@tamagui/lucide-icons'
import { ImageUpload } from '../form/image-upload'

export interface ExternalLinksData {
  website?: string
  externalLinks?: {
    newsletterUrl?: string
    youtube?: string
    facebook?: string
    otherLinks?: Array<{ label: string; url: string }>
  }
  logoUrl?: string
}

interface ExternalLinksCardProps {
  data: ExternalLinksData
  canEdit: boolean
  onSave?: (updates: ExternalLinksData) => Promise<boolean>
}

export function ExternalLinksCard({ data, canEdit, onSave }: ExternalLinksCardProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [editWebsite, setEditWebsite] = useState(data.website || '')
  const [editNewsletter, setEditNewsletter] = useState(data.externalLinks?.newsletterUrl || '')
  const [editYoutube, setEditYoutube] = useState(data.externalLinks?.youtube || '')
  const [editFacebook, setEditFacebook] = useState(data.externalLinks?.facebook || '')
  const [editOtherLinks, setEditOtherLinks] = useState<Array<{ label: string; url: string }>>(
    data.externalLinks?.otherLinks || []
  )

  const startEditing = () => {
    setEditWebsite(data.website || '')
    setEditNewsletter(data.externalLinks?.newsletterUrl || '')
    setEditYoutube(data.externalLinks?.youtube || '')
    setEditFacebook(data.externalLinks?.facebook || '')
    setEditOtherLinks([...(data.externalLinks?.otherLinks || [])])
    setEditLogoUrl(data.logoUrl || '')
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
  }

  const [editLogoUrl, setEditLogoUrl] = useState(data.logoUrl || '')

  const handleSave = async () => {
    if (!onSave) return
    setSaving(true)
    try {
      const updates: ExternalLinksData = {
        website: editWebsite.trim() || undefined,
        externalLinks: {
          newsletterUrl: editNewsletter.trim() || undefined,
          youtube: editYoutube.trim() || undefined,
          facebook: editFacebook.trim() || undefined,
          otherLinks: editOtherLinks.filter((l) => l.label.trim() && l.url.trim()),
        },
        logoUrl: editLogoUrl.trim() || undefined,
      }
      const success = await onSave(updates)
      if (success) {
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const addOtherLink = () => {
    setEditOtherLinks([...editOtherLinks, { label: '', url: '' }])
  }

  const removeOtherLink = (index: number) => {
    setEditOtherLinks(editOtherLinks.filter((_, i) => i !== index))
  }

  const updateOtherLink = (index: number, field: 'label' | 'url', value: string) => {
    const updated = [...editOtherLinks]
    updated[index] = { ...updated[index], [field]: value }
    setEditOtherLinks(updated)
  }

  const hasLinks =
    data.website ||
    data.externalLinks?.newsletterUrl ||
    data.externalLinks?.youtube ||
    data.externalLinks?.facebook ||
    (data.externalLinks?.otherLinks && data.externalLinks.otherLinks.length > 0)

  const hasContent = hasLinks || data.logoUrl

  if (!hasContent && !canEdit) {
    return null
  }

  return (
    <Card padding="$4" borderWidth={1} borderColor="$borderColor">
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <XStack gap="$2" alignItems="center">
            <Globe size={16} color="$blue10" />
            <Text fontSize="$5" fontWeight="600">Links &amp; Resources</Text>
          </XStack>
          {canEdit && !editing ? (
            <Button size="$2" icon={Pencil} variant="outlined" onPress={startEditing}>
              Edit
            </Button>
          ) : null}
        </XStack>

        {editing ? (
          <YStack gap="$3">
            <YStack gap="$1">
              <Text fontSize="$3" fontWeight="600">Website</Text>
              <Input
                value={editWebsite}
                onChangeText={setEditWebsite}
                placeholder="https://example.com"
                autoCapitalize="none"
              />
            </YStack>
            <YStack gap="$1">
              <Text fontSize="$3" fontWeight="600">Newsletter URL</Text>
              <Input
                value={editNewsletter}
                onChangeText={setEditNewsletter}
                placeholder="https://example.com/newsletter"
                autoCapitalize="none"
              />
            </YStack>
            <YStack gap="$1">
              <Text fontSize="$3" fontWeight="600">YouTube Channel</Text>
              <Input
                value={editYoutube}
                onChangeText={setEditYoutube}
                placeholder="https://youtube.com/@channel"
                autoCapitalize="none"
              />
            </YStack>
            <YStack gap="$1">
              <Text fontSize="$3" fontWeight="600">Facebook Page</Text>
              <Input
                value={editFacebook}
                onChangeText={setEditFacebook}
                placeholder="https://facebook.com/page"
                autoCapitalize="none"
              />
            </YStack>

            <Separator />
            <YStack gap="$1">
              <Text fontSize="$3" fontWeight="600">Ecclesia Logo</Text>
              <ImageUpload
                value={editLogoUrl ? {
                  url: editLogoUrl,
                  fileName: 'logo',
                  originalName: 'Ecclesia Logo',
                  uploadedAt: new Date(),
                } : undefined}
                onChange={(img) => setEditLogoUrl(img?.url || '')}
                label=""
                placeholder="Upload your ecclesia logo"
                maxSizeBytes={5 * 1024 * 1024}
              />
            </YStack>

            <Separator />
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$4" fontWeight="600">Other Links</Text>
              <Button size="$2" icon={Plus} variant="outlined" onPress={addOtherLink}>
                Add Link
              </Button>
            </XStack>
            {editOtherLinks.map((link, index) => (
              <XStack key={index} gap="$2" alignItems="center">
                <YStack gap="$1" flex={1}>
                  <Input
                    value={link.label}
                    onChangeText={(v: string) => updateOtherLink(index, 'label', v)}
                    placeholder="Label"
                    size="$3"
                  />
                </YStack>
                <YStack gap="$1" flex={2}>
                  <Input
                    value={link.url}
                    onChangeText={(v: string) => updateOtherLink(index, 'url', v)}
                    placeholder="https://..."
                    autoCapitalize="none"
                    size="$3"
                  />
                </YStack>
                <Button
                  size="$2"
                  icon={Trash}
                  theme="red"
                  variant="outlined"
                  onPress={() => removeOtherLink(index)}
                />
              </XStack>
            ))}

            <XStack gap="$2" justifyContent="flex-end">
              <Button icon={X} onPress={cancelEditing} disabled={saving}>
                Cancel
              </Button>
              <Button icon={saving ? undefined : Save} theme="blue" onPress={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </XStack>
          </YStack>
        ) : (
          <YStack gap="$2">
            {data.logoUrl ? (
              <YStack alignItems="center" paddingVertical="$2">
                <Image
                  source={{ uri: data.logoUrl }}
                  width={120}
                  height={120}
                  style={{ width: 120, height: 120 }}
                  resizeMode="contain"
                  borderRadius={8}
                />
              </YStack>
            ) : null}
            {data.website ? (
              <LinkRow icon={<Globe size={14} color="$blue10" />} label="Website" url={data.website} />
            ) : null}
            {data.externalLinks?.newsletterUrl ? (
              <LinkRow icon={<Newspaper size={14} color="$orange10" />} label="Newsletter" url={data.externalLinks.newsletterUrl} />
            ) : null}
            {data.externalLinks?.youtube ? (
              <LinkRow icon={<Youtube size={14} color="$red10" />} label="YouTube" url={data.externalLinks.youtube} />
            ) : null}
            {data.externalLinks?.facebook ? (
              <LinkRow icon={<Globe size={14} color="$blue10" />} label="Facebook" url={data.externalLinks.facebook} />
            ) : null}
            {data.externalLinks?.otherLinks?.map((link, i) => (
              <LinkRow key={i} icon={<ExternalLink size={14} color="$gray10" />} label={link.label} url={link.url} />
            ))}
            {!hasLinks ? (
              <Text fontSize="$3" theme="alt2">No external links added yet.</Text>
            ) : null}
          </YStack>
        )}
      </YStack>
    </Card>
  )
}

function LinkRow({ icon, label, url }: { icon: React.ReactNode; label: string; url: string }) {
  return (
    <XStack gap="$2" alignItems="center">
      {icon}
      <Text fontSize="$3" fontWeight="600" minWidth={80}>{label}</Text>
      <Text fontSize="$3" color="$blue10" numberOfLines={1} flex={1}>
        {url}
      </Text>
    </XStack>
  )
}
