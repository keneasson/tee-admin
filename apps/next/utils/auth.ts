import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { DynamoDBAdapter } from '@auth/dynamodb-adapter'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'

import { getAwsDbConfig } from './email/sesClient'
import { addUsersRoleToDB } from './dynamodb/set-user-role'
import { getUserFromDynamoDB } from './dynamodb/get-user'

import { ROLES } from '@my/app/provider/auth/auth-roles'
import {
  getRoleFromLegacyUser,
  getUserFromLegacyDirectory,
} from '@my/app/provider/auth/get-user-from-legacy'
import { verifyCredentialsUser, findCredentialsUserByEmail } from './dynamodb/credentials-users'

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

export const authOptions = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENTID as string,
      clientSecret: process.env.NEXT_PUBLIC_GOOGLE_ACCOUNT_SECRET as string,
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
  ],
  // adapter: DynamoDBAdapter(client, nextAuthDynamoDb), // Disabled - causes session issues with credentials provider
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user }) {
      // Add role to the token when user signs in
      if (user) {
        token.role = user.role
      }
      return token
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
    async signIn({ user, profile }) {
      // For credentials users, we already have the role, so just return true
      if (user.provider === 'credentials') {
        return true
      }
      
      // For other providers (like Google), check if user already has role
      if (user.role) {
        return true
      }
      
      const userEmail = user.email || profile?.email
      if (!userEmail) {
        return true
      }
      
      try {
        console.log('🔑 SignIn callback for:', userEmail)
        
        // STEP 1: Check DynamoDB first (existing users)
        const dbUser = await getUserFromDynamoDB(userEmail)
        if (dbUser && dbUser.role) {
          console.log('✅ Found existing user in DynamoDB with role:', dbUser.role)
          user.role = dbUser.role
          return true
        }
        
        // STEP 1.5: Check if this email has a credentials account
        const credentialsUser = await findCredentialsUserByEmail(userEmail)
        if (credentialsUser && credentialsUser.role) {
          console.log('✅ Found existing credentials user with role:', credentialsUser.role)
          user.role = credentialsUser.role
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
          user.role = role
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
    async session({ session, user, token }) {
      // Safely add role to the Session.User
      try {
        const finalRole = user?.role || token?.role || ROLES.GUEST
        console.log('📋 Session callback - Final role:', finalRole, 'for user:', session.user?.email)
        session.user.role = finalRole
        return session
      } catch (error) {
        const msg = error instanceof Error ? error.message : error
        console.error('❌ Error in session callback:', msg)
        session.user.role = ROLES.GUEST // Ensure we always return a valid session

        return session
      }
    },
  },
  events: {
    async createUser({ user }) {
      try {
        if (user?.id) {
          // store role on database when user signs up
          if (user.email) {
            const legacyUser = await getUserFromLegacyDirectory({ email: user.email })
            if (!legacyUser) {
              return
            }
            const role = await getRoleFromLegacyUser({ user: legacyUser })
            if (role) {
              user.role = role
              await addUsersRoleToDB({ user, legacy: legacyUser })
            }
          }
        }
      } catch (error) {
        console.error('Error in createUser event:', error)
      }
    },
    async updateUser({ user }) {
      if (user.role || !user.email) {
        return
      }
      const legacyUser = await getUserFromLegacyDirectory({ email: user.email })
      if (!legacyUser) {
        return
      }
      const role = await getRoleFromLegacyUser({ user: legacyUser })
      if (role) {
        user.role = role
        await addUsersRoleToDB({ user, legacy: legacyUser })
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.NEXT_PUBLIC_SECRET,
  debug: process.env.NODE_ENV === 'development',
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
