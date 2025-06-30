"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"

export default function Home() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading session...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            React 19 + NextAuth.js v5 
          </h1>
          <h2 className="text-lg font-semibold text-green-600 mb-6">
            ✅ Compatibility Test
          </h2>
          
          {session ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <h3 className="text-lg font-medium text-green-800 mb-2">
                  Authentication Successful!
                </h3>
                <p className="text-green-700">
                  User: {session.user?.email}
                </p>
                <p className="text-green-700">
                  Name: {session.user?.name}
                </p>
              </div>
              <button
                onClick={() => signOut()}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-blue-700">
                  Not authenticated. Please sign in to test the integration.
                </p>
              </div>
              <Link
                href="/auth/signin"
                className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors text-center"
              >
                Sign In
              </Link>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 p-3 rounded">
                <div className="font-medium">React</div>
                <div className="text-gray-600">19.0.0</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="font-medium">Next.js</div>
                <div className="text-gray-600">15.3.4</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="font-medium">NextAuth.js</div>
                <div className="text-gray-600">v5 Beta</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="font-medium">Status</div>
                <div className="text-green-600 font-medium">✅ Working</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}