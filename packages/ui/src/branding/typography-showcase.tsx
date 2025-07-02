'use client'

import { useState } from 'react'
import { YStack, XStack, Text, H1, H2, H3, H4, H5, H6, Separator, Button, View } from '@my/ui'
import { brandTypography } from './brand-typography'

interface TypographyExampleProps {
  label: string
  style: any
  exampleText: string
  showSpecs?: boolean
}

function TypographyExample({ label, style, exampleText, showSpecs = false }: TypographyExampleProps) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = async () => {
    const styleString = JSON.stringify(style, null, 2)
    await navigator.clipboard.writeText(styleString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <YStack 
      gap="$2" 
      padding="$4" 
      borderWidth={1} 
      borderColor="$borderLight" 
      borderRadius="$4"
      pressStyle={{ backgroundColor: '$backgroundSecondary' }}
      cursor="pointer"
      onPress={handleCopy}
    >
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$2" color="$textSecondary" fontWeight="500">
          {label}
        </Text>
        {copied && (
          <Text fontSize="$2" color="$success">
            Copied!
          </Text>
        )}
      </XStack>
      
      <Text {...style}>
        {exampleText}
      </Text>
      
      {showSpecs && (
        <YStack gap="$1" marginTop="$2">
          <Text fontSize="$2" color="$textTertiary" fontFamily="$mono">
            Size: {style.fontSize} | Weight: {style.fontWeight}
          </Text>
          {style.letterSpacing && (
            <Text fontSize="$2" color="$textTertiary" fontFamily="$mono">
              Letter Spacing: {style.letterSpacing}
            </Text>
          )}
        </YStack>
      )}
    </YStack>
  )
}

export function TypographyShowcase() {
  const [showSpecs, setShowSpecs] = useState(false)
  
  const headingExamples = [
    { variant: 'h1', text: 'Main Page Title' },
    { variant: 'h2', text: 'Section Heading' }, 
    { variant: 'h3', text: 'Subsection Title' },
    { variant: 'h4', text: 'Component Title' },
    { variant: 'h5', text: 'Card Heading' },
    { variant: 'h6', text: 'Form Section' }
  ]
  
  const bodyExamples = [
    { variant: 'large', text: 'Large body text for important content and introductory paragraphs.' },
    { variant: 'base', text: 'Standard body text for regular content, articles, and general reading.' },
    { variant: 'small', text: 'Small body text for secondary information and compact layouts.' },
    { variant: 'emphasized', text: 'Emphasized body text for highlighting important information within content.' },
    { variant: 'subtle', text: 'Subtle body text for less important content and supporting information.' }
  ]
  
  const utilityExamples = [
    { variant: 'caption', text: 'Caption text for images, timestamps, and metadata.' },
    { variant: 'label', text: 'Form Label' },
    { variant: 'code', text: 'const example = "code text"' },
    { variant: 'link', text: 'Interactive link text' }
  ]
  
  const interactiveExamples = [
    { variant: 'button', text: 'Button Text' },
    { variant: 'buttonSmall', text: 'Small Button' },
    { variant: 'buttonLarge', text: 'Large Button' }
  ]
  
  return (
    <YStack gap="$6" padding="$4">
      <YStack gap="$4">
        <H2>Typography System</H2>
        <Text color="$textSecondary">
          Complete typography hierarchy with consistent styling across web and mobile platforms. 
          Click any example to copy the style object.
        </Text>
        
        <XStack gap="$2">
          <Button 
            variant={showSpecs ? 'outlined' : undefined}
            onPress={() => setShowSpecs(!showSpecs)}
          >
            {showSpecs ? 'Hide' : 'Show'} Specifications
          </Button>
        </XStack>
      </YStack>
      
      <Separator />
      
      {/* Headings */}
      <YStack gap="$4">
        <H3>Headings</H3>
        <Text color="$textSecondary" fontSize="$3">
          Semantic heading hierarchy from H1 to H6 with consistent spacing and weight.
        </Text>
        <YStack gap="$3">
          {headingExamples.map(({ variant, text }) => (
            <TypographyExample
              key={variant}
              label={variant.toUpperCase()}
              style={brandTypography.headings[variant as keyof typeof brandTypography.headings]}
              exampleText={text}
              showSpecs={showSpecs}
            />
          ))}
        </YStack>
      </YStack>
      
      <Separator />
      
      {/* Body Text */}
      <YStack gap="$4">
        <H3>Body Text</H3>
        <Text color="$textSecondary" fontSize="$3">
          Body text variants for different content types and emphasis levels.
        </Text>
        <YStack gap="$3">
          {bodyExamples.map(({ variant, text }) => (
            <TypographyExample
              key={variant}
              label={`Body ${variant}`}
              style={brandTypography.body[variant as keyof typeof brandTypography.body]}
              exampleText={text}
              showSpecs={showSpecs}
            />
          ))}
        </YStack>
      </YStack>
      
      <Separator />
      
      {/* Utility Text */}
      <YStack gap="$4">
        <H3>Utility Text</H3>
        <Text color="$textSecondary" fontSize="$3">
          Specialized text styles for captions, labels, code, and links.
        </Text>
        <YStack gap="$3">
          {utilityExamples.map(({ variant, text }) => (
            <TypographyExample
              key={variant}
              label={`${variant.charAt(0).toUpperCase()}${variant.slice(1)}`}
              style={brandTypography.utility[variant as keyof typeof brandTypography.utility]}
              exampleText={text}
              showSpecs={showSpecs}
            />
          ))}
        </YStack>
      </YStack>
      
      <Separator />
      
      {/* Interactive Text */}
      <YStack gap="$4">
        <H3>Interactive Text</H3>
        <Text color="$textSecondary" fontSize="$3">
          Text styles for buttons and interactive elements.
        </Text>
        <YStack gap="$3">
          {interactiveExamples.map(({ variant, text }) => (
            <TypographyExample
              key={variant}
              label={variant}
              style={brandTypography.interactive[variant as keyof typeof brandTypography.interactive]}
              exampleText={text}
              showSpecs={showSpecs}
            />
          ))}
        </YStack>
      </YStack>
      
      <Separator />
      
      <YStack gap="$2">
        <H3>Usage Guidelines</H3>
        <Text color="$textSecondary" fontSize="$3">
          • Use semantic headings (H1-H6) to maintain proper document structure
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          • Choose body text variants based on content importance and layout density
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          • Utility styles are optimized for cross-platform consistency
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          • Interactive text maintains accessibility standards for touch and mouse input
        </Text>
      </YStack>
    </YStack>
  )
}