import { YStack, XStack, Text, Heading } from 'tamagui'
import { Button } from '../Button'
import { brandColors } from '../branding/brand-colors'

export type DirectoryTab = 'ecclesias' | 'people' | 'guests'

interface DirectoryTabsProps {
  activeTab: DirectoryTab
  onTabChange: (tab: DirectoryTab) => void
  pendingDraftCount?: number
  guestCount?: number
  showGuestTab?: boolean
}

export function DirectoryTabs({ activeTab, onTabChange, pendingDraftCount = 0, guestCount = 0, showGuestTab = false }: DirectoryTabsProps) {
  return (
    <YStack gap="$3">
      <YStack gap="$1">
        <Heading size="$7" fontWeight="700">Christadelphian Directory</Heading>
        <Text fontSize="$2" color="$gray11" fontStyle="italic">
          Malachi 3:16 Then those who feared the Lord spoke with one another. The Lord paid attention and heard them, and a book of remembrance was written before him of those who feared the Lord and esteemed his name.
        </Text>
      </YStack>
      <XStack gap="$2" flexWrap="wrap">
      <Button
        size="$4"
        backgroundColor={activeTab === 'ecclesias' ? brandColors.light.primary : 'transparent'}
        borderWidth={activeTab === 'ecclesias' ? 0 : 1}
        borderColor="$borderColor"
        onPress={() => onTabChange('ecclesias')}
        hoverStyle={{
          opacity: activeTab === 'ecclesias' ? 0.85 : 1,
          backgroundColor: activeTab === 'ecclesias' ? brandColors.light.primary : '$backgroundHover',
        }}
      >
        <Text
          color={activeTab === 'ecclesias' ? 'white' : '$textPrimary'}
          fontWeight={activeTab === 'ecclesias' ? '600' : '400'}
        >
          Ecclesia Directory
        </Text>
      </Button>

      <Button
        size="$4"
        backgroundColor={activeTab === 'people' ? brandColors.light.primary : 'transparent'}
        borderWidth={activeTab === 'people' ? 0 : 1}
        borderColor="$borderColor"
        onPress={() => onTabChange('people')}
        hoverStyle={{
          opacity: activeTab === 'people' ? 0.85 : 1,
          backgroundColor: activeTab === 'people' ? brandColors.light.primary : '$backgroundHover',
        }}
      >
        <XStack gap="$2" alignItems="center">
          <Text
            color={activeTab === 'people' ? 'white' : '$textPrimary'}
            fontWeight={activeTab === 'people' ? '600' : '400'}
          >
            Contact List
          </Text>
          {pendingDraftCount > 0 ? (
            <XStack
              backgroundColor="$yellow8"
              borderRadius="$10"
              paddingHorizontal="$1.5"
              paddingVertical="$0.5"
            >
              <Text color="white" fontSize="$1" fontWeight="700">
                {pendingDraftCount}
              </Text>
            </XStack>
          ) : null}
        </XStack>
      </Button>

      {showGuestTab ? (
        <Button
          size="$4"
          backgroundColor={activeTab === 'guests' ? brandColors.light.primary : 'transparent'}
          borderWidth={activeTab === 'guests' ? 0 : 1}
          borderColor="$borderColor"
          onPress={() => onTabChange('guests')}
          hoverStyle={{
            opacity: activeTab === 'guests' ? 0.85 : 1,
            backgroundColor: activeTab === 'guests' ? brandColors.light.primary : '$backgroundHover',
          }}
        >
          <XStack gap="$2" alignItems="center">
            <Text
              color={activeTab === 'guests' ? 'white' : '$textPrimary'}
              fontWeight={activeTab === 'guests' ? '600' : '400'}
            >
              Guests ({guestCount})
            </Text>
            {guestCount > 0 ? (
              <XStack
                backgroundColor="$orange8"
                borderRadius="$10"
                width={8}
                height={8}
              />
            ) : null}
          </XStack>
        </Button>
      ) : null}
    </XStack>
    </YStack>
  )
}
