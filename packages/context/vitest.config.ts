import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    reporters: ['verbose'],
    include: ['tests/**/*.test.ts'],
  },
})
