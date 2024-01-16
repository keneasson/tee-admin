import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

// Initialize NextAuth
export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENTID as string,
      clientSecret: process.env.NEXT_PUBLIC_GOOGLE_ACCOUNT_SECRET as string,
    }),
  ],
  secret: process.env.NEXT_PUBLIC_SECRET,
})
