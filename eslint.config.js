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
]
