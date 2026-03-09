// Shared types for the unified directory system

export type PrivacyLevel = 'authenticated' | 'ecclesia_and_connections' | 'connections_only' | 'private'

export interface MemberPrivacy {
  showName: PrivacyLevel
  showEmail: PrivacyLevel
  showPhone: PrivacyLevel
  showAddress: PrivacyLevel
  showFamily: PrivacyLevel
}

export interface DirectoryMember {
  id: string
  email: string
  name: string
  ecclesia?: string
  canViewDetails?: boolean
  privacy?: MemberPrivacy
  emails?: Array<{ email: string; emailType: string }>
}

export interface DraftMember {
  draftId: string
  firstName: string
  lastName: string
  email: string
  ecclesia: string
  createdBy: string
  createdByName: string
  createdAt: string
}

export interface NominationSecond {
  email: string
  name: string
  at: string
}

export interface Nomination {
  nominationId: string
  ecclesia: string
  nomineeEmail: string
  nomineeName: string
  nominatedBy: string
  nominatedByName: string
  seconds: NominationSecond[]
  secondsNeeded: number
  status: string
  emailPreference?: 'personal' | 'ecclesia'
  rbEcclesiaEmail?: string
  directSet?: boolean
  confirmationSentAt?: string
  createdAt: string
}

export interface EcclesiaService {
  id: string
  name: string
  type: string
  day?: string
  time?: string
  location?: string
}

export interface EcclesiaExternalLinks {
  newsletterUrl?: string
  youtube?: string
  facebook?: string
  otherLinks?: Array<{ label: string; url: string }>
}

export interface EcclesiaListItem {
  id: string
  name: string
  city?: string
  province?: string
  country?: string
  address?: string
  postalCode?: string
  venue?: string
  phone?: string
  recordingBrotherEmail?: string
  recordingBrotherName?: string
  recordingBrotherPersonId?: string
  services?: EcclesiaService[]
  hall?: {
    name?: string
    address?: string
    city?: string
    province?: string
    postalCode?: string
    country?: string
    parkingInfo?: string
  }
  contactEmail?: string
  contactPhone?: string
  website?: string
  externalLinks?: EcclesiaExternalLinks
  memberCount?: number
}

export interface GuestUser {
  id: string
  email: string
  name: string
  lastName: string
  ecclesia?: string
  createdAt: string
}

export interface DirectoryAuthProps {
  isMemberOrHigher: boolean
  isRecorderOrHigher: boolean
  isAdminOrOwner: boolean
  currentUserEmail: string
  viewerEcclesia: string | null
}
