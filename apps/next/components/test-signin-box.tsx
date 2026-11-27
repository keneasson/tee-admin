'use client'

import React, { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { YStack, Text, Button, Paragraph, Input } from '@my/ui'

type Options = { enabled: boolean; personas: Array<{ email: string; label: string }> }

/**
 * "Test sign-in" (#349): pick a made-up test person and enter the preview key.
 * Renders nothing unless the server says test sign-in is on (preview / local
 * only). The key is typed here and checked only on the server.
 */
export function TestSigninBox({ returnTo, onDone }: { returnTo: string; onDone: (path: string) => void }) {
  const [options, setOptions] = useState<Options | null>(null)
  const [email, setEmail] = useState('')
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/test-signin-options', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((o: Options | null) => {
        if (!cancelled && o?.enabled) {
          setOptions(o)
          setEmail(o.personas[0]?.email ?? '')
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!options) return null

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await signIn('test-signin', { email, key, redirect: false })
      if (result?.error || !result?.ok) setError('Test sign-in failed. Check the key.')
      else onDone(returnTo)
    } catch {
      setError('Test sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <YStack gap="$2" padding="$3" borderWidth={1} borderColor="$orange8" borderRadius="$3" backgroundColor="$orange2">
      <Text fontWeight="700">Test sign-in (preview only)</Text>
      <select
        aria-label="Test person"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: 8, fontSize: 16 }}
      >
        {options.personas.map((p) => (
          <option key={p.email} value={p.email}>
            {p.label}
          </option>
        ))}
      </select>
      <Input
        value={key}
        onChangeText={(v: string) => {
          setKey(v)
          if (error) setError('')
        }}
        placeholder="Test sign-in key"
        secureTextEntry
        autoComplete="off"
        size="$4"
      />
      <Button
        onPress={submit}
        size="$4"
        disabled={busy || !key}
        backgroundColor="$orange9"
        hoverStyle={{ backgroundColor: '$orange10' }}
      >
        {busy ? 'Signing in...' : 'Sign in as test person'}
      </Button>
      {error ? <Paragraph color="$red10">{error}</Paragraph> : null}
    </YStack>
  )
}
