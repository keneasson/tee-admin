import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@my/app': path.resolve(__dirname, '../../packages/app'),
      '@my/ui': path.resolve(__dirname, '../../packages/ui'),
    },
  },
  esbuild: {
    target: 'node18',
  },
})
