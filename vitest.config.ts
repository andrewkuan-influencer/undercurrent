import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The integration test hits a real Neon database, so load DATABASE_URL
    // from .env into process.env before any test module is imported.
    setupFiles: ['dotenv/config'],
    // Serial: the tests touch a shared database.
    fileParallelism: false,
  },
})
