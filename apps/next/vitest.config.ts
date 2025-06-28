/// <reference types="vitest" />
import { defineConfig } from 'vite'
import path from 'path'

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
    target: 'node18'
  },
})