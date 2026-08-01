import type { OccasionTag, Visibility } from '@my/app/types/post'

/** Sentinel value for a block that inherits the post's visibility (no override). */
export const INHERIT_VISIBILITY = ''

export interface Option {
  value: string
  label: string
}

/** Post reach ladder (design §8.4). */
export const VISIBILITY_OPTIONS: Array<{ value: Visibility; label: string }> = [
  { value: 'public', label: 'Public' },
  { value: 'recognized', label: 'Recognized' },
  { value: 'members', label: 'Members' },
  { value: 'admins', label: 'Admins' },
]

/** Per-block visibility override options — with an explicit "inherit" choice. */
export const BLOCK_VISIBILITY_OPTIONS: Option[] = [
  { value: INHERIT_VISIBILITY, label: 'Inherit from post' },
  ...VISIBILITY_OPTIONS,
]

/** Occasion is DATA (design §8.5) — free-combining tags, no code path per one. */
export const OCCASION_OPTIONS: Array<{ value: OccasionTag; label: string }> = [
  { value: 'general', label: 'General' },
  { value: 'news', label: 'News' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'baptism', label: 'Baptism' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'shower', label: 'Shower' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'funeral', label: 'Funeral' },
  { value: 'medical', label: 'Medical' },
  { value: 'study-weekend', label: 'Study weekend' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'election-cycle', label: 'Election cycle' },
]
