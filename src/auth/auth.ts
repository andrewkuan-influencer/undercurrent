import 'dotenv/config'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { APIError } from 'better-auth/api'
import { db } from '../db/client'
import * as authSchema from '../db/authSchema'

/** Roles (PRD 8): everyone starts at the baseline, an admin can raise them. */
export const BASELINE_ROLE = 'member'
export const ADMIN_ROLE = 'admin'

/** Auto-provision whitelist: only influencer.com email accounts (PRD 8, 9.3). */
const ALLOWED_EMAIL_DOMAIN = 'influencer.com'

/**
 * Better Auth (PRD 8): Google sign-in plus an influencer.com email whitelist
 * that auto-provisions at the baseline role. The admin plugin gives a custom
 * role concept where an admin can raise a user's permissions. All model calls
 * and secrets come from the environment; never hardcode them.
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-insecure-secret-change-me',
  database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Whitelist gate: reject any non-influencer.com sign-up before a user
        // row is ever created. Allowed users are provisioned at the baseline.
        before: async (user) => {
          const email = (user.email ?? '').toLowerCase()
          if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
            throw new APIError('FORBIDDEN', {
              message: `Access is limited to ${ALLOWED_EMAIL_DOMAIN} accounts.`,
            })
          }
          return { data: { ...user, role: BASELINE_ROLE } }
        },
      },
    },
  },
  plugins: [
    admin({ defaultRole: BASELINE_ROLE, adminRoles: [ADMIN_ROLE] }),
    tanstackStartCookies(),
  ],
})
