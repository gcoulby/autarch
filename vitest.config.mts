import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    reporters: ['tree'],
    include: ['**/*.test.ts'],
  },
})
