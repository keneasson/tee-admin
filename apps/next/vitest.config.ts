/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**', '**/*.e2e.*', '**/*.spec.*'],
    include: ['**/*.test.*'],
  },
  resolve: {
    alias: {
      '@my/app': path.resolve(__dirname, '../../packages/app'),
      '@my/ui': path.resolve(__dirname, '../../packages/ui'),
    },
  },
  esbuild: {
    target: 'node18'
  },
})