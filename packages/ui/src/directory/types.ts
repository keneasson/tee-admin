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

/** The Recording Brother office as the API returns it. The holder is a person reference; the office stores no name. */
export interface RecordingBrotherSummary {
  personId?: string
  name?: string
  email?: string
}

/** One office of an ecclesia (Recording Brother, Rep n, …). */
export interface OfficeSummary {
  officeId: string
  kind: string
  title: string
  email?: string
  phone?: string
  emailVia?: 'office' | 'holder' | 'none'
  holderPersonId?: string
  holderName?: string
  holderSince?: string
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
  ecclesiaId?: string
  /** The ecclesia's Recording Brother OFFICE, resolved server-side (holder name + office inbox or holder address). */
  recordingBrother?: RecordingBrotherSummary | null
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
  logoUrl?: string
  memberCount?: number
  // Multi-tenant fields
  timezone?: string
  latitude?: number
  longitude?: number
  sharingPreference?: 'open' | 'subscribers-only' | 'private'
  sharingRadiusKm?: number
  nearbyEcclesias?: string[]
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
