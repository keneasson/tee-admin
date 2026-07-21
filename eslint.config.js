/**
 * ESLint Configuration
 *
 * This config enforces React Native-safe JSX patterns across the codebase.
 *
 * CRITICAL RULE: jsx-no-leaked-render
 * In React Native, using `{condition && <Component />}` is UNSAFE because
 * falsy values (0, "", false, null, undefined) can leak into the render output
 * and cause "Text strings must be rendered within a <Text> component" errors.
 *
 * ALWAYS use: `{condition ? <Component /> : null}`
 * NEVER use:  `{condition && <Component />}`
 */

import tsParser from '@typescript-eslint/parser'
import reactPlugin from 'eslint-plugin-react'

export default [
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.expo/**',
      '**/build/**',
      '**/.react-email/**',
    ],
    plugins: {
      react: reactPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // CRITICAL: Prevent && short-circuit rendering in JSX
      // This causes crashes in React Native when falsy values leak through
      // Forces use of ternary: {condition ? <Component /> : null}
      'react/jsx-no-leaked-render': ['error', {
        validStrategies: ['ternary'],
      }],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  // CRITICAL: Prevent platform-specific imports in shared packages
  // packages/app and packages/ui are shared between Next.js and Expo
  // They must not import Next.js-specific modules directly
  {
    files: ['packages/app/**/*.{js,jsx,ts,tsx}', 'packages/ui/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['next-auth/*', 'next-auth/react'],
            message: 'Do not import next-auth in shared packages. Session data should be passed as props from platform-specific code.'
          },
          {
            group: ['next/*', 'next/navigation', 'next/router', 'next/link', 'next/image'],
            message: 'Do not import Next.js modules in shared packages. Use platform-agnostic alternatives or pass callbacks as props.'
          },
          {
            group: ['next-app/*'],
            message: 'Do not import from next-app in shared packages. Move shared types to packages/app/types.'
          }
        ]
      }],
    },
  },

  // Email templates must render from App Router SERVER routes (the email-queue
  // cron processor). The hook-based Footer/EmailBrandLink/InterEcclesiaFooter read
  // the `'use client'` EmailIdentityProvider context, which throws when rendered
  // from a server route ("Attempted to call EmailIdentityProvider() from the
  // server"). Templates must take `identity` as a PROP and use the server-safe
  // *Content components instead. This rule stops the class of bug from recurring.
  {
    files: ['apps/email-builder/emails/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/Footer', '**/EmailBrandLink', '**/InterEcclesiaFooter', '**/email-identity'],
            message:
              'Email templates must be server-safe: take `identity` as a prop and use FooterContent / EmailBrandLinkContent / InterEcclesiaFooterContent instead of the hook-based components (which use the client EmailIdentityProvider and throw when rendered from an App Router server route).',
          },
        ],
      }],
    },
  },
]
