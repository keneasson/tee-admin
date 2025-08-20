'use client'

import { YStack, XStack, Card, Text } from '@my/ui'

// Test with truly missing/undefined params - matching real usage patterns
function TestStepSummaryWithRealUndefined({
  step = 'components',
  selectedType,  // No default - truly undefined
  formData = {},  // Empty object - no properties defined
  activeComponents // No default - truly undefined
}) {

  return (
    <Card
      padding="$3"
      backgroundColor="$red1"
      marginBottom="$4"
      borderWidth={1}
      borderColor="$red5"
    >
      <YStack space="$2">
        <Text fontSize="$4" fontWeight="600" color="$red11">
          Test with Undefined/Empty Values
        </Text>
        {step === 'components' && (<XStack space="$4" flexWrap="wrap">
            <XStack space="$2" alignItems="center">
              <Text fontSize="$3" fontWeight="600" color="$red11">
                Type:
              </Text>
              <Text fontSize="$3" color="$red11">
                {selectedType?.replace('-', ' ') || 'No type'}
              </Text>
            </XStack>
            <XStack space="$2" alignItems="center">
              <Text fontSize="$3" fontWeight="600" color="$red11">
                Title:
              </Text>
              <Text fontSize="$3" color="$red11">
                {formData.title || 'Untitled'}
              </Text>
            </XStack>
            {selectedType === 'baptism' && formData.candidate && (
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$red11">
                  Candidate:
                </Text>
                <Text
                  fontSize="$3"
                  color="$red11"
                >{`${formData.candidate.firstName} ${formData.candidate.lastName}`}</Text>
              </XStack>
            )}
            {selectedType === 'study-weekend' && formData.theme && (
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$red11">
                  Theme:
                </Text>
                <Text fontSize="$3" color="$red11">
                  {formData.theme}
                </Text>
              </XStack>
            )}
            {selectedType === 'wedding' && formData.couple && (
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$red11">
                  Couple:
                </Text>
                <Text
                  fontSize="$3"
                  color="$red11"
                >{`${formData.couple.bride?.firstName || ''} & ${formData.couple.groom?.firstName || ''}`}</Text>
              </XStack>
            )}
          </XStack>)}
      </YStack>
    </Card>
  )
}

// Original test with populated data
function TestStepSummary() {
  const step = 'components'
  const selectedType = 'study-weekend'
  const formData = {
    title: 'Test Event',
    theme: 'Test Theme',
    candidate: {
      firstName: 'John',
      lastName: 'Doe'
    },
    couple: {
      bride: { firstName: 'Jane', lastName: 'Smith' },
      groom: { firstName: 'John', lastName: 'Doe' }
    }
  }
  const activeComponents = ['description', 'location']

  return (
    <Card
      padding="$3"
      backgroundColor="$blue1"
      marginBottom="$4"
      borderWidth={1}
      borderColor="$blue5"
    >
      <YStack space="$2">
        <Text fontSize="$4" fontWeight="600" color="$blue11">
          Previous Details
        </Text>
        {step === 'components' && (<XStack space="$4" flexWrap="wrap">
            <XStack space="$2" alignItems="center">
              <Text fontSize="$3" fontWeight="600" color="$blue11">
                Type:
              </Text>
              <Text fontSize="$3" color="$blue11">
                {selectedType?.replace('-', ' ')}
              </Text>
            </XStack>
            <XStack space="$2" alignItems="center">
              <Text fontSize="$3" fontWeight="600" color="$blue11">
                Title:
              </Text>
              <Text fontSize="$3" color="$blue11">
                {formData.title || 'Untitled'}
              </Text>
            </XStack>
            {selectedType === 'baptism' && formData.candidate && (
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$blue11">
                  Candidate:
                </Text>
                <Text
                  fontSize="$3"
                  color="$blue11"
                >{`${formData.candidate.firstName} ${formData.candidate.lastName}`}</Text>
              </XStack>
            )}
            {selectedType === 'study-weekend' && formData.theme && (
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$blue11">
                  Theme:
                </Text>
                <Text fontSize="$3" color="$blue11">
                  {formData.theme}
                </Text>
              </XStack>
            )}
            {selectedType === 'wedding' && formData.couple && (
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$blue11">
                  Couple:
                </Text>
                <Text
                  fontSize="$3"
                  color="$blue11"
                >{`${formData.couple.bride?.firstName || ''} & ${formData.couple.groom?.firstName || ''}`}</Text>
              </XStack>
            )}
          </XStack>)}
        {step === 'review' && (<YStack space="$1">
            <XStack space="$4" flexWrap="wrap">
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$blue11">
                  Type:
                </Text>
                <Text fontSize="$3" color="$blue11">
                  {selectedType?.replace('-', ' ')}
                </Text>
              </XStack>
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$blue11">
                  Title:
                </Text>
                <Text fontSize="$3" color="$blue11">
                  {formData.title || 'Untitled'}
                </Text>
              </XStack>
            </XStack>
            {activeComponents.length > 0 && (
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$blue11">
                  Optional fields added:
                </Text>
                <Text fontSize="$3" color="$blue11">
                  {activeComponents.length}
                </Text>
              </XStack>
            )}
          </YStack>)}
      </YStack>
    </Card>
  )
}

export default function TextNodeTestPage() {
  return (
    <YStack padding="$4" space="$4" maxWidth={800} alignSelf="center">
      <Text fontSize="$8" fontWeight="bold">Text Node Debug Test</Text>
      <Text fontSize="$4" color="$gray11">
        Testing the isolated StepSummary component with various data states
      </Text>
      
      <Text fontSize="$5" fontWeight="600">1. Test with Populated Data</Text>
      <TestStepSummary />
      
      <Text fontSize="$5" fontWeight="600">2. Test with Real Undefined Parameters</Text>
      <TestStepSummaryWithRealUndefined />
      
      <Text fontSize="$5" fontWeight="600">3. Test with Missing Properties</Text>
      <TestStepSummaryWithRealUndefined 
        selectedType={undefined}
        formData={undefined} 
        activeComponents={undefined}
      />
      
      <Text fontSize="$5" fontWeight="600">4. Test Edge Case: Empty Strings in Template</Text>
      <TestStepSummaryWithRealUndefined 
        selectedType=""
        formData={{ 
          couple: { 
            bride: { firstName: "", lastName: "" },
            groom: { firstName: "", lastName: "" }
          }
        }}
        activeComponents={[]}
      />
      
      <Text fontSize="$5" fontWeight="600">5. Test Problematic Template String</Text>
      <TestStepSummaryWithRealUndefined 
        selectedType="wedding"
        formData={{ 
          title: "",
          couple: { 
            bride: { firstName: "", lastName: "" },
            groom: { firstName: "", lastName: "" }
          }
        }}
        activeComponents={[]}
      />
      
      <Text fontSize="$3" color="$gray10">
        ✅ All test scenarios load - checking for text node errors...
      </Text>
      
      <Text fontSize="$2" color="$gray9">
        If you see this text, the component handles various undefined/empty states.
        Check browser console for any "Unexpected text node" errors.
      </Text>
    </YStack>
  )
}