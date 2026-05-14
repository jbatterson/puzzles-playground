import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@shared-contracts': path.resolve(__dirname, 'shared-contracts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    include: ['shared-contracts/__tests__/**/*.test.js', 'tools/**/*.test.mjs'],
  },
})
