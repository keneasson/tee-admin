import { DefaultSession } from 'next-auth'

export type User = {
  role: 'owner' | 'admin' | 'member' | 'guest'
  email?: string
  name?: string
  firstName?: string
  lastName?: string
  // Add other user properties here as needed
}

declare module 'next-auth' {
  interface Session {
    user: User & DefaultSession['user']
  }
}
