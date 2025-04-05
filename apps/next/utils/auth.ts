import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { DynamoDBAdapter } from '@auth/dynamodb-adapter'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

import { getAwsDbConfig } from './email/sesClient'
import { addUsersRoleToDB } from './dynamodb/set-user-role'

import { ROLES } from '@my/app/provider/auth/auth-roles'
import {
  getRoleFromLegacyUser,
  getUserFromLegacyDirectory,
} from '@my/app/provider/auth/get-user-from-legacy'

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENTID as string,
      clientSecret: process.env.NEXT_PUBLIC_GOOGLE_ACCOUNT_SECRET as string,
    }),
  ],
  adapter: DynamoDBAdapter(client, nextAuthDynamoDb),
  callbacks: {
    async signIn({ user, profile }) {
      if (user.role) {
        return true
      }
      const userEmail = user.email || profile?.email
      if (!userEmail) {
        return true
      }
      const legacyUser = await getUserFromLegacyDirectory({ email: userEmail })
      if (!legacyUser) {
        return true
      }
      const role = await getRoleFromLegacyUser({ user: legacyUser })

      if (role) {
        user.role = role
        await addUsersRoleToDB({ user, legacy: legacyUser })
      }
      console.log('injecting role into session', {
        name: legacyUser.FirstName + ' ' + legacyUser.LastName,
        user,
      })
      return true
    },
    async session({ session, user }) {
      // Safely add role to the Session.User
      try {
        session.user.role = user.role || ROLES.GUEST
        // console.log('reading session', { session })
        return session
      } catch (error) {
        const msg = error instanceof Error ? error.message : error
        console.error('Error in session callback:', msg)
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
            console.log('injecting role into session', {
              name: legacyUser.FirstName + ' ' + legacyUser.LastName,
              role,
            })
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
      console.log('updateUser', user)
      if (user.role || !user.email) {
        return
      }
      const legacyUser = await getUserFromLegacyDirectory({ email: user.email })
      if (!legacyUser) {
        return
      }
      const role = await getRoleFromLegacyUser({ user: legacyUser })
      console.log('injecting role into session', {
        name: legacyUser.FirstName + ' ' + legacyUser.LastName,
        role,
      })
      if (role) {
        user.role = role
        await addUsersRoleToDB({ user, legacy: legacyUser })
      }
    },
  },
  secret: process.env.NEXT_PUBLIC_SECRET,
  debug: process.env.NODE_ENV === 'development',
})
