import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { signIn } from '../auth/client'

export const Route = createFileRoute('/signin')({
  component: SignInPage,
})

function SignInPage() {
  const [busy, setBusy] = useState(false)

  const google = async () => {
    setBusy(true)
    await signIn.social({ provider: 'google', callbackURL: '/' })
  }

  return (
    <div className="prose">
      <h1>Sign in</h1>
      <p className="muted">
        Undercurrent is limited to influencer.com accounts. Sign in with your
        work Google account.
      </p>
      <button type="button" onClick={google} disabled={busy}>
        {busy ? 'Redirecting…' : 'Sign in with Google'}
      </button>
    </div>
  )
}
