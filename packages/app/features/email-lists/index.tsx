'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import {
  Button,
  Checkbox,
  Heading,
  Input,
  Paragraph,
  Spinner,
  Text,
  XStack,
  YStack,
  Card,
  Separator,
  ScrollView
} from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { Section } from '@my/app/features/newsletter/Section'
import { LogInUser } from '@my/app/provider/auth/log-in-user'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import {
  Search,
  Check,
  RefreshCw,
  UserPlus,
  ListPlus,
  Download,
  Upload
} from '@tamagui/lucide-icons'
import { getContactsList, getContacts, updateContacts } from '@my/app/provider/get-data'
import {
  SimplifiedContactListType,
  SimplifiedContacts,
  ContactPreferences,
  EmailListTypeKeys
} from '@my/app/types'
import { Contact } from '@aws-sdk/client-sesv2'
import { AddUpdateList } from '../email-tester/dialogues/add-update-list'
import { AddUpdateContact } from '../email-tester/dialogues/add-update-contact'

const ALL_CONTACTS_LOADED = 'DONE'

// List names for column headers with visibility defaults
const listNames: { key: EmailListTypeKeys; label: string; defaultVisible: boolean }[] = [
  { key: 'sundaySchool', label: 'Sunday School', defaultVisible: true },
  { key: 'newsletter', label: 'Newsletter', defaultVisible: true },
  { key: 'memorial', label: 'Memorial', defaultVisible: true },
  { key: 'bibleClass', label: 'Bible Class', defaultVisible: true },
  { key: 'testList', label: 'Test List', defaultVisible: false }
]

export const EmailLists: React.FC = () => {
  const { data: session } = useSession()
  const [contactLists, setContactLists] = useState<SimplifiedContactListType>()
  const [allContacts, setAllContacts] = useState<SimplifiedContacts>({
    subscribed: {},
    unsubscribed: []
  })
  const [nextToken, setNextToken] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [visibleLists, setVisibleLists] = useState<Record<EmailListTypeKeys, boolean>>(
    listNames.reduce((acc, list) => ({ ...acc, [list.key]: list.defaultVisible }), {} as Record<EmailListTypeKeys, boolean>)
  )
  const [updating, setUpdating] = useState<string | null>(null)

  // Load contact lists on mount - must be declared before any conditional returns
  useEffect(() => {
    if (session?.user?.role === ROLES.ADMIN || session?.user?.role === ROLES.OWNER) {
      loadContactLists()
    }
  }, [session])

  // Filter and sort contacts - must be declared before any conditional returns
  const filteredContacts = useMemo(() => {
    const contacts = Object.entries(allContacts.subscribed)

    // Filter by search term
    let filtered = contacts.filter(([email]) =>
      email.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Sort alphabetically
    return filtered.sort(([a], [b]) => a.localeCompare(b))
  }, [allContacts, searchTerm])

  // Check if we have partial data with search - this affects button behavior
  const hasPartialDataWithSearch = searchTerm && nextToken !== ALL_CONTACTS_LOADED

  // Get visible list columns
  const visibleListColumns = listNames.filter(list => visibleLists[list.key])

  if (!(session && session.user)) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Email Lists Management</Heading>
          <Paragraph>To access this section of our site, please sign in.</Paragraph>
          <LogInUser />
        </Section>
      </Wrapper>
    )
  }

  // Check if user has admin or owner role
  const userRole = session.user.role
  if (userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Access Denied</Heading>
          <Paragraph>You need admin or owner permissions to manage Email Lists.</Paragraph>
          <Paragraph>Current role: {userRole || 'None'}</Paragraph>
        </Section>
      </Wrapper>
    )
  }

  const loadContactLists = async () => {
    setLoading(true)
    try {
      const response = await getContactsList()
      setContactLists(response)
    } catch (error) {
      console.error('Error loading contact lists:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadContacts = async (loadAll = false) => {
    if (nextToken === ALL_CONTACTS_LOADED && !loadAll) {
      return
    }

    setLoading(true)
    try {
      let currentToken = loadAll ? undefined : nextToken
      let allLoadedContacts = loadAll ? { subscribed: {}, unsubscribed: [] } : { ...allContacts }

      do {
        const { nextToken: newToken, contacts } = await getContacts(currentToken)

        const simplified = simplifyPreferences(contacts)
        if (simplified) {
          allLoadedContacts = {
            subscribed: { ...allLoadedContacts.subscribed, ...simplified.subscribed },
            unsubscribed: [...allLoadedContacts.unsubscribed, ...simplified.unsubscribed]
          }
        }

        currentToken = newToken
        if (!loadAll) break // If not loading all, just load one page
      } while (currentToken && loadAll)

      setAllContacts(allLoadedContacts)
      setNextToken(currentToken || ALL_CONTACTS_LOADED)
    } catch (error) {
      console.error('Error loading contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSubscription = async (
    email: string,
    list: EmailListTypeKeys,
    currentValue: boolean
  ) => {
    setUpdating(`${email}-${list}`)

    try {
      const newPreferences = {
        ...allContacts.subscribed[email],
        [list]: !currentValue
      }

      await updateContacts({ email, lists: newPreferences })

      // Update local state
      setAllContacts(prev => ({
        ...prev,
        subscribed: {
          ...prev.subscribed,
          [email]: newPreferences
        }
      }))
    } catch (error) {
      console.error('Error updating subscription:', error)
    } finally {
      setUpdating(null)
    }
  }

  const totalContacts = Object.keys(allContacts.subscribed).length

  return (
    <Wrapper subHheader="Email Lists Management">
      <Section gap={'$4'}>
        <YStack gap="$4">
          {/* Header Controls */}
          <Card elevate bordered padding="$4" backgroundColor="$background">
            <YStack gap="$3">
              {/* Top Row - Actions */}
              <XStack gap="$3" flexWrap="wrap">
                <AddUpdateList />
                <AddUpdateContact />
              </XStack>

              <Separator />

              {/* Search and Filter */}
              <YStack gap="$3">
                <XStack gap="$3" alignItems="center">
                  <XStack flex={1} alignItems="center" gap="$2">
                    <Search size={20} color="$gray10" />
                    <Input
                      flex={1}
                      placeholder="Search by email..."
                      value={searchTerm}
                      onChangeText={setSearchTerm}
                      size="$4"
                    />
                  </XStack>

                  <XStack gap="$4" alignItems="center" flexWrap="wrap">
                    <Text fontSize="$3" fontWeight="600">Show Columns:</Text>
                    {listNames.map(list => (
                      <XStack key={list.key} gap="$2" alignItems="center">
                        <Checkbox
                          checked={visibleLists[list.key]}
                          onCheckedChange={(checked) =>
                            setVisibleLists(prev => ({ ...prev, [list.key]: !!checked }))
                          }
                          size="$3"
                        >
                          <Checkbox.Indicator>
                            <Check />
                          </Checkbox.Indicator>
                        </Checkbox>
                        <Text
                          fontSize="$3"
                          color={visibleLists[list.key] ? '$color' : '$gray9'}
                          onPress={() =>
                            setVisibleLists(prev => ({ ...prev, [list.key]: !prev[list.key] }))
                          }
                          cursor="pointer"
                        >
                          {list.label}
                        </Text>
                      </XStack>
                    ))}
                  </XStack>
                </XStack>

                {/* Smart Load/Apply Button */}
                <XStack gap="$3" alignItems="center">
                  <Button
                    size="$4"
                    icon={totalContacts === 0 ? Download : hasPartialDataWithSearch ? Search : RefreshCw}
                    onPress={() => loadContacts(true)}
                    disabled={loading}
                    theme="active"
                  >
{loading ? (
                      <XStack gap="$2" alignItems="center">
                        <Spinner size="small" color="$background" />
                        <Text>Loading...</Text>
                      </XStack>
                    ) : totalContacts === 0 ? (
                      <Text>Load All Contacts</Text>
                    ) : hasPartialDataWithSearch ? (
                      <Text>Search All Contacts ({filteredContacts.length} in loaded data)</Text>
                    ) : searchTerm ? (
                      <Text>Filter Results ({filteredContacts.length} matches)</Text>
                    ) : (
                      <Text>Refresh All Contacts</Text>
                    )}
                  </Button>

                  <XStack flex={1} />

{totalContacts > 0 ? (
                    <XStack gap="$3" alignItems="center">
                      <Text fontSize="$3" color="$gray11">
                        {filteredContacts.length === totalContacts
                          ? `${totalContacts} total contacts`
                          : `Showing ${filteredContacts.length} of ${totalContacts} contacts`}
                      </Text>
                      {hasPartialDataWithSearch ? (
                        <Text fontSize="$3" color="$orange10">
                          ⚠️ Partial results - load all to search completely
                        </Text>
                      ) : null}
                      {nextToken === ALL_CONTACTS_LOADED ? (
                        <Text fontSize="$3" color="$green10">
                          ✓ All loaded
                        </Text>
                      ) : null}
                    </XStack>
                  ) : null}
                </XStack>
              </YStack>
            </YStack>
          </Card>

          {/* Contacts Table */}
          {filteredContacts.length > 0 ? (
            <Card elevate bordered padding="$0" backgroundColor="$background">
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <YStack>
                  {/* Table Header */}
                  <XStack
                    backgroundColor="$gray3"
                    paddingVertical="$3"
                    paddingHorizontal="$4"
                    borderBottomWidth={2}
                    borderBottomColor="$gray5"
                  >
                    <Text
                      width={300}
                      fontSize="$3"
                      fontWeight="600"
                      color="$gray12"
                    >
                      Email Address
                    </Text>
                    {visibleListColumns.map(list => (
                      <Text
                        key={list.key}
                        width={140}
                        fontSize="$3"
                        fontWeight="600"
                        color="$gray12"
                        textAlign="center"
                      >
                        {list.label}
                      </Text>
                    ))}
                  </XStack>

                  {/* Table Body */}
                  <ScrollView maxHeight={600}>
                    {filteredContacts.map(([email, preferences], index) => {
                      const isEven = index % 2 === 0

                      return (
                        <XStack
                          key={email}
                          backgroundColor={isEven ? '$background' : '$gray1'}
                          paddingVertical="$2"
                          paddingHorizontal="$4"
                          borderBottomWidth={1}
                          borderBottomColor="$gray3"
                          alignItems="center"
                          hoverStyle={{ backgroundColor: '$gray2' }}
                        >
                          <Text
                            width={300}
                            fontSize="$3"
                            color="$gray12"
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {email}
                          </Text>

                          {visibleListColumns.map(list => {
                            const isSubscribed = preferences[list.key]
                            const isUpdating = updating === `${email}-${list.key}`

                            return (
                              <XStack
                                key={list.key}
                                width={140}
                                justifyContent="center"
                                alignItems="center"
                              >
                                {isUpdating ? (
                                  <Spinner size="small" />
                                ) : (
                                  <Checkbox
                                    checked={isSubscribed}
                                    onCheckedChange={() =>
                                      handleToggleSubscription(email, list.key, isSubscribed)
                                    }
                                    size="$3"
                                  >
                                    <Checkbox.Indicator>
                                      <Check />
                                    </Checkbox.Indicator>
                                  </Checkbox>
                                )}
                              </XStack>
                            )
                          })}
                        </XStack>
                      )
                    })}
                  </ScrollView>
                </YStack>
              </ScrollView>
            </Card>
          ) : totalContacts > 0 ? (
            <Card elevate bordered padding="$6" backgroundColor="$background">
              <YStack alignItems="center" gap="$3">
                <Search size={48} color="$gray8" />
                <Text fontSize="$4" color="$gray11" textAlign="center">
                  No contacts match your search criteria
                </Text>
                <Text fontSize="$3" color="$gray10" textAlign="center">
                  Try adjusting your search term or filter
                </Text>
              </YStack>
            </Card>
          ) : (
            <Card elevate bordered padding="$6" backgroundColor="$background">
              <YStack alignItems="center" gap="$3">
                <UserPlus size={48} color="$gray8" />
                <Text fontSize="$4" color="$gray11" textAlign="center">
                  No contacts loaded yet
                </Text>
                <Text fontSize="$3" color="$gray10" textAlign="center">
                  Click "Load Contacts" to get started
                </Text>
              </YStack>
            </Card>
          )}
        </YStack>
      </Section>
    </Wrapper>
  )
}

// Helper function to simplify contact preferences
function simplifyPreferences(contacts: Contact[]): SimplifiedContacts | null {
  if (!contacts || contacts.length === 0) return null

  return contacts.reduce((acc: SimplifiedContacts, contact: Contact): SimplifiedContacts => {
    const email = contact.EmailAddress as string

    if (contact.UnsubscribeAll) {
      return {
        ...acc,
        unsubscribed: [...acc.unsubscribed, email],
      }
    }

    if (!contact.TopicPreferences) {
      return acc
    }

    const preferences = contact.TopicPreferences.reduce((p, pref) => {
      return {
        ...p,
        [pref.TopicName as EmailListTypeKeys]: pref.SubscriptionStatus === 'OPT_IN',
      }
    }, {} as ContactPreferences)

    return {
      ...acc,
      subscribed: { ...acc.subscribed, [email]: preferences },
    }
  }, { subscribed: {}, unsubscribed: [] } as SimplifiedContacts)
}