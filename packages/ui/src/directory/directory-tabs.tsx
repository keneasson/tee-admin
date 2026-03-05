import { XStack, Text } from 'tamagui'
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
  )
}
