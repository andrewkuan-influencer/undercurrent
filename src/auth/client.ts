import { adminClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

/**
 * Browser auth client (PRD 8). The admin plugin client exposes role management
 * for admins. baseURL is inferred from the current origin.
 */
export const authClient = createAuthClient({
  plugins: [adminClient()],
})

export const { signIn, signOut, useSession } = authClient
