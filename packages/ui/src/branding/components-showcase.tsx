'use client'

import { useState, useEffect } from 'react'
import { YStack, XStack, Text, H2, H3, H4, Button, Input, Separator, View } from '@my/ui'
import { ComponentShowcase, ComponentGroup } from './component-showcase'

// Import all UI components for showcasing
import { DownloadButton } from '../download-button'
import { ExtLink, IntLink } from '../ext-link'
import { FullDialog } from '../fullDialog'
import { ListNavigation } from '../list-navigation'
import { ListNavigationText } from '../list-navigation-text'
import { NavHeading, NavItem } from '../nav-item'
import { NavigationButtonItem } from '../navigation-button-item'
import { Picture } from '../picture'
import { ProgramElement } from '../program-element'
import { TableBody } from '../table-body'
import { TableHead } from '../table-head'
import { FormFieldset } from '../form/form-fieldset'
import { CheckboxWithCheck } from '../form/checkbox-with-check'
import { FormInput } from '../form/form-input'
import { PasswordInput } from '../form/password-input'

// Note: Form components require proper React Hook Form setup
// These examples show the component structure but won't be functional without real form context

export function ComponentsShowcase() {
  const [mockActive, setMockActive] = useState(false)
  const [isClient, setIsClient] = useState(false)
  
  // Fix hydration mismatch
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  if (!isClient) {
    return (
      <YStack gap="$6" padding="$4">
        <YStack gap="$4">
          <H2>Component Showcase</H2>
          <Text color="$textSecondary" fontSize="$4">
            Loading component showcase...
          </Text>
        </YStack>
      </YStack>
    )
  }
  
  return (
    <YStack gap="$6" padding="$4">
      <YStack gap="$4">
        <H2>Component Showcase</H2>
        <Text color="$textSecondary" fontSize="$4">
          Interactive showcase of all UI components with variants, props, and code examples.
        </Text>
      </YStack>
      
      <Separator />
      
      {/* Form Components */}
      <ComponentGroup
        title="Form Components"
        description="React Hook Form integrated components with validation and accessibility features."
      >
        <ComponentShowcase
          title="Form Components Overview"
          description="Advanced form components that integrate with React Hook Form for validation and state management."
          children={
            <YStack gap="$4" backgroundColor="$backgroundSecondary" padding="$4" borderRadius="$4">
              <Text fontSize="$4" fontWeight="600">Available Form Components:</Text>
              <YStack gap="$2">
                <Text>• <Text fontWeight="600">FormInput</Text> - Text, email, tel, URL, search inputs</Text>
                <Text>• <Text fontWeight="600">PasswordInput</Text> - Password field with show/hide toggle</Text>
                <Text>• <Text fontWeight="600">CheckboxWithCheck</Text> - Checkbox with validation</Text>
                <Text>• <Text fontWeight="600">FormFieldset</Text> - Wrapper for grouping fields</Text>
              </YStack>
              <Text fontSize="$3" color="$textSecondary">
                Note: These components require React Hook Form setup with proper control, name, and validation rules.
              </Text>
            </YStack>
          }
          code={`// Example usage with React Hook Form
import { useForm } from 'react-hook-form'
import { FormInput, PasswordInput } from '@my/ui'

function MyForm() {
  const { control, handleSubmit } = useForm()
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormInput
        control={control}
        name="email"
        label="Email Address"
        type="email"
        rules={{ required: 'Email is required' }}
      />
      <PasswordInput
        control={control}
        name="password"
        label="Password"
        rules={{ 
          required: 'Password is required',
          minLength: { value: 8, message: 'Min 8 characters' }
        }}
      />
    </form>
  )
}`}
        />
        
        <ComponentShowcase
          title="Form Fieldset"
          description="Styled fieldset wrapper for grouping form fields."
          children={
            <FormFieldset>
              <YStack gap="$2">
                <Text fontSize="$3" fontWeight="600">Personal Information</Text>
                <Text fontSize="$2" color="$textSecondary">
                  FormFieldset provides consistent spacing and styling for form sections.
                </Text>
              </YStack>
            </FormFieldset>
          }
          code={`<FormFieldset>
  <FormInput control={control} name="firstName" label="First Name" />
  <FormInput control={control} name="lastName" label="Last Name" />
</FormFieldset>`}
        />
      </ComponentGroup>
      
      {/* Navigation Components */}
      <ComponentGroup
        title="Navigation Components"
        description="Components for building navigation menus and interactive elements."
      >
        <ComponentShowcase
          title="Navigation Button Item"
          description="Navigation button with active state styling."
          variants={[
            {
              name: 'Active State',
              component: (
                <NavigationButtonItem
                  linkTo={() => console.log('Clicked')}
                  text="Active Navigation Item"
                  active={true}
                />
              )
            },
            {
              name: 'Inactive State',
              component: (
                <NavigationButtonItem
                  linkTo={() => console.log('Clicked')}
                  text="Inactive Navigation Item"
                  active={false}
                />
              )
            }
          ]}
          code={`<NavigationButtonItem
  linkTo={() => router.push('/path')}
  text="Navigation Item"
  active={pathname === '/path'}
/>`}
        />
        
        <ComponentShowcase
          title="Nav Item & Nav Heading"
          description="Styled navigation components with hover states."
          variants={[
            {
              name: 'Nav Heading',
              component: (
                <NavHeading>
                  <Text>Section Heading</Text>
                </NavHeading>
              )
            },
            {
              name: 'Nav Item',
              component: (
                <NavItem>
                  <Text>Navigation Item</Text>
                </NavItem>
              )
            }
          ]}
          code={`<NavHeading>
  <Text>Section Heading</Text>
</NavHeading>

<NavItem>
  <Text>Navigation Item</Text>
</NavItem>`}
        />
        
        <ComponentShowcase
          title="List Navigation"
          description="Pressable navigation button with blue styling."
          children={
            <ListNavigation
              onPress={() => console.log('Pressed')}
              title="Navigation Title"
            >
              <ListNavigationText>Navigation Content</ListNavigationText>
            </ListNavigation>
          }
          code={`<ListNavigation
  onPress={() => handlePress()}
  title="Navigation Title"
>
  <ListNavigationText>Content</ListNavigationText>
</ListNavigation>`}
        />
      </ComponentGroup>
      
      {/* Interactive Components */}
      <ComponentGroup
        title="Interactive Components"
        description="Buttons, links, and modal components for user interactions."
      >
        <ComponentShowcase
          title="Download Button"
          description="Styled download button with icon and external link functionality."
          children={
            <DownloadButton href="/sample-file.pdf">
              Download Sample File
            </DownloadButton>
          }
          code={`<DownloadButton href="/path/to/file.pdf">
  Download File
</DownloadButton>`}
        />
        
        <ComponentShowcase
          title="External & Internal Links"
          description="Link components with appropriate styling and icons."
          variants={[
            {
              name: 'External Link',
              component: (
                <ExtLink href="https://example.com">
                  Visit External Site
                </ExtLink>
              )
            },
            {
              name: 'Internal Link',
              component: (
                <IntLink href="/internal-page">
                  Go to Internal Page
                </IntLink>
              )
            }
          ]}
          code={`<ExtLink href="https://external.com">
  External Link
</ExtLink>

<IntLink href="/internal">
  Internal Link
</IntLink>`}
        />
        
        <ComponentShowcase
          title="Full Dialog"
          description="Responsive modal dialog (Sheet on mobile)."
          children={
            <FullDialog
              trigger="Open Dialog"
              title="Dialog Title"
              description="This is a full-featured dialog component."
            >
              <Text>Dialog content goes here.</Text>
            </FullDialog>
          }
          code={`<FullDialog
  trigger="Open Dialog"
  title="Dialog Title"
  description="Dialog description"
>
  <Text>Dialog content</Text>
</FullDialog>`}
        />
      </ComponentGroup>
      
      {/* Content Components */}
      <ComponentGroup
        title="Content Components"
        description="Components for displaying structured content and media."
      >
        <ComponentShowcase
          title="Program Element"
          description="Label-content pair for program listings."
          children={
            <ProgramElement
              label="Speaker"
              content="John Smith"
            />
          }
          code={`<ProgramElement
  label="Speaker"
  content="John Smith"
/>`}
        />
        
        <ComponentShowcase
          title="Picture"
          description="Responsive picture component with multiple resolution support."
          children={
            <Picture
              source={{
                src: "/placeholder-image.jpg",
                width: 300,
                height: 200
              }}
              alt="Sample image"
            />
          }
          code={`<Picture
  source={{
    src: "/image.jpg",
    width: 300,
    height: 200
  }}
  alt="Image description"
/>`}
        />
        
        <ComponentShowcase
          title="Table Components"
          description="Table header and body components with styling variations."
          variants={[
            {
              name: 'Present/Current',
              component: (
                <YStack>
                  <TableHead>Header Content</TableHead>
                  <TableBody>Current Body Content</TableBody>
                </YStack>
              )
            },
            {
              name: 'Past/Historical',
              component: (
                <YStack>
                  <TableHead>Header Content</TableHead>
                  <TableBody past>Past Body Content</TableBody>
                </YStack>
              )
            }
          ]}
          code={`<TableHead>
  Header Content
</TableHead>

<TableBody past={isPast}>
  Body Content
</TableBody>`}
        />
      </ComponentGroup>
    </YStack>
  )
}