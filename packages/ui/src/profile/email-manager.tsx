import React, { useState } from 'react'
import { YStack, XStack, Text, Card, Input, Spinner, Popover, Separator } from 'tamagui'
import { Button } from '../Button'
import {
  Mail,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Send,
  Pencil,
  MoreHorizontal,
  Star,
  Shield,
  X,
} from '@tamagui/lucide-icons'
import { moveEmailToFront } from './email-ordering'

export { moveEmailToFront }

export interface EmailEntry {
  id: string
  email: string
  verified: boolean
  verificationSentAt?: string
  isPrimary?: boolean // Primary login email (cannot be removed)
  // NOTE: `subscribed`/`subscriptionCount` used to render here; subscriptions now
  // live in their own tab. Kept optional so the API payload still type-checks.
  subscribed?: boolean
  subscriptionCount?: number
}

interface EmailManagerProps {
  emails: EmailEntry[]
  /** Add a brand-new (unverified) address. Resolves true only when it actually
   *  landed (false on a deferred step-up / error) so a rename won't drop the old
   *  address before the new one exists. */
  onAddEmail: (email: string) => Promise<boolean> | boolean
  /** Soft-delete a non-login address by id. */
  onDeleteEmail: (emailId: string) => Promise<void> | void
  /** (Re)send the verification code for an address. */
  onSendVerification: (emailId: string) => Promise<void> | void
  /** Make this address the preferred (first) contact — soft, in-place. */
  onSetPreferred: (emailId: string) => Promise<void> | void
  /** Promote an already-verified address to the login identity (secure flow). */
  onSetLogin: (email: string) => void
  /** Change the login/primary address (secure flow). */
  onChangeLogin: () => void
  /**
   * Whether the secure change-login flow is available to this session (the
   * SECURE_EMAIL_CHANGE launch-dark flag). Gates the "Set as login" menu item and
   * the login-row change pencil.
   */
  canChangeLogin: boolean
  /** View-only: render addresses + verified badges, no controls. */
  readOnly?: boolean
}

const GUTTER = 34

// Simple email validation
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const EmailManager: React.FC<EmailManagerProps> = ({
  emails,
  onAddEmail,
  onDeleteEmail,
  onSendVerification,
  onSetPreferred,
  onSetLogin,
  onChangeLogin,
  canChangeLogin,
  readOnly = false,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // Inline "add a new address" editor (revealed by the Add button).
  const [adding, setAdding] = useState(false)
  const [newEmail, setNewEmail] = useState('')

  // Inline "rename an existing address" editor, keyed by row id. Because there is
  // no rename endpoint, saving a changed value adds the new address and removes
  // the old one (which also, correctly, resets verification for the new address).
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const run = async (id: string, fn: () => Promise<void> | void) => {
    setBusyId(id)
    try {
      await fn()
    } finally {
      setBusyId(null)
    }
  }

  const submitAdd = async () => {
    const value = newEmail.toLowerCase().trim()
    if (!isValidEmail(value)) return
    await run('__add__', async () => {
      await onAddEmail(value)
      setNewEmail('')
      setAdding(false)
    })
  }

  const startEdit = (entry: EmailEntry) => {
    setEditingId(entry.id)
    setEditValue(entry.email)
  }

  const submitEdit = async (entry: EmailEntry) => {
    const value = editValue.toLowerCase().trim()
    if (!isValidEmail(value)) return
    if (value === entry.email.toLowerCase()) {
      setEditingId(null)
      return
    }
    await run(entry.id, async () => {
      // Only drop the old address once the new one has actually been added — a
      // deferred step-up (or any failure) returns false and keeps the old address.
      const added = await onAddEmail(value)
      if (added) await onDeleteEmail(entry.id)
      setEditingId(null)
    })
  }

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <XStack gap="$2" alignItems="center">
          <Mail size={20} />
          <Text fontSize="$4" fontWeight="600">Email Addresses</Text>
        </XStack>
        {readOnly ? null : (
          <Button
            size="$2"
            variant="outlined"
            icon={Plus}
            onPress={() => { setAdding(true); setNewEmail('') }}
          >
            Add
          </Button>
        )}
      </XStack>

      {emails.length === 0 && !adding ? (
        <Card padding="$3" backgroundColor="$backgroundHover">
          <Text fontSize="$3" theme="alt2" textAlign="center">
            No email addresses. Click "Add" to add one.
          </Text>
        </Card>
      ) : (
        <YStack gap="$2">
          {emails.map((entry, index) => {
            const isLogin = !!entry.isPrimary
            const isPreferred = index === 0
            const isEditing = editingId === entry.id
            const rowBusy = busyId === entry.id
            const showMenu = !readOnly && entry.verified && !isLogin
            const canRename = !readOnly && !isLogin

            return (
              <Card
                key={entry.id}
                padding="$3"
                backgroundColor={isLogin ? '$blue2' : '$backgroundHover'}
                borderWidth={isLogin ? 1 : 0}
                borderColor="$blue6"
              >
                {isEditing ? (
                  // Inline rename editor
                  <XStack gap="$2" alignItems="center" flexWrap="wrap">
                    <Input
                      flex={1}
                      minWidth={200}
                      value={editValue}
                      onChangeText={setEditValue}
                      placeholder="email@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoFocus
                    />
                    <Button
                      size="$2"
                      variant="outlined"
                      icon={X}
                      onPress={() => setEditingId(null)}
                      disabled={rowBusy}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="$2"
                      theme="blue"
                      icon={rowBusy ? <Spinner size="small" /> : Check}
                      onPress={() => submitEdit(entry)}
                      disabled={rowBusy || !isValidEmail(editValue.trim())}
                    >
                      Save
                    </Button>
                  </XStack>
                ) : (
                  <XStack gap="$2" alignItems="flex-start">
                    {/* Left edit gutter — consistent on every row */}
                    <XStack width={GUTTER} alignItems="center" justifyContent="flex-start">
                      {readOnly ? null : isLogin ? (
                        canChangeLogin ? (
                          <Button
                            size="$2"
                            circular
                            chromeless
                            icon={Pencil}
                            aria-label="Change login email"
                            onPress={onChangeLogin}
                          />
                        ) : null
                      ) : (
                        <Button
                          size="$2"
                          circular
                          chromeless
                          icon={Pencil}
                          aria-label="Edit email"
                          onPress={() => startEdit(entry)}
                          disabled={rowBusy}
                        />
                      )}
                    </XStack>

                    {/* Value + badges */}
                    <YStack flex={1} gap="$1" minWidth={0}>
                      <XStack gap="$2" alignItems="center" flexWrap="wrap">
                        <Text fontSize="$4" fontWeight="500">
                          {entry.email || 'No email'}
                        </Text>
                        {isPreferred ? (
                          <Card paddingHorizontal="$2" paddingVertical="$1" backgroundColor="$blue4">
                            <Text fontSize="$1" color="$blue10">Preferred</Text>
                          </Card>
                        ) : null}
                        {isLogin ? (
                          <Card paddingHorizontal="$2" paddingVertical="$1" backgroundColor="$gray4">
                            <Text fontSize="$1" color="$gray11">Login</Text>
                          </Card>
                        ) : null}
                      </XStack>
                    </YStack>

                    {/* Right actions */}
                    <XStack gap="$2" alignItems="center">
                      {entry.verified ? (
                        <XStack gap="$1" alignItems="center">
                          <Check size={15} color="$green10" />
                          <Text fontSize="$2" color="$green10" fontWeight="600">Verified</Text>
                        </XStack>
                      ) : (
                        <XStack gap="$2" alignItems="center">
                          <XStack gap="$1" alignItems="center">
                            <AlertCircle size={14} color="$orange10" />
                            <Text fontSize="$2" color="$orange10" fontWeight="600">Not verified</Text>
                          </XStack>
                          {readOnly ? null : (
                            <Button
                              size="$1"
                              variant="outlined"
                              icon={busyId === `verify-${entry.id}` ? <Spinner size="small" /> : Send}
                              onPress={() => run(`verify-${entry.id}`, () => onSendVerification(entry.id))}
                              disabled={busyId !== null}
                            >
                              {entry.verificationSentAt ? 'Resend' : 'Verify'}
                            </Button>
                          )}
                        </XStack>
                      )}

                      {showMenu ? (
                        <Popover
                          size="$3"
                          allowFlip
                          open={openMenuId === entry.id}
                          onOpenChange={(open) => setOpenMenuId(open ? entry.id : null)}
                        >
                          <Popover.Trigger asChild>
                            <Button
                              size="$2"
                              circular
                              chromeless
                              icon={MoreHorizontal}
                              aria-label="More actions"
                            />
                          </Popover.Trigger>
                          <Popover.Content
                            bordered
                            elevate
                            padding="$0"
                            enterStyle={{ y: -6, opacity: 0 }}
                            exitStyle={{ y: -6, opacity: 0 }}
                            animation="quick"
                          >
                            <YStack minWidth={220}>
                              {isPreferred ? null : (
                                <Button
                                  chromeless
                                  justifyContent="flex-start"
                                  borderRadius={0}
                                  icon={Star}
                                  onPress={() => {
                                    setOpenMenuId(null)
                                    void run(entry.id, () => onSetPreferred(entry.id))
                                  }}
                                >
                                  Set as preferred
                                </Button>
                              )}
                              {!isPreferred && canChangeLogin ? <Separator /> : null}
                              {canChangeLogin ? (
                                <Button
                                  chromeless
                                  justifyContent="flex-start"
                                  borderRadius={0}
                                  icon={Shield}
                                  onPress={() => {
                                    setOpenMenuId(null)
                                    onSetLogin(entry.email)
                                  }}
                                >
                                  Set as login
                                </Button>
                              ) : null}
                            </YStack>
                          </Popover.Content>
                        </Popover>
                      ) : null}

                      {readOnly || isLogin ? null : (
                        <Button
                          size="$2"
                          circular
                          chromeless
                          icon={rowBusy ? <Spinner size="small" /> : Trash2}
                          color="$red10"
                          aria-label="Delete this address"
                          onPress={() => run(entry.id, () => onDeleteEmail(entry.id))}
                          disabled={rowBusy}
                        />
                      )}
                    </XStack>
                  </XStack>
                )}
              </Card>
            )
          })}

          {adding ? (
            <Card padding="$3" backgroundColor="$backgroundHover">
              <XStack gap="$2" alignItems="center" flexWrap="wrap">
                <XStack width={GUTTER} />
                <Input
                  flex={1}
                  minWidth={200}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="email@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                />
                <Button
                  size="$2"
                  variant="outlined"
                  icon={X}
                  onPress={() => { setAdding(false); setNewEmail('') }}
                  disabled={busyId === '__add__'}
                >
                  Cancel
                </Button>
                <Button
                  size="$2"
                  theme="blue"
                  icon={busyId === '__add__' ? <Spinner size="small" /> : Check}
                  onPress={submitAdd}
                  disabled={busyId === '__add__' || !isValidEmail(newEmail.trim())}
                >
                  Add
                </Button>
              </XStack>
              {newEmail && !isValidEmail(newEmail.trim()) ? (
                <Text fontSize="$2" color="$red10" paddingTop="$2" paddingLeft={GUTTER + 8}>
                  Enter a valid email address
                </Text>
              ) : null}
            </Card>
          ) : null}
        </YStack>
      )}
    </YStack>
  )
}
