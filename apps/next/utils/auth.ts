import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { DynamoDBAdapter } from '@auth/dynamodb-adapter'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import NextAuth, { type NextAuthConfig, type User, type Session } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import GoogleProvider from 'next-auth/providers/google'
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

export const authOptions: NextAuthConfig = {
  trustHost: true,
  session: {
    strategy: 'jwt' as const,
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
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
            const created = await personRepository.create({
              email,
              firstName: '',
              lastName: '',
              ecclesia: 'Unknown',
              memberStatus: 'visitor',
              role: 'guest',
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
      // Add role to the token when user signs in
      if (user) {
        token.role = (user as User & { role?: string }).role
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
          if (person && person.role) {
            // Block deceased users from signing in
            if (person.role === ROLES.DECEASED) {
              console.log('🚫 [Unified] Deceased user blocked from sign-in:', userEmail)
              return false
            }
            console.log('✅ [Unified] Found person with role:', person.role)
            extUser.role = person.role
            return true
          }

          // STEP 2: Check legacy directory for new users
          console.log('📂 [Unified] Person not found, checking legacy directory...')
          const legacyUser = await getUserFromLegacyDirectory({ email: userEmail })
          if (!legacyUser) {
            console.log('⚠️ [Unified] No legacy user found for:', userEmail)
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
      // Safely add role to the Session.User
      try {
        const userWithRole = user as (User & { role?: string }) | undefined
        const tokenWithRole = token as (JWT & { role?: string }) | undefined
        const finalRole = userWithRole?.role || tokenWithRole?.role || ROLES.GUEST
        console.log('📋 Session callback - Final role:', finalRole, 'for user:', session.user?.email)
        ;(session.user as User & { role: string }).role = finalRole
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
