'use client'

import { useState } from 'react'
import { YStack, XStack, Text, H2, H3, H4, Button, Separator, View, Switch } from '@my/ui'
import { useFeatureFlags, useFeatureFlag } from '@my/app/features/feature-flags'
import { FEATURE_FLAGS, featureFlagConfigs } from '@my/app/features/feature-flags/feature-flags'
import { ComponentShowcase } from './component-showcase'

export function FeaturePlayground() {
  const allFlags = useFeatureFlags()
  const [localOverrides, setLocalOverrides] = useState<Record<string, boolean>>({})
  
  const toggleLocalOverride = (flag: string) => {
    setLocalOverrides(prev => ({
      ...prev,
      [flag]: !prev[flag]
    }))
  }
  
  return (
    <YStack gap="$6" padding="$4">
      <YStack gap="$4">
        <H2>Feature Flag Playground</H2>
        <Text color="$textSecondary" fontSize="$4">
          Safely test and roll out new features with controlled experimentation.
        </Text>
        
        <XStack gap="$3" flexWrap="wrap">
          <View flex={1} minWidth={300} backgroundColor="$success" padding="$3" borderRadius="$3" borderWidth={1} borderColor="$successForeground">
            <Text color="$successForeground" fontWeight="600" marginBottom="$2">
              🚀 Quick Start Guide
            </Text>
            <YStack gap="$1">
              <Text color="$successForeground" fontSize="$3">
                1. Click \"Override\" to test a feature locally
              </Text>
              <Text color="$successForeground" fontSize="$3">
                2. See how it looks in the examples below
              </Text>
              <Text color="$successForeground" fontSize="$3">
                3. Click \"Reset\" to return to production settings
              </Text>
              <Text color="$successForeground" fontSize="$3">
                4. When ready, update rollout % in code
              </Text>
            </YStack>
          </View>
          
          <View flex={1} minWidth={300} backgroundColor="$info" padding="$3" borderRadius="$3" borderWidth={1} borderColor="$infoForeground">
            <Text color="$infoForeground" fontWeight="600" marginBottom="$2">
              📚 How Feature Flags Work
            </Text>
            <YStack gap="$1">
              <Text color="$infoForeground" fontSize="$3">
                • Control who sees new features and when
              </Text>
              <Text color="$infoForeground" fontSize="$3">
                • Roll back features instantly if issues arise
              </Text>
              <Text color="$infoForeground" fontSize="$3">
                • A/B test different designs and measure impact
              </Text>
              <Text color="$infoForeground" fontSize="$3">
                • Deploy features gradually from 0% to 100%
              </Text>
            </YStack>
          </View>
        </XStack>
      </YStack>
      
      <Separator />
      
      {/* Feature Flag Controls */}
      <YStack gap="$4">
        <H3>Feature Flag Controls</H3>
        <Text color="$textSecondary" fontSize="$3">
          Control feature visibility and test different behaviors. Changes here only affect YOUR session.
        </Text>
        
        <View backgroundColor="$backgroundTertiary" padding="$3" borderRadius="$3" borderWidth={1} borderColor="$border">
          <Text fontWeight="600" marginBottom="$2">🎯 Button Guide:</Text>
          <YStack gap="$1">
            <XStack gap="$2" alignItems="center">
              <View backgroundColor="$warning" padding="$1" borderRadius="$1">
                <Text fontSize="$2" color="$warningForeground" fontWeight="600">OVERRIDE</Text>
              </View>
              <Text fontSize="$3">→ You've manually toggled this flag (local testing only)</Text>
            </XStack>
            <XStack gap="$2" alignItems="center">
              <Button size="$2" variant="outlined">Reset</Button>
              <Text fontSize="$3">→ Remove your override, return to production setting</Text>
            </XStack>
            <XStack gap="$2" alignItems="center">
              <Button size="$2">Override</Button>
              <Text fontSize="$3">→ Force enable/disable this flag for testing</Text>
            </XStack>
          </YStack>
        </View>
        
        <YStack gap="$3">
          {Object.entries(FEATURE_FLAGS).map(([key, flag]) => {
            const config = featureFlagConfigs[flag]
            const isEnabled = allFlags[flag]
            const hasLocalOverride = flag in localOverrides
            const effectiveState = hasLocalOverride ? localOverrides[flag] : isEnabled
            
            return (
              <XStack
                key={flag}
                justifyContent="space-between"
                alignItems="center"
                padding="$3"
                backgroundColor="$backgroundSecondary"
                borderRadius="$3"
                borderWidth={1}
                borderColor="$borderLight"
              >
                <YStack flex={1} gap="$1">
                  <XStack alignItems="center" gap="$2">
                    <Text fontWeight="600" fontSize="$3">
                      {key.replace(/_/g, ' ')}
                    </Text>
                    {hasLocalOverride && (
                      <View
                        backgroundColor="$warning"
                        paddingHorizontal="$1"
                        paddingVertical="$0.5"
                        borderRadius="$1"
                      >
                        <Text color="$warningForeground" fontSize="$1">
                          OVERRIDE
                        </Text>
                      </View>
                    )}
                  </XStack>
                  <Text color="$textSecondary" fontSize="$2">
                    {config.description}
                  </Text>
                  <XStack gap="$2" alignItems="center">
                    <Text fontSize="$2" color="$textTertiary">
                      Rollout: {config.rolloutPercentage}%
                    </Text>
                    <Text fontSize="$2" color="$textTertiary">
                      Env: {config.environment}
                    </Text>
                    <Text fontSize="$2" color="$textTertiary">
                      Roles: {config.userRoles?.join(', ') || 'All'}
                    </Text>
                  </XStack>
                </YStack>
                
                <XStack gap="$2" alignItems="center">
                  <Text fontSize="$2" color={effectiveState ? '$success' : '$error'}>
                    {effectiveState ? 'ON' : 'OFF'}
                  </Text>
                  <Button
                    size="$2"
                    variant={hasLocalOverride ? 'outlined' : undefined}
                    onPress={() => toggleLocalOverride(flag)}
                  >
                    {hasLocalOverride ? 'Reset' : 'Override'}
                  </Button>
                </XStack>
              </XStack>
            )
          })}
        </YStack>
      </YStack>
      
      <Separator />
      
      {/* Live Feature Testing */}
      <YStack gap="$4">
        <H3>Live Feature Testing</H3>
        <Text color="$textSecondary" fontSize="$3">
          See how different feature flags affect component behavior in real-time.
        </Text>
        
        <ComponentShowcase
          title="Brand Color Integration"
          description="Test how the new brand colors affect various components."
          variants={[
            {
              name: 'Original Colors',
              component: (
                <XStack gap="$2">
                  <Button backgroundColor="#007AFF" color="white">
                    Original Primary
                  </Button>
                  <Button backgroundColor="#5856D6" color="white">
                    Original Secondary
                  </Button>
                  <Button backgroundColor="#FF9500" color="white">
                    Original Accent
                  </Button>
                </XStack>
              )
            },
            {
              name: 'New Brand Colors',
              component: (
                <XStack gap="$2">
                  <Button backgroundColor="$primary" color="$primaryForeground">
                    New Primary
                  </Button>
                  <Button backgroundColor="$secondary" color="$secondaryForeground">
                    New Secondary
                  </Button>
                  <Button backgroundColor="$accent" color="$accentForeground">
                    New Accent
                  </Button>
                </XStack>
              )
            }
          ]}
        />
        
        <ComponentShowcase
          title="Typography Enhancement"
          description="Compare typography before and after enhancements."
          variants={[
            {
              name: 'Current Typography',
              component: (
                <YStack gap="$2">
                  <Text fontSize="$6" fontWeight="700">
                    Current Heading Style
                  </Text>
                  <Text fontSize="$4">
                    Current body text with standard styling and spacing.
                  </Text>
                  <Text fontSize="$2" color="$textSecondary">
                    Current caption text styling.
                  </Text>
                </YStack>
              )
            },
            {
              name: 'Enhanced Typography',
              component: (
                <YStack gap="$3">
                  <Text fontSize="$8" fontWeight="700" letterSpacing={-1}>
                    Enhanced Heading Style
                  </Text>
                  <Text fontSize="$4" lineHeight="$6">
                    Enhanced body text with improved line height and spacing for better readability.
                  </Text>
                  <Text fontSize="$2" color="$textTertiary" fontWeight="500">
                    Enhanced caption with better contrast.
                  </Text>
                </YStack>
              )
            }
          ]}
        />
        
        <ComponentShowcase
          title="Form Component Improvements"
          description="Test enhanced form components with better accessibility."
          variants={[
            {
              name: 'Current Forms',
              component: (
                <YStack gap="$2">
                  <Text fontSize="$3">Email Address</Text>
                  <View
                    borderWidth={1}
                    borderColor="$borderLight"
                    borderRadius="$2"
                    padding="$2"
                  >
                    <Text color="$textTertiary">user@example.com</Text>
                  </View>
                </YStack>
              )
            },
            {
              name: 'Enhanced Forms',
              component: (
                <YStack gap="$2">
                  <Text fontSize="$3" fontWeight="600" color="$textPrimary">
                    Email Address
                  </Text>
                  <View
                    borderWidth={2}
                    borderColor="$primary"
                    borderRadius="$3"
                    padding="$3"
                    backgroundColor="$backgroundTertiary"
                  >
                    <Text color="$textPrimary">user@example.com</Text>
                  </View>
                  <Text fontSize="$2" color="$success">
                    ✓ Valid email format
                  </Text>
                </YStack>
              )
            }
          ]}
        />
      </YStack>
      
      <Separator />
      
      {/* Integration Testing */}
      <YStack gap="$4">
        <H3>Integration Testing</H3>
        <Text color="$textSecondary" fontSize="$3">
          Test how multiple feature flags work together.
        </Text>
        
        <View
          backgroundColor="$backgroundSecondary"
          borderRadius="$4"
          padding="$4"
          borderWidth={1}
          borderColor="$borderLight"
        >
          <YStack gap="$3">
            <H4>Sample Page Layout</H4>
            
            {/* Header */}
            <View
              backgroundColor="$primary"
              padding="$3"
              borderRadius="$3"
            >
              <Text color="$primaryForeground" fontWeight="600">
                TEE Admin Header (with new brand colors)
              </Text>
            </View>
            
            {/* Navigation */}
            <XStack gap="$2">
              <View backgroundColor="$secondary" padding="$2" borderRadius="$2">
                <Text color="$secondaryForeground" fontSize="$2">Home</Text>
              </View>
              <View backgroundColor="$accent" padding="$2" borderRadius="$2">
                <Text color="$accentForeground" fontSize="$2">Events</Text>
              </View>
              <View backgroundColor="$backgroundTertiary" padding="$2" borderRadius="$2">
                <Text color="$textPrimary" fontSize="$2">Schedule</Text>
              </View>
            </XStack>
            
            {/* Content */}
            <YStack gap="$2">
              <Text fontSize="$8" fontWeight="700" color="$textPrimary">
                Page Heading
              </Text>
              <Text fontSize="$4" color="$textSecondary">
                Sample content showing how all the components work together with the new brand system.
              </Text>
            </YStack>
            
            {/* Actions */}
            <XStack gap="$2">
              <Button backgroundColor="$success" color="$successForeground">
                Save Changes
              </Button>
              <Button backgroundColor="$error" color="$errorForeground">
                Delete Item
              </Button>
              <Button backgroundColor="$warning" color="$warningForeground">
                Archive
              </Button>
            </XStack>
          </YStack>
        </View>
      </YStack>
      
      <Separator />
      
      {/* Feature Flag Rollout Guide */}
      <YStack gap="$4">
        <H3>🚀 Feature Rollout Strategy</H3>
        <Text color="$textSecondary" fontSize="$3">
          Step-by-step guide to safely rolling out new features to users.
        </Text>
        
        <YStack gap="$3">
          <View backgroundColor="$success" padding="$3" borderRadius="$3" borderWidth={1} borderColor="$successForeground">
            <Text color="$successForeground" fontWeight="600" marginBottom="$2">
              🟢 Phase 1: Development Testing (0% rollout)
            </Text>
            <Text color="$successForeground" fontSize="$3">
              • Feature flag OFF for all users (rolloutPercentage: 0%)
            </Text>
            <Text color="$successForeground" fontSize="$3">
              • Developers use Override button to test locally
            </Text>
            <Text color="$successForeground" fontSize="$3">
              • Run automated tests, check accessibility, verify mobile
            </Text>
            <Text color="$successForeground" fontSize="$3">
              • Duration: 1-2 weeks depending on feature complexity
            </Text>
          </View>
          
          <View backgroundColor="$warning" padding="$3" borderRadius="$3" borderWidth={1} borderColor="$warningForeground">
            <Text color="$warningForeground" fontWeight="600" marginBottom="$2">
              🟡 Phase 2: Beta Testing (5-10% rollout)
            </Text>
            <Text color="$warningForeground" fontSize="$3">
              • Enable for admin/owner roles only OR 5-10% of users
            </Text>
            <Text color="$warningForeground" fontSize="$3">
              • Monitor error rates, user feedback, and performance metrics
            </Text>
            <Text color="$warningForeground" fontSize="$3">
              • Ready to rollback instantly if issues are found
            </Text>
            <Text color="$warningForeground" fontSize="$3">
              • Duration: 1 week minimum, gather feedback
            </Text>
          </View>
          
          <View backgroundColor="$info" padding="$3" borderRadius="$3" borderWidth={1} borderColor="$infoForeground">
            <Text color="$infoForeground" fontWeight="600" marginBottom="$2">
              🔵 Phase 3: Gradual Rollout (25-50% rollout)
            </Text>
            <Text color="$infoForeground" fontSize="$3">
              • Increase to 25%, then 50% if metrics look good
            </Text>
            <Text color="$infoForeground" fontSize="$3">
              • Monitor server load, database performance, user satisfaction
            </Text>
            <Text color="$infoForeground" fontSize="$3">
              • A/B test performance vs old version
            </Text>
            <Text color="$infoForeground" fontSize="$3">
              • Duration: 1-2 weeks, collect data
            </Text>
          </View>
          
          <View backgroundColor="$primary" padding="$3" borderRadius="$3" borderWidth={1} borderColor="$primaryForeground">
            <Text color="$primaryForeground" fontWeight="600" marginBottom="$2">
              🔵 Phase 4: Full Rollout (100% rollout)
            </Text>
            <Text color="$primaryForeground" fontSize="$3">
              • Enable for all users once confident in stability
            </Text>
            <Text color="$primaryForeground" fontSize="$3">
              • Monitor for 1 week, then consider removing flag
            </Text>
            <Text color="$primaryForeground" fontSize="$3">
              • Clean up old code paths after successful rollout
            </Text>
            <Text color="$primaryForeground" fontSize="$3">
              • Document lessons learned for future rollouts
            </Text>
          </View>
        </YStack>
      </YStack>
      
      <Separator />
      
      {/* Emergency Procedures */}
      <YStack gap="$4">
        <H3>🆘 Emergency Procedures</H3>
        
        <View backgroundColor="$error" padding="$3" borderRadius="$3" borderWidth={1} borderColor="$errorForeground">
          <Text color="$errorForeground" fontWeight="600" marginBottom="$2">
            🚨 If Something Goes Wrong
          </Text>
          <Text color="$errorForeground" fontSize="$3" marginBottom="$2">
            Immediate rollback steps:
          </Text>
          <YStack gap="$1">
            <Text color="$errorForeground" fontSize="$3">
              1. Set rolloutPercentage to 0% in feature-flags.ts
            </Text>
            <Text color="$errorForeground" fontSize="$3">
              2. Deploy immediately (feature turns OFF for all users)
            </Text>
            <Text color="$errorForeground" fontSize="$3">
              3. Investigate issue in development environment
            </Text>
            <Text color="$errorForeground" fontSize="$3">
              4. Fix and re-test before attempting rollout again
            </Text>
          </YStack>
        </View>
      </YStack>
      
      <Separator />
      
      {/* Configuration Guide */}
      <YStack gap="$4">
        <H3>⚙️ Configuration Guide</H3>
        <Text color="$textSecondary" fontSize="$3">
          How to modify feature flag settings in the codebase.
        </Text>
        
        <View backgroundColor="$backgroundTertiary" padding="$3" borderRadius="$3" borderWidth={1} borderColor="$border">
          <Text fontWeight="600" marginBottom="$2">📝 Edit: packages/app/features/feature-flags/feature-flags.ts</Text>
          <YStack gap="$2">
            <Text fontSize="$3" color="$textSecondary">
              <Text fontWeight="600">rolloutPercentage</Text>: 0-100 (what % of users see this feature)
            </Text>
            <Text fontSize="$3" color="$textSecondary">
              <Text fontWeight="600">environment</Text>: 'development' | 'production' | 'all'
            </Text>
            <Text fontSize="$3" color="$textSecondary">
              <Text fontWeight="600">userRoles</Text>: ['admin', 'owner'] or undefined for all roles
            </Text>
            <Text fontSize="$3" color="$textSecondary">
              <Text fontWeight="600">description</Text>: Explain what this flag does
            </Text>
          </YStack>
        </View>
        
        <View backgroundColor="$backgroundSecondary" padding="$3" borderRadius="$3" borderWidth={1} borderColor="$borderLight">
          <Text fontWeight="600" marginBottom="$2">📊 Example Rollout Timeline</Text>
          <YStack gap="$1">
            <Text fontSize="$3">Week 1: rolloutPercentage: 0, userRoles: ['admin', 'owner']</Text>
            <Text fontSize="$3">Week 2: rolloutPercentage: 10, userRoles: undefined</Text>
            <Text fontSize="$3">Week 3: rolloutPercentage: 50, userRoles: undefined</Text>
            <Text fontSize="$3">Week 4: rolloutPercentage: 100, userRoles: undefined</Text>
            <Text fontSize="$3">Week 5: Remove flag entirely, clean up code</Text>
          </YStack>
        </View>
      </YStack>
      
      <Separator />
      
      <YStack gap="$2">
        <H3>🧠 Testing Checklist</H3>
        <Text color="$textSecondary" fontSize="$3">
          Complete this checklist before each rollout phase.
        </Text>
        
        <YStack gap="$1" marginTop="$2">
          <Text color="$textSecondary" fontSize="$3">
            ☑️ Use Override button to test flag combinations
          </Text>
          <Text color="$textSecondary" fontSize="$3">
            ☑️ Test with different user roles (admin, member, guest)
          </Text>
          <Text color="$textSecondary" fontSize="$3">
            ☑️ Verify accessibility (screen readers, keyboard navigation, contrast)
          </Text>
          <Text color="$textSecondary" fontSize="$3">
            ☑️ Check responsive behavior (mobile, tablet, desktop)
          </Text>
          <Text color="$textSecondary" fontSize="$3">
            ☑️ Validate cross-platform (web and mobile apps)
          </Text>
          <Text color="$textSecondary" fontSize="$3">
            ☑️ Monitor performance impact (load times, memory usage)
          </Text>
          <Text color="$textSecondary" fontSize="$3">
            ☑️ Test error scenarios and edge cases
          </Text>
          <Text color="$textSecondary" fontSize="$3">
            ☑️ Confirm rollback procedure works correctly
          </Text>
        </YStack>
      </YStack>
    </YStack>
  )
}