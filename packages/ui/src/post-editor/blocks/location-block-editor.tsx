import { YStack, XStack, Label, Text, Input, TextArea } from 'tamagui'
import type { LocationBlock } from '@my/app/types/post'
import type { OnlineMeetingInfo } from '@my/app/types/events'
import { PLATFORM_DISPLAY_NAMES } from '@my/app/types/events'
import type { BlockEditorProps } from '../registry'
import { genId } from '../post-reducer'
import { PlainSelect } from '../plain-select'
import { PlainCheckbox } from '../plain-checkbox'

/**
 * LocationBlock editor — geo-aware address | plain text address | inherit
 * from an ecclesia. `venueName`/`city`/`province`/`country` are the anon-safe
 * floor; `address`/`postalCode`/`lat`/`lng`/`directions`/`parkingInfo`/
 * `mapsUrl` are `location-precise` (coarsened/hidden for anon — the redactor
 * handles that, this editor just captures the fields). A `privateResidence`
 * block is dropped ENTIRELY for anon (design §8.1) — the toggle here just
 * records the author's intent.
 *
 * TODO(2c+): `lat`/`lng` are plain numeric inputs — a map picker (Google
 * Places, matching the event location form) is out of scope for this pass.
 */
export function makeLocationBlock(): LocationBlock {
  return { id: genId(), kind: 'location', mode: 'plain' }
}

const MODE_OPTIONS: Array<{ value: LocationBlock['mode']; label: string }> = [
  { value: 'plain', label: 'Plain address' },
  { value: 'geo', label: 'Geo-located address' },
  { value: 'ecclesia', label: 'Inherit from ecclesia' },
]

const PLATFORM_OPTIONS = Object.entries(PLATFORM_DISPLAY_NAMES)
  .filter(([value]) => value !== 'other') // legacy alias for custom-stream
  .map(([value, label]) => ({ value, label }))

function emptyOnlineMeeting(): OnlineMeetingInfo {
  return { link: '' }
}

export function LocationBlockEditor({ block, onChange }: BlockEditorProps<LocationBlock>) {
  const hasOnlineMeeting = block.onlineMeeting !== undefined

  const patchOnlineMeeting = (patch: Partial<OnlineMeetingInfo>) => {
    onChange({ ...block, onlineMeeting: { ...(block.onlineMeeting ?? emptyOnlineMeeting()), ...patch } })
  }

  return (
    <YStack gap="$3">
      <XStack gap="$4" flexWrap="wrap">
        <YStack minWidth={220} flex={1}>
          <PlainSelect
            id={`${block.id}-mode`}
            label="Mode"
            value={block.mode}
            options={MODE_OPTIONS}
            onValueChange={(mode) => onChange({ ...block, mode: mode as LocationBlock['mode'] })}
          />
        </YStack>

        <YStack minWidth={200} flex={1} gap="$2">
          <Label htmlFor={`${block.id}-label`} fontSize="$3" fontWeight="600">
            Label
          </Label>
          <Input
            id={`${block.id}-label`}
            value={block.label ?? ''}
            onChangeText={(label) => onChange({ ...block, label })}
            placeholder="e.g. Service, Visitation, Ceremony, Reception"
          />
        </YStack>
      </XStack>

      {block.mode === 'ecclesia' ? (
        <YStack gap="$2">
          <Label htmlFor={`${block.id}-ecclesia-ref`} fontSize="$3" fontWeight="600">
            Ecclesia
          </Label>
          <Input
            id={`${block.id}-ecclesia-ref`}
            value={block.ecclesiaRef ?? ''}
            onChangeText={(ecclesiaRef) => onChange({ ...block, ecclesiaRef })}
            placeholder="Ecclesia id or name"
          />
          <Text fontSize="$2" color="$color10">
            Address details are inherited from the referenced ecclesia at read time.
          </Text>
        </YStack>
      ) : (
        <YStack gap="$3">
          <YStack gap="$2">
            <Label htmlFor={`${block.id}-venue`} fontSize="$3" fontWeight="600">
              Venue name
            </Label>
            <Input
              id={`${block.id}-venue`}
              value={block.venueName ?? ''}
              onChangeText={(venueName) => onChange({ ...block, venueName })}
              placeholder="e.g. Toronto East Hall"
            />
          </YStack>

          <YStack gap="$2">
            <Label htmlFor={`${block.id}-address`} fontSize="$3" fontWeight="600">
              Street address
            </Label>
            <Input
              id={`${block.id}-address`}
              value={block.address ?? ''}
              onChangeText={(address) => onChange({ ...block, address })}
              placeholder="e.g. 123 Main Street"
            />
          </YStack>

          <XStack gap="$3" flexWrap="wrap">
            <YStack flex={1} minWidth={140} gap="$2">
              <Label htmlFor={`${block.id}-city`} fontSize="$3" fontWeight="600">
                City
              </Label>
              <Input
                id={`${block.id}-city`}
                value={block.city ?? ''}
                onChangeText={(city) => onChange({ ...block, city })}
                placeholder="City"
              />
            </YStack>
            <YStack flex={1} minWidth={140} gap="$2">
              <Label htmlFor={`${block.id}-province`} fontSize="$3" fontWeight="600">
                Province/State
              </Label>
              <Input
                id={`${block.id}-province`}
                value={block.province ?? ''}
                onChangeText={(province) => onChange({ ...block, province })}
                placeholder="Province/State"
              />
            </YStack>
          </XStack>

          <XStack gap="$3" flexWrap="wrap">
            <YStack flex={1} minWidth={140} gap="$2">
              <Label htmlFor={`${block.id}-postal`} fontSize="$3" fontWeight="600">
                Postal/Zip code
              </Label>
              <Input
                id={`${block.id}-postal`}
                value={block.postalCode ?? ''}
                onChangeText={(postalCode) => onChange({ ...block, postalCode })}
                placeholder="Postal/Zip code"
              />
            </YStack>
            <YStack flex={1} minWidth={140} gap="$2">
              <Label htmlFor={`${block.id}-country`} fontSize="$3" fontWeight="600">
                Country
              </Label>
              <Input
                id={`${block.id}-country`}
                value={block.country ?? ''}
                onChangeText={(country) => onChange({ ...block, country })}
                placeholder="Country"
              />
            </YStack>
          </XStack>

          {block.mode === 'geo' ? (
            <XStack gap="$3" flexWrap="wrap">
              <YStack flex={1} minWidth={140} gap="$2">
                <Label htmlFor={`${block.id}-lat`} fontSize="$3" fontWeight="600">
                  Latitude
                </Label>
                <Input
                  id={`${block.id}-lat`}
                  value={block.lat !== undefined ? String(block.lat) : ''}
                  onChangeText={(v) => {
                    const lat = v.trim() === '' ? undefined : Number(v)
                    onChange({ ...block, lat: lat !== undefined && Number.isNaN(lat) ? undefined : lat })
                  }}
                  placeholder="e.g. 43.6532"
                  keyboardType="numeric"
                />
              </YStack>
              <YStack flex={1} minWidth={140} gap="$2">
                <Label htmlFor={`${block.id}-lng`} fontSize="$3" fontWeight="600">
                  Longitude
                </Label>
                <Input
                  id={`${block.id}-lng`}
                  value={block.lng !== undefined ? String(block.lng) : ''}
                  onChangeText={(v) => {
                    const lng = v.trim() === '' ? undefined : Number(v)
                    onChange({ ...block, lng: lng !== undefined && Number.isNaN(lng) ? undefined : lng })
                  }}
                  placeholder="e.g. -79.3832"
                  keyboardType="numeric"
                />
              </YStack>
            </XStack>
          ) : null}
          {block.mode === 'geo' ? (
            <Text fontSize="$2" color="$color10">
              TODO: replace with a map picker (Google Places) — plain numeric inputs for now.
            </Text>
          ) : null}

          <YStack gap="$2">
            <Label htmlFor={`${block.id}-directions`} fontSize="$3" fontWeight="600">
              Directions
            </Label>
            <TextArea
              id={`${block.id}-directions`}
              value={block.directions ?? ''}
              onChangeText={(directions) => onChange({ ...block, directions })}
              placeholder="Directions or landmarks"
              minHeight={60}
              numberOfLines={2}
            />
          </YStack>

          <YStack gap="$2">
            <Label htmlFor={`${block.id}-parking`} fontSize="$3" fontWeight="600">
              Parking info
            </Label>
            <TextArea
              id={`${block.id}-parking`}
              value={block.parkingInfo ?? ''}
              onChangeText={(parkingInfo) => onChange({ ...block, parkingInfo })}
              placeholder="Parking availability and instructions"
              minHeight={60}
              numberOfLines={2}
            />
          </YStack>

          <YStack gap="$2">
            <Label htmlFor={`${block.id}-maps-url`} fontSize="$3" fontWeight="600">
              Maps URL
            </Label>
            <Input
              id={`${block.id}-maps-url`}
              value={block.mapsUrl ?? ''}
              onChangeText={(mapsUrl) => onChange({ ...block, mapsUrl })}
              placeholder="https://maps.google.com/…"
              autoCapitalize="none"
            />
          </YStack>
        </YStack>
      )}

      <PlainCheckbox
        checked={block.privateResidence ?? false}
        onCheckedChange={(privateResidence) => onChange({ ...block, privateResidence })}
        label="This is a private residence (hidden entirely from anonymous viewers)"
      />

      <YStack gap="$2">
        <PlainCheckbox
          checked={hasOnlineMeeting}
          onCheckedChange={(checked) =>
            onChange({ ...block, onlineMeeting: checked ? emptyOnlineMeeting() : undefined })
          }
          label="Include an online meeting"
        />

        {hasOnlineMeeting ? (
          <YStack gap="$3" paddingLeft="$4">
            <YStack gap="$2">
              <Label htmlFor={`${block.id}-om-link`} fontSize="$3" fontWeight="600">
                Meeting link
              </Label>
              <Input
                id={`${block.id}-om-link`}
                value={block.onlineMeeting?.link ?? ''}
                onChangeText={(link) => patchOnlineMeeting({ link })}
                placeholder="https://…"
                autoCapitalize="none"
              />
            </YStack>

            <XStack gap="$3" flexWrap="wrap">
              <YStack flex={1} minWidth={180}>
                <PlainSelect
                  id={`${block.id}-om-platform`}
                  label="Platform"
                  value={block.onlineMeeting?.platform ?? ''}
                  options={PLATFORM_OPTIONS}
                  placeholder="Select…"
                  onValueChange={(platform) => patchOnlineMeeting({ platform })}
                />
              </YStack>
              <YStack flex={1} minWidth={140} gap="$2">
                <Label htmlFor={`${block.id}-om-id`} fontSize="$3" fontWeight="600">
                  Meeting ID
                </Label>
                <Input
                  id={`${block.id}-om-id`}
                  value={block.onlineMeeting?.meetingId ?? ''}
                  onChangeText={(meetingId) => patchOnlineMeeting({ meetingId })}
                  placeholder="Meeting ID"
                />
              </YStack>
              <YStack flex={1} minWidth={140} gap="$2">
                <Label htmlFor={`${block.id}-om-password`} fontSize="$3" fontWeight="600">
                  Password
                </Label>
                <Input
                  id={`${block.id}-om-password`}
                  value={block.onlineMeeting?.password ?? ''}
                  onChangeText={(password) => patchOnlineMeeting({ password })}
                  placeholder="Passcode"
                />
              </YStack>
            </XStack>

            <YStack gap="$2">
              <Label htmlFor={`${block.id}-om-dialin`} fontSize="$3" fontWeight="600">
                Dial-in number
              </Label>
              <Input
                id={`${block.id}-om-dialin`}
                value={block.onlineMeeting?.dialInNumber ?? ''}
                onChangeText={(dialInNumber) => patchOnlineMeeting({ dialInNumber })}
                placeholder="Phone dial-in"
              />
            </YStack>

            <YStack gap="$2">
              <Label htmlFor={`${block.id}-om-info`} fontSize="$3" fontWeight="600">
                Additional info
              </Label>
              <TextArea
                id={`${block.id}-om-info`}
                value={block.onlineMeeting?.additionalInfo ?? ''}
                onChangeText={(additionalInfo) => patchOnlineMeeting({ additionalInfo })}
                minHeight={60}
                numberOfLines={2}
              />
            </YStack>
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  )
}
