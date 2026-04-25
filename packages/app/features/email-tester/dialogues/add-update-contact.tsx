import { EmailListTypeKeys, EmailListTypes } from '@my/app/types'
import {
  Button,
  CheckboxWithCheck,
  Form,
  FullDialog,
  Input,
  ScrollView,
  Spinner,
  Text,
  XStack,
  YStack,
} from '@my/ui'
import { SubmitHandler, useForm } from 'react-hook-form'
import { addContacts } from '../../../provider/get-data'
import { useState, useCallback } from 'react'
import { Search } from '@tamagui/lucide-icons'

export type AddUpdateContactParams = {}

type PersonSearchResult = {
  id: string
  name: string
  email: string
  ecclesia?: string
}

type LinkContactFormType = {
  lists: { [K in EmailListTypeKeys]: boolean }
}

const listNameMap: { [K in EmailListTypeKeys]: string } = {
  sundaySchool: 'Sunday School',
  memorial: 'Memorial',
  bibleClass: 'Bible Class',
  newsletter: 'Newsletter',
  members: 'Members',
  interEcclesia: 'Inter-Ecclesia',
  testList: 'Test List',
}

export const AddUpdateContact: React.FC<AddUpdateContactParams> = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [isSending, setIsSending] = useState<boolean>(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PersonSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<PersonSearchResult | null>(null)

  const searchPeople = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const response = await fetch(`/api/people?search=${encodeURIComponent(query)}&noCache=true`)
      const data = await response.json()
      if (data.success) {
        setSearchResults((data.members || []).slice(0, 10))
      }
    } catch (error) {
      console.error('Error searching people:', error)
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const onSubmit: SubmitHandler<LinkContactFormType> = async (data) => {
    if (!selectedPerson) return

    setIsSending(true)
    try {
      const newContact = await addContacts({ lists: data.lists, email: selectedPerson.email })
      console.log('Contact subscribed:', newContact)
      // Reset state
      setSelectedPerson(null)
      setSearchQuery('')
      setSearchResults([])
      setIsOpen(false)
    } catch (error) {
      console.error('Error subscribing contact:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setSelectedPerson(null)
      setSearchQuery('')
      setSearchResults([])
    }
  }

  const { control, handleSubmit } = useForm<LinkContactFormType>()

  return (
    <FullDialog
      title="Link Contact"
      trigger="Link Contact"
      description="Find a person from the directory and subscribe them to email lists."
      isOpen={isOpen}
      setOpen={handleOpenChange}
    >
      <Form onSubmit={handleSubmit(onSubmit)}>
        <YStack gap="$3">
          {/* Person Search */}
          {selectedPerson ? (
            <YStack
              gap="$2"
              padding="$3"
              backgroundColor="$green3"
              borderRadius="$3"
              borderWidth={1}
              borderColor="$green7"
            >
              <Text fontSize="$2" color="$green11" fontWeight="600">
                Selected Person:
              </Text>
              <Text fontSize="$4" fontWeight="bold">
                {selectedPerson.name}
              </Text>
              <Text fontSize="$3" color="$gray11">
                {selectedPerson.email}
                {selectedPerson.ecclesia ? ` — ${selectedPerson.ecclesia}` : ''}
              </Text>
              <Button
                size="$2"
                variant="outlined"
                alignSelf="flex-start"
                onPress={() => {
                  setSelectedPerson(null)
                  setSearchQuery('')
                  setSearchResults([])
                }}
              >
                Change
              </Button>
            </YStack>
          ) : (
            <YStack gap="$2">
              <Text fontSize="$3" fontWeight="600">
                Search People
              </Text>
              <XStack gap="$2" alignItems="center">
                <Search size={18} color="$gray10" />
                <Input
                  flex={1}
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChangeText={searchPeople}
                  size="$4"
                />
              </XStack>
              {searchLoading ? (
                <XStack gap="$2" alignItems="center" paddingLeft="$2">
                  <Spinner size="small" width={14} height={14} />
                  <Text fontSize="$2" color="$gray11">
                    Searching...
                  </Text>
                </XStack>
              ) : null}
              {searchResults.length > 0 ? (
                <YStack
                  borderWidth={1}
                  borderColor="$gray6"
                  borderRadius="$3"
                  overflow="hidden"
                >
                  <ScrollView maxHeight={200}>
                    {searchResults.map((person) => (
                      <XStack
                        key={person.id}
                        padding="$3"
                        gap="$2"
                        alignItems="center"
                        hoverStyle={{ backgroundColor: '$blue3' }}
                        pressStyle={{ backgroundColor: '$blue4' }}
                        cursor="pointer"
                        onPress={() => {
                          setSelectedPerson(person)
                          setSearchResults([])
                          setSearchQuery('')
                        }}
                        borderBottomWidth={1}
                        borderBottomColor="$gray4"
                      >
                        <YStack flex={1}>
                          <Text fontSize="$4" fontWeight="600">
                            {person.name}
                          </Text>
                          <Text fontSize="$2" color="$gray11">
                            {person.email}
                            {person.ecclesia ? ` — ${person.ecclesia}` : ''}
                          </Text>
                        </YStack>
                      </XStack>
                    ))}
                  </ScrollView>
                </YStack>
              ) : null}
              {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 ? (
                <Text fontSize="$2" color="$gray10" fontStyle="italic" paddingLeft="$2">
                  No matching people found
                </Text>
              ) : null}
            </YStack>
          )}

          {/* List Checkboxes */}
          {(Object.keys(EmailListTypes) as EmailListTypeKeys[]).map((listType) => (
            <CheckboxWithCheck
              key={listType}
              control={control}
              name={`lists.${listType}`}
              label={listNameMap[listType]}
            />
          ))}

          <XStack alignSelf="flex-end" gap="$4">
            <Form.Trigger asChild disabled={isSending || !selectedPerson}>
              <Button
                theme={isSending ? 'blue_active' : 'blue'}
                aria-label="Save"
                opacity={selectedPerson ? 1 : 0.5}
              >
                {isSending ? 'Saving...' : 'Save changes'}
              </Button>
            </Form.Trigger>
          </XStack>
        </YStack>
      </Form>
    </FullDialog>
  )
}
