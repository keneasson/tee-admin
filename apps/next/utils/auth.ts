import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { DynamoDBAdapter } from '@auth/dynamodb-adapter'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import NextAuth, { type NextAuthConfig, type User, type Session } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import GoogleProvider from 'next-auth/providers/google'
import FacebookProvider from 'next-auth/providers/facebook'
import CredentialsProvider from 'next-auth/providers/credentials'
import { headers } from 'next/headers'
import { jwtVerify } from 'jose'

import { getAwsDbConfig } from './email/sesClient'
import { addUsersRoleToDB } from './dynamodb/set-user-role'
import { getUserFromDynamoDB } from './dynamodb/get-user'

import { ROLES } from '@my/app/provider/auth/auth-roles'
import {
  getRoleFromLegacyUser,
  getUserFromLegacyDirectory,
} from '@my/app/provider/auth/get-user-from-legacy'
import { verifyCredentialsUser, findCredentialsUserByEmail } from './dynamodb/credentials-users'
import { personRepository, type GoogleOAuthProfile } from '@my/app/provider/dynamodb/repositories/person-repository'
import { tokenRepository } from '@my/app/provider/dynamodb/repositories/token-repository'
import { verifyEcclesiaToken } from './email/ecclesia-token'
import { getEcclesiaByRecordingBrotherEmail } from './dynamodb/locations'

// Feature flag for unified people system - uses PersonRecord instead of scan-based USER# lookups
const USE_UNIFIED_PEOPLE = process.env.UNIFIED_PEOPLE_AUTH === 'true'

export const nextAuthDynamoDb = {
  tableName: 'tee-admin',
  partitionKey: 'pkey',
  sortKey: 'skey',
  indexName: 'gsi1',
  indexPartitionKey: 'gsi1pk',
  indexSortKey: 'gsi1sk',
}

const dbClientConfig = getAwsDbConfig()

const client = DynamoDBDocument.from(new DynamoDB(dbClientConfig), {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
})

// Providers are assembled here so optional OAuth providers can be added
// conditionally — only when their credentials are actually configured. This
// keeps builds and runtime healthy while a provider is un-provisioned.
const authProviders: NextAuthConfig['providers'] = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  }),
]

// Facebook — only registered when BOTH the App ID and App Secret are present.
// Unconfigured, the provider is simply absent (no dead callback route), Google
// has no `authorize` step so Facebook (also OAuth) resolves the PersonRecord via
// the shared signIn/jwt callbacks and defaults to `assurance: 'authenticated'`.
if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  authProviders.push(
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    })
  )
}

export const authOptions: NextAuthConfig = {
  trustHost: true,
  session: {
    strategy: 'jwt' as const,
  },
  providers: [
    ...authProviders,
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await verifyCredentialsUser(
          credentials.email as string,
          credentials.password as string
        )

        if (user) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            provider: 'credentials',
            // Password is a freshly-proven credential → full authority.
            assurance: 'authenticated',
          }
        }

        return null
      },
    }),
    CredentialsProvider({
      id: 'otp',
      name: 'OTP',
      credentials: {
        email: { label: 'Email', type: 'email' },
        otpToken: { label: 'OTP Token', type: 'text' },
        ecclesiaToken: { label: 'Ecclesia Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null

        const email = (credentials.email as string).toLowerCase().trim()

        // Ecclesia token flow
        if (credentials.ecclesiaToken) {
          const tokenResult = await verifyEcclesiaToken(credentials.ecclesiaToken as string)
          if (!tokenResult.valid || tokenResult.email?.toLowerCase() !== email) {
            return null
          }

          // Look up or create PersonRecord
          let person = await personRepository.getByEmail(email)
          if (!person) {
            // Check if this email is a Recording Brother — auto-assign member role + ecclesia
            const rbEcclesia = await getEcclesiaByRecordingBrotherEmail(email)
            const rbRole = rbEcclesia ? 'member' : 'guest'
            const rbEcclesiaName = rbEcclesia?.name || 'Unknown'

            if (rbEcclesia) {
              console.log('📋 OTP: Recording Brother detected for', rbEcclesiaName, '— assigning member role')
            }

            const created = await personRepository.create({
              email,
              firstName: rbEcclesia?.recordingBrotherName || '',
              lastName: '',
              ecclesia: rbEcclesiaName,
              memberStatus: rbEcclesia ? 'member' : 'visitor',
              role: rbRole,
              provider: 'credentials',
            })
            await personRepository.markEmailVerified(created.personId)
            person = await personRepository.getByEmail(email)
          }

          if (!person) return null

          const role = person.role
            || (person.memberStatus === 'member' || person.isInterEcclesiaRep ? 'member' : undefined)
            || 'guest'

          return {
            id: person.personId,
            email: person.primaryEmail,
            name: person.displayName || person.primaryEmail,
            role,
            provider: 'otp',
            // Ecclesia token is a long-lived, forwardable bearer credential
            // embedded in bulk email. It proves recognition, NOT authority —
            // the holder may be a forward recipient, not the addressee. See #80.
            assurance: 'recognized',
          }
        }

        // OTP token flow (email sign-up/sign-in)
        if (credentials.otpToken) {
          // The OTP has already been verified by the API route
          // Look up the full person record to get role (which may have been
          // derived from memberStatus/isInterEcclesiaRep during verification)
          const person = await personRepository.getByEmail(email)
          if (!person) return null

          // Derive role if still missing (belt and suspenders)
          const role = person.role
            || (person.memberStatus === 'member' || person.isInterEcclesiaRep ? 'member' : undefined)
            || 'guest'

          return {
            id: person.personId,
            email: person.primaryEmail,
            name: person.displayName || person.primaryEmail,
            role,
            provider: 'otp',
            // A completed OTP (single-use, 10-min, sent to the on-file address)
            // is a fresh proof of inbox control → full authority.
            assurance: 'authenticated',
          }
        }

        return null
      },
    }),
  ],
  // adapter: DynamoDBAdapter(client, nextAuthDynamoDb), // Disabled - causes session issues with credentials provider
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      // On sign-in, try to get role from the user object (set by signIn callback)
      if (user) {
        const userRole = (user as User & { role?: string }).role
        if (userRole) {
          token.role = userRole
        }

        // Assurance level (#80). Fresh sign-in stamps the trust tier + auth time.
        // Credentials/OTP/ecclesia paths set `assurance` explicitly; Google (no
        // authorize step) and any credential that omits it default to
        // 'authenticated' — only the forwardable ecclesia-token path is
        // downgraded to 'recognized'.
        const userAssurance = (user as User & { assurance?: string }).assurance
        ;(token as JWT & { assuranceLevel?: string }).assuranceLevel =
          userAssurance === 'recognized' ? 'recognized' : 'authenticated'
        ;(token as JWT & { authTime?: number }).authTime = Date.now()
      } else if (!(token as JWT & { assuranceLevel?: string }).assuranceLevel) {
        // Grandfather sessions minted before #80: treat as authenticated so we
        // don't lock out anyone currently signed in. Going forward, only the
        // ecclesia-token path mints 'recognized', so this default is safe.
        ;(token as JWT & { assuranceLevel?: string }).assuranceLevel = 'authenticated'
      }

      // Always refresh name, role, and RB designation from PersonRecord.
      // This keeps the JWT in sync when admins change a user's name or role.
      if (token.email) {
        try {
          const person = await personRepository.getByEmailForAuth(token.email as string)
          if (person) {
            // Derive role: explicit role → memberStatus/isInterEcclesiaRep → keep existing
            const derivedRole = person.role
              || (person.memberStatus === 'member' || person.isInterEcclesiaRep ? ROLES.MEMBER : undefined)
            if (derivedRole) {
              token.role = derivedRole
            }
            if (person.displayName) {
              token.name = person.displayName
            }
            // Home ecclesia — surfaced in the navigation header
            if (person.ecclesia) {
              ;(token as JWT & { ecclesia?: string }).ecclesia = person.ecclesia
            }
            // RB is a designation, not a role — sync to JWT
            token.isRecordingBrother = !!person.isRecordingBrother
          } else if (!token.role) {
            // Only check RB fallback if we still have no role
            const rbEcclesia = await getEcclesiaByRecordingBrotherEmail(token.email as string)
            if (rbEcclesia) {
              console.log('📋 JWT callback: Recording Brother for', rbEcclesia.name, '→ member')
              token.role = ROLES.MEMBER
            }
          }
        } catch (e) {
          console.error('⚠️ JWT callback: PersonRecord lookup failed:', e)
          // On error, keep existing token values rather than resetting
        }
      }
      return token
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
    async signIn({ user, profile }: { user: User; profile?: Record<string, unknown> }) {
      // Extended user type to include custom properties
      const extUser = user as User & { provider?: string; role?: string }

      // For credentials and OTP users, we already have the role, so just return true
      if (extUser.provider === 'credentials' || extUser.provider === 'otp') {
        return true
      }

      // For other providers (like Google), check if user already has role
      if (extUser.role) {
        return true
      }

      const userEmail = user.email || (profile?.email as string | undefined)
      if (!userEmail) {
        return true
      }

      try {
        console.log('🔑 SignIn callback for:', userEmail, USE_UNIFIED_PEOPLE ? '(unified people)' : '(legacy)')

        // ===== UNIFIED PEOPLE SYSTEM (Feature Flagged) =====
        if (USE_UNIFIED_PEOPLE) {
          // STEP 1: Check PersonRecord via GSI1 (O(1) lookup - no scan!)
          const person = await personRepository.getByEmailForAuth(userEmail)
          if (person) {
            // Derive role: explicit role → memberStatus/isInterEcclesiaRep → undefined
            const derivedRole = person.role
              || (person.memberStatus === 'member' || person.isInterEcclesiaRep ? ROLES.MEMBER : undefined)

            if (derivedRole) {
              // Block deceased users from signing in
              if (derivedRole === ROLES.DECEASED) {
                console.log('🚫 [Unified] Deceased user blocked from sign-in:', userEmail)
                return false
              }
              console.log('✅ [Unified] Found person with role:', derivedRole, person.role ? '' : '(derived from memberStatus)')
              extUser.role = derivedRole

              // Connect Google account + persist derived role if it was missing
              try {
                const connectUpdates: Record<string, any> = {}
                if (user.id && !person.provider) connectUpdates.provider = 'google'
                if (user.id) connectUpdates.googleId = user.id
                if (user.image) connectUpdates.image = user.image
                if (!person.role && derivedRole) connectUpdates.role = derivedRole
                if (Object.keys(connectUpdates).length > 0) {
                  await personRepository.updatePerson(person.personId, connectUpdates)
                  console.log('🔗 [Unified] Updated PersonRecord:', person.personId, !person.role ? `(persisted role: ${derivedRole})` : '')
                }
              } catch (connectError) {
                // Don't block sign-in if connect fails
                console.error('⚠️ [Unified] Failed to update PersonRecord:', connectError)
              }

              return true
            }
          }

          // STEP 2: Check legacy directory for new users
          console.log('📂 [Unified] Person not found, checking legacy directory...')
          const legacyUser = await getUserFromLegacyDirectory({ email: userEmail })
          if (!legacyUser) {
            // STEP 2.5: Check if this email is a Recording Brother
            const rbEcclesia = await getEcclesiaByRecordingBrotherEmail(userEmail)
            if (rbEcclesia) {
              console.log('📋 [Unified] Recording Brother detected for', rbEcclesia.name, '— assigning member role')
              extUser.role = ROLES.MEMBER

              try {
                const oauthProfile: GoogleOAuthProfile = {
                  id: user.id || '',
                  email: userEmail,
                  name: user.name || rbEcclesia.recordingBrotherName || undefined,
                  given_name: rbEcclesia.recordingBrotherName || undefined,
                  family_name: undefined,
                  picture: user.image || undefined,
                }

                await personRepository.createFromOAuth(oauthProfile, {
                  ecclesia: rbEcclesia.name,
                  role: ROLES.MEMBER as 'member',
                })
                console.log('✅ [Unified] PersonRecord created for Recording Brother:', rbEcclesia.name)
              } catch (createError) {
                console.error('⚠️ [Unified] Failed to create RB PersonRecord:', createError)
              }

              return true
            }

            // STEP 3: No match anywhere — create a guest PersonRecord so they exist in the system
            // (Admins can then find them in the Contact List and upgrade their role)
            console.log('📝 [Unified] New user, creating guest PersonRecord for:', userEmail)
            try {
              const oauthProfile: GoogleOAuthProfile = {
                id: user.id || '',
                email: userEmail,
                name: user.name || undefined,
                given_name: (profile?.given_name as string) || user.name?.split(' ')[0] || undefined,
                family_name: (profile?.family_name as string) || user.name?.split(' ').slice(1).join(' ') || undefined,
                picture: user.image || undefined,
              }

              await personRepository.createFromOAuth(oauthProfile, {
                ecclesia: '',
                role: ROLES.GUEST as 'guest',
              })
              console.log('✅ [Unified] Guest PersonRecord created for:', userEmail)
            } catch (createError) {
              console.error('⚠️ [Unified] Failed to create guest PersonRecord:', createError)
            }

            return true
          }

          // STEP 3: Create PersonRecord from OAuth profile + legacy data
          const role = await getRoleFromLegacyUser({ user: legacyUser })
          console.log('🔑 [Unified] Role determined from legacy:', role, 'for user:', userEmail)

          if (role) {
            extUser.role = role

            try {
              const oauthProfile: GoogleOAuthProfile = {
                id: user.id || '',
                email: userEmail,
                name: user.name || undefined,
                given_name: legacyUser.FirstName || undefined,
                family_name: legacyUser.LastName || undefined,
                picture: user.image || undefined,
              }

              await personRepository.createFromOAuth(oauthProfile, {
                ecclesia: legacyUser.ecclesia || 'Toronto East',
                role: role as 'owner' | 'admin' | 'member' | 'guest' | 'deceased',
              })

              console.log('✅ [Unified] PersonRecord created for future logins:', role)
            } catch (createError) {
              // Log error but don't block sign-in - PersonRecord can be created on next login
              // This prevents users from being locked out if there's a transient DB error
              console.error('⚠️ [Unified] Failed to create PersonRecord (will retry on next login):', createError)
            }

            // Also save to legacy USER# for backwards compatibility during migration
            try {
              await addUsersRoleToDB({ user, legacy: legacyUser })
            } catch (legacyError) {
              console.error('⚠️ [Unified] Failed to save legacy USER# record:', legacyError)
            }
          }

          return true
        }

        // ===== LEGACY SYSTEM (Original implementation) =====
        // STEP 1: Check DynamoDB first (existing users) - USES SCAN!
        const dbUser = await getUserFromDynamoDB(userEmail)
        if (dbUser && dbUser.role) {
          console.log('✅ Found existing user in DynamoDB with role:', dbUser.role)
          extUser.role = dbUser.role
          return true
        }

        // STEP 1.5: Check if this email has a credentials account
        const credentialsUser = await findCredentialsUserByEmail(userEmail)
        if (credentialsUser && credentialsUser.role) {
          console.log('✅ Found existing credentials user with role:', credentialsUser.role)
          extUser.role = credentialsUser.role
          return true
        }

        // STEP 2: Fallback to legacy directory (new users only)
        console.log('📂 User not in DynamoDB, checking legacy directory...')
        const legacyUser = await getUserFromLegacyDirectory({ email: userEmail })
        if (!legacyUser) {
          console.log('⚠️ No legacy user found for:', userEmail)
          return true
        }

        // STEP 3: Assign role and save to DynamoDB for future logins
        const role = await getRoleFromLegacyUser({ user: legacyUser })
        console.log('🔑 Role determined from legacy:', role, 'for user:', userEmail)
        if (role) {
          extUser.role = role
          await addUsersRoleToDB({ user, legacy: legacyUser })
          console.log('✅ Role saved to DB for future logins:', role)
        }

        return true
      } catch (error) {
        console.error('❌ Error in signIn callback:', error)
        // Don't block sign-in due to lookup errors
        return true
      }
    },
    async session({ session, user, token }: { session: Session; user?: User; token?: JWT }) {
      // Safely add role and RB designation to the Session.User
      try {
        const userWithRole = user as (User & { role?: string }) | undefined
        const tokenWithRole = token as (JWT & { role?: string; isRecordingBrother?: boolean; ecclesia?: string; assuranceLevel?: string; authTime?: number }) | undefined
        const finalRole = userWithRole?.role || tokenWithRole?.role || ROLES.GUEST
        console.log('📋 Session callback - Final role:', finalRole, 'for user:', session.user?.email)
        ;(session.user as User & { role: string }).role = finalRole
        // RB designation: sourced from JWT (set during jwt callback from PersonRecord)
        ;(session.user as any).isRecordingBrother = tokenWithRole?.isRecordingBrother || false
        // Home ecclesia: sourced from JWT (set during jwt callback from PersonRecord)
        ;(session.user as any).ecclesia = tokenWithRole?.ecclesia || null
        // Assurance level + auth time (#80). 'recognized' = forwardable bearer
        // token; 'authenticated' = a freshly-proven credential.
        ;(session.user as any).assuranceLevel = tokenWithRole?.assuranceLevel || 'authenticated'
        ;(session.user as any).authTime = tokenWithRole?.authTime ?? null
        return session
      } catch (error) {
        const msg = error instanceof Error ? error.message : error
        console.error('❌ Error in session callback:', msg)
        ;(session.user as User & { role: string }).role = ROLES.GUEST // Ensure we always return a valid session

        return session
      }
    },
  },
  events: {
    async createUser({ user }: { user: User }) {
      try {
        if (user?.id && user.email) {
          console.log('📝 createUser event for:', user.email, USE_UNIFIED_PEOPLE ? '(unified people)' : '(legacy)')

          // Check legacy directory for role assignment
          const legacyUser = await getUserFromLegacyDirectory({ email: user.email })
          if (!legacyUser) {
            return
          }

          const role = await getRoleFromLegacyUser({ user: legacyUser })
          if (!role) {
            return
          }

          ;(user as User & { role: string }).role = role

          if (USE_UNIFIED_PEOPLE) {
            // Check if PersonRecord already exists (may have been created in signIn)
            const existingPerson = await personRepository.getByEmail(user.email)
            if (!existingPerson) {
              const oauthProfile: GoogleOAuthProfile = {
                id: user.id,
                email: user.email,
                name: user.name || undefined,
                given_name: legacyUser.FirstName || undefined,
                family_name: legacyUser.LastName || undefined,
                picture: user.image || undefined,
              }

              await personRepository.createFromOAuth(oauthProfile, {
                ecclesia: legacyUser.ecclesia || 'Toronto East',
                role: role as 'owner' | 'admin' | 'member' | 'guest' | 'deceased',
              })
              console.log('✅ [Unified] PersonRecord created in createUser event')
            }
          }

          // Also save to legacy USER# for backwards compatibility
          await addUsersRoleToDB({ user, legacy: legacyUser })
        }
      } catch (error) {
        console.error('Error in createUser event:', error)
      }
    },
    async updateUser({ user }: { user: User }) {
      const userWithRole = user as User & { role?: string }
      if (userWithRole.role || !user.email) {
        return
      }

      const legacyUser = await getUserFromLegacyDirectory({ email: user.email })
      if (!legacyUser) {
        return
      }

      const role = await getRoleFromLegacyUser({ user: legacyUser })
      if (role) {
        ;(user as User & { role: string }).role = role

        if (USE_UNIFIED_PEOPLE) {
          // Update PersonRecord if it exists
          const person = await personRepository.getByEmail(user.email)
          if (person) {
            await personRepository.updatePerson(person.personId, {
              role: role as 'owner' | 'admin' | 'member' | 'guest' | 'deceased',
            })
          }
        }

        // Also update legacy USER# for backwards compatibility
        await addUsersRoleToDB({ user, legacy: legacyUser })
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}

const nextAuthResult = NextAuth(authOptions)
export const { handlers, signIn, signOut } = nextAuthResult
const nextAuth = nextAuthResult.auth

/**
 * Enhanced auth() — drop-in replacement for NextAuth's auth export.
 *
 * Supports two calling patterns:
 * 1. auth()         → returns Session | null (API routes, server components)
 * 2. auth(handler)  → middleware wrapper (middleware.ts)
 *
 * When called without arguments, checks for a Bearer token in the
 * Authorization header (from /api/auth/dev-token) before falling back
 * to the standard NextAuth cookie session.
 */
export function auth(...args: [any]): any
export function auth(): Promise<Session | null>
export function auth(...args: any[]): any {
  // Middleware overload: auth(handler) — pass through to NextAuth
  if (args.length > 0) {
    return (nextAuth as any)(...args)
  }

  // Session overload: auth() — check Bearer token first
  return getSessionWithBearer()
}

async function getSessionWithBearer(): Promise<Session | null> {
  const devKey = process.env.DEV_AUTH_SERVER_KEY
  if (devKey) {
    try {
      const headersList = await headers()
      const authHeader = headersList.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7)
        const secret = new TextEncoder().encode(devKey)
        const { payload } = await jwtVerify(token, secret)

        return {
          user: {
            email: payload.email as string,
            name: payload.name as string,
            role: payload.role as string,
          },
          expires: new Date(Date.now() + 3600 * 1000).toISOString(),
        } as Session
      }
    } catch {
      // Invalid/expired token — fall through to normal auth
    }
  }

  return nextAuth()
}
