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
import { ContactCard, MergeDialog, AddEmailDialog, MigrateEmailDialog, PersonSelectorDialog } from '@my/ui'
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
import {
  getContactsList,
  getContacts,
  addContacts,
  updateContacts,
  searchContacts,
  mergeContacts,
  migrateEmail,
  reorderEmails,
  unsubscribeAllLists,
  archiveEmail,
  unarchiveEmail
} from '@my/app/provider/get-data'
import {
  SimplifiedContactListType,
  SimplifiedContacts,
  ContactPreferences,
  EmailListTypeKeys
} from '@my/app/types'
import { Contact } from '@aws-sdk/client-sesv2'
import { AddUpdateList } from '../email-tester/dialogues/add-update-list'
import { AddUpdateContact } from '../email-tester/dialogues/add-update-contact'

type EmailStatus = 'active' | 'archived'

type EmailResult = {
  email: string
  inSES: boolean
  inDirectory: boolean
  isPrimary: boolean
  status: EmailStatus
  sesLists?: {
    sundaySchool?: boolean
    newsletter?: boolean
    memorial?: boolean
    bibleClass?: boolean
    members?: boolean
    testList?: boolean
  }
}

type PersonResult = {
  pkey: string
  baseSkey: string
  firstName: string
  lastName: string
  displayName: string
  isMember: boolean
  emails: EmailResult[]
  directoryData?: {
    address?: string
    phone?: string
    children?: string
    ecclesia?: string
  }
  isPotentialDuplicate?: boolean
  hasStaleLink?: boolean
  staleLinkSK?: string
}

const ALL_CONTACTS_LOADED = 'DONE'

// List names for column headers with visibility defaults
const listNames: { key: EmailListTypeKeys; label: string; defaultVisible: boolean }[] = [
  { key: 'sundaySchool', label: 'Sunday School', defaultVisible: true },
  { key: 'newsletter', label: 'Newsletter', defaultVisible: true },
  { key: 'memorial', label: 'Memorial', defaultVisible: true },
  { key: 'bibleClass', label: 'Bible Class', defaultVisible: true },
  { key: 'members', label: 'Members', defaultVisible: true },
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
  const [searchResults, setSearchResults] = useState<{ results: PersonResult[]; totalResults: number } | null>(null)
  const [searching, setSearching] = useState(false)
  const [visibleLists, setVisibleLists] = useState<Record<EmailListTypeKeys, boolean>>(
    listNames.reduce((acc, list) => ({ ...acc, [list.key]: list.defaultVisible }), {} as Record<EmailListTypeKeys, boolean>)
  )
  const [updating, setUpdating] = useState<string | null>(null)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [mergeSourcePerson, setMergeSourcePerson] = useState<PersonResult | undefined>()
  const [mergeTargetPerson, setMergeTargetPerson] = useState<PersonResult | undefined>()
  const [personSelectorOpen, setPersonSelectorOpen] = useState(false)
  const [addEmailDialogOpen, setAddEmailDialogOpen] = useState(false)
  const [addEmailPerson, setAddEmailPerson] = useState<PersonResult | undefined>()
  const [migrateEmailDialogOpen, setMigrateEmailDialogOpen] = useState(false)
  const [migrateEmailPerson, setMigrateEmailPerson] = useState<PersonResult | undefined>()
  const [migrateOldEmail, setMigrateOldEmail] = useState<string | undefined>()

  // Load contact lists on mount - must be declared before any conditional returns
  useEffect(() => {
    if (session?.user?.role === ROLES.ADMIN || session?.user?.role === ROLES.OWNER) {
      loadContactLists()
    }
  }, [session])

  // Filter and sort contacts - must be declared before any conditional returns
  const filteredPersons = useMemo((): PersonResult[] => {
    // If we have search results, return them directly (already person-centric)
    if (searchResults && searchResults.results) {
      return searchResults.results.sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      )
    }

    // Otherwise, we're not showing contacts in card view without search
    // This preserves the old table-based "Load All Contacts" flow
    return []
  }, [searchResults])

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

  const handleSearch = async () => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults(null)
      return
    }

    setSearching(true)
    try {
      const results = await searchContacts(searchTerm)
      setSearchResults(results)
    } catch (error) {
      console.error('Error searching contacts:', error)
      setSearchResults(null)
    } finally {
      setSearching(false)
    }
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setSearchResults(null)
  }

  const handleMerge = (person: PersonResult) => {
    setMergeSourcePerson(person)
    setPersonSelectorOpen(true)
  }

  const handleSelectMergeTarget = (target: PersonResult) => {
    setMergeTargetPerson(target)
    setMergeDialogOpen(true)
  }

  const handleConfirmMerge = async (sourcePK: string, sourceSK: string, targetPK: string, targetSK: string) => {
    try {
      await mergeContacts(sourcePK, sourceSK, targetPK, targetSK)
      // Refresh search results
      if (searchTerm) {
        await handleSearch()
      }
    } catch (error) {
      console.error('Error merging contacts:', error)
      throw error
    }
  }

  const handleMigrate = (oldEmail: string, person: PersonResult) => {
    setMigrateEmailPerson(person)
    setMigrateOldEmail(oldEmail)
    setMigrateEmailDialogOpen(true)
  }

  const handleConfirmMigrate = async (person: PersonResult, oldEmail: string, newEmail: string) => {
    try {
      await migrateEmail(oldEmail, newEmail, person.pkey, person.baseSkey)
      // Refresh search results
      if (searchTerm) {
        await handleSearch()
      }
    } catch (error) {
      console.error('Error migrating email:', error)
      throw error
    }
  }

  const handleReorder = async (person: PersonResult, emails: string[]) => {
    try {
      await reorderEmails(person.pkey, emails)
      // Update search results locally
      if (searchResults) {
        const updatedResults = searchResults.results.map((p) => {
          if (p.pkey === person.pkey) {
            // Reorder emails
            const reorderedEmails = emails.map((email, index) => {
              const emailData = p.emails.find((e) => e.email === email)
              return emailData ? { ...emailData, isPrimary: index === 0 } : null
            }).filter(Boolean) as EmailResult[]
            return { ...p, emails: reorderedEmails }
          }
          return p
        })
        setSearchResults({ ...searchResults, results: updatedResults })
      }
    } catch (error) {
      console.error('Error reordering emails:', error)
    }
  }

  const handleUnsubscribeAll = async (email: string) => {
    if (!confirm(`Are you sure you want to unsubscribe ${email} from all lists? This action cannot be undone.`)) {
      return
    }

    try {
      await unsubscribeAllLists(email)
      // Update search results locally
      if (searchResults) {
        const updatedResults = searchResults.results.map((person) => {
          const updatedEmails = person.emails.map((e) => {
            if (e.email === email) {
              return {
                ...e,
                sesLists: {
                  sundaySchool: false,
                  newsletter: false,
                  memorial: false,
                  bibleClass: false,
                  members: false,
                  testList: false
                }
              }
            }
            return e
          })
          return { ...person, emails: updatedEmails }
        })
        setSearchResults({ ...searchResults, results: updatedResults })
      }
    } catch (error) {
      console.error('Error unsubscribing:', error)
    }
  }

  const handleAddEmail = (person: PersonResult) => {
    setAddEmailPerson(person)
    setAddEmailDialogOpen(true)
  }

  const handleConfirmAddEmail = async (person: PersonResult, newEmail: string) => {
    try {
      // Note: We need to create an API endpoint for this
      // For now, this will call a placeholder
      console.log('Adding email:', newEmail, 'to person:', person.displayName)
      // TODO: Implement API call
      // await addEmailToDirectory(person.pkey, person.baseSkey, newEmail)

      // Refresh search results
      if (searchTerm) {
        await handleSearch()
      }
    } catch (error) {
      console.error('Error adding email:', error)
      throw error
    }
  }

  const handleArchive = async (person: PersonResult, email: string) => {
    try {
      await archiveEmail(person.pkey, email)
      // Update search results locally
      if (searchResults) {
        const updatedResults = searchResults.results.map((p) => {
          if (p.pkey === person.pkey) {
            const updatedEmails = p.emails.map((e) => {
              if (e.email === email) {
                return { ...e, status: 'archived' as EmailStatus }
              }
              return e
            })
            return { ...p, emails: updatedEmails }
          }
          return p
        })
        setSearchResults({ ...searchResults, results: updatedResults })
      }
    } catch (error) {
      console.error('Error archiving email:', error)
      alert('Failed to archive email. ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleUnarchive = async (person: PersonResult, email: string) => {
    try {
      await unarchiveEmail(person.pkey, email)
      // Update search results locally
      if (searchResults) {
        const updatedResults = searchResults.results.map((p) => {
          if (p.pkey === person.pkey) {
            const updatedEmails = p.emails.map((e) => {
              if (e.email === email) {
                return { ...e, status: 'active' as EmailStatus }
              }
              return e
            })
            return { ...p, emails: updatedEmails }
          }
          return p
        })
        setSearchResults({ ...searchResults, results: updatedResults })
      }
    } catch (error) {
      console.error('Error unarchiving email:', error)
      alert('Failed to unarchive email. ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleSaveSubscriptions = async (
    changes: { email: string; list: EmailListTypeKeys; subscribed: boolean }[]
  ) => {
    setUpdating('saving-batch')

    try {
      // Group changes by email
      const changesByEmail: Record<string, Record<EmailListTypeKeys, boolean>> = {}
      changes.forEach(({ email, list, subscribed }) => {
        if (!changesByEmail[email]) {
          changesByEmail[email] = {}
        }
        changesByEmail[email][list] = subscribed
      })

      // Process each email's changes
      for (const [email, listChanges] of Object.entries(changesByEmail)) {
        // Find current preferences and check if email exists in SES
        let currentPreferences: any = {}
        let inSES = false

        if (searchResults && searchResults.results) {
          searchResults.results.forEach((person) => {
            const emailData = person.emails.find((e) => e.email === email)
            if (emailData) {
              inSES = emailData.inSES
              if (emailData.sesLists) {
                currentPreferences = emailData.sesLists
              }
            }
          })
        } else if (allContacts.subscribed[email]) {
          inSES = true
          currentPreferences = allContacts.subscribed[email]
        }

        // Merge with pending changes
        const newPreferences = {
          ...currentPreferences,
          ...listChanges
        }

        // If email doesn't exist in SES yet, create it first
        if (!inSES) {
          console.log(`Creating new SES contact for ${email}`)
          await addContacts({ email, lists: newPreferences })
        } else {
          // Email exists, update it
          await updateContacts({ email, lists: newPreferences })
        }

        // Update local state if contact is in allContacts
        if (allContacts.subscribed[email]) {
          setAllContacts(prev => ({
            ...prev,
            subscribed: {
              ...prev.subscribed,
              [email]: newPreferences
            }
          }))
        }
      }

      // Update search results if they exist
      if (searchResults && searchResults.results) {
        const updatedResults = searchResults.results.map((person) => {
          const updatedEmails = person.emails.map((emailData) => {
            // Check if this email has changes
            const emailChanges = changesByEmail[emailData.email]
            if (emailChanges) {
              return {
                ...emailData,
                inSES: true, // Email is now in SES if subscribed to any list
                sesLists: {
                  ...emailData.sesLists,
                  ...emailChanges
                }
              }
            }
            return emailData
          })
          return { ...person, emails: updatedEmails }
        })
        setSearchResults({
          ...searchResults,
          results: updatedResults
        })
      }
    } catch (error) {
      console.error('Error updating subscription:', error)
    } finally {
      setUpdating(null)
    }
  }

  const totalContacts = Object.keys(allContacts.subscribed).length

  return (
    <Wrapper subHeader="Email Lists Management">
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
                <XStack gap="$3" alignItems="center" flexWrap="wrap">
                  <XStack flex={1} alignItems="center" gap="$2" minWidth={300}>
                    <Search size={20} color="$gray10" />
                    <Input
                      flex={1}
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChangeText={setSearchTerm}
                      size="$4"
                      onSubmitEditing={handleSearch}
                    />
                  </XStack>

                  <Button
                    size="$4"
                    icon={Search}
                    onPress={handleSearch}
                    disabled={searching || searchTerm.length < 2}
                    theme="active"
                  >
                    {searching ? (
                      <XStack gap="$2" alignItems="center">
                        <Spinner size="small" color="$background" />
                        <Text>Searching...</Text>
                      </XStack>
                    ) : (
                      <Text>Search All</Text>
                    )}
                  </Button>

                  {searchResults && (
                    <Button
                      size="$4"
                      onPress={handleClearSearch}
                      theme="gray"
                    >
                      Clear Results
                    </Button>
                  )}
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

                {/* Status Display */}
                <XStack gap="$3" alignItems="center" flexWrap="wrap">
                  {!searchResults && (
                    <Button
                      size="$4"
                      icon={totalContacts === 0 ? Download : RefreshCw}
                      onPress={() => loadContacts(true)}
                      disabled={loading}
                      theme="blue"
                    >
                      {loading ? (
                        <XStack gap="$2" alignItems="center">
                          <Spinner size="small" color="$background" />
                          <Text>Loading...</Text>
                        </XStack>
                      ) : totalContacts === 0 ? (
                        <Text>Load All Contacts</Text>
                      ) : (
                        <Text>Refresh All Contacts</Text>
                      )}
                    </Button>
                  )}

                  <XStack flex={1} />

                  {searchResults ? (
                    <XStack gap="$3" alignItems="center">
                      <Text fontSize="$4" fontWeight="600" color="$blue10">
                        {filteredPersons.length} {filteredPersons.length === 1 ? 'result' : 'results'} found
                      </Text>
                      <Text fontSize="$3" color="$gray11">
                        (searched both SES and Directory)
                      </Text>
                    </XStack>
                  ) : totalContacts > 0 ? (
                    <XStack gap="$3" alignItems="center">
                      <Text fontSize="$3" color="$gray11">
                        {totalContacts} total contacts loaded
                      </Text>
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

          {/* Contact Cards (shown when search results available) */}
          {filteredPersons.length > 0 ? (
            <ScrollView maxHeight={700}>
              <YStack gap="$3">
                {filteredPersons.map((person) => (
                  <ContactCard
                    key={person.baseSkey}
                    person={person}
                    onMerge={handleMerge}
                    onMigrate={handleMigrate}
                    onReorder={handleReorder}
                    onUnsubscribeAll={handleUnsubscribeAll}
                    onAddEmail={handleAddEmail}
                    onArchive={handleArchive}
                    onUnarchive={handleUnarchive}
                    onSaveSubscriptions={handleSaveSubscriptions}
                    isAdminOrHigher={userRole === ROLES.ADMIN || userRole === ROLES.OWNER}
                  />
                ))}
              </YStack>
            </ScrollView>
          ) : searchResults ? (
            <Card elevate bordered padding="$6" backgroundColor="$background">
              <YStack alignItems="center" gap="$3">
                <Search size={48} color="$gray8" />
                <Text fontSize="$4" color="$gray11" textAlign="center">
                  No results found
                </Text>
                <Text fontSize="$3" color="$gray10" textAlign="center">
                  Try a different search term
                </Text>
              </YStack>
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

      {/* Person Selector Dialog */}
      <PersonSelectorDialog
        open={personSelectorOpen}
        onOpenChange={setPersonSelectorOpen}
        sourcePerson={mergeSourcePerson}
        availablePersons={filteredPersons}
        onSelectTarget={handleSelectMergeTarget}
      />

      {/* Merge Dialog */}
      <MergeDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        sourcePerson={mergeSourcePerson}
        targetPerson={mergeTargetPerson}
        onConfirmMerge={handleConfirmMerge}
      />

      {/* Add Email Dialog */}
      <AddEmailDialog
        open={addEmailDialogOpen}
        onOpenChange={setAddEmailDialogOpen}
        person={addEmailPerson}
        onAddEmail={handleConfirmAddEmail}
      />

      {/* Migrate Email Dialog */}
      <MigrateEmailDialog
        open={migrateEmailDialogOpen}
        onOpenChange={setMigrateEmailDialogOpen}
        person={migrateEmailPerson}
        oldEmail={migrateOldEmail}
        onMigrateEmail={handleConfirmMigrate}
      />
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

    // Parse attributes data to extract first and last name and member status
    let firstName = ''
    let lastName = ''
    let displayName = ''
    let isMember = false

    const contactWithAttributes = contact as any
    if (contactWithAttributes.AttributesData) {
      try {
        const attributes = JSON.parse(contactWithAttributes.AttributesData)
        firstName = attributes.firstName || ''
        lastName = attributes.lastName || ''
        displayName = attributes.displayName || `${firstName} ${lastName}`.trim()
        isMember = attributes.isMember || false
      } catch (e) {
        // If parsing fails, use empty strings
      }
    }

    const preferences = contact.TopicPreferences.reduce((p, pref) => {
      return {
        ...p,
        [pref.TopicName as EmailListTypeKeys]: pref.SubscriptionStatus === 'OPT_IN',
      }
    }, {} as any)

    const contactPreferences: ContactPreferences = {
      ...preferences,
      unsubscribed: false,
      displayName,
      firstName,
      lastName,
      isMember
    }

    return {
      ...acc,
      subscribed: { ...acc.subscribed, [email]: contactPreferences },
    }
  }, { subscribed: {}, unsubscribed: [] } as SimplifiedContacts)
}