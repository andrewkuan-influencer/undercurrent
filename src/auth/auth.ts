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
 * Resolve the app's base URL. Better Auth wants the app ORIGIN and derives its
 * endpoint base path (default /api/auth) from it; if the value carries a path,
 * every endpoint 404s. Two footguns are handled here: an empty string must not
 * win (`?? default` only catches null/undefined), and BETTER_AUTH_URL is easily
 * mis-set to the full Google callback URL (that path belongs in the Google
 * console, not here). So we take the first usable candidate and reduce it to its
 * origin. Order: explicit BETTER_AUTH_URL, then Vercel's production URL, then
 * localhost for dev.
 */
export function resolveBaseURL(): string {
  const explicit = process.env.BETTER_AUTH_URL?.trim()
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  const raw =
    explicit || (vercelHost ? `https://${vercelHost}` : 'http://localhost:3000')
  try {
    return new URL(raw).origin
  } catch {
    return raw
  }
}

/**
 * Better Auth (PRD 8): Google sign-in plus an influencer.com email whitelist
 * that auto-provisions at the baseline role. The admin plugin gives a custom
 * role concept where an admin can raise a user's permissions. All model calls
 * and secrets come from the environment; never hardcode them.
 */
export const auth = betterAuth({
  baseURL: resolveBaseURL(),
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
