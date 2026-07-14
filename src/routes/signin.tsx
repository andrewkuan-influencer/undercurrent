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
    <div
      className="card"
      style={{
        maxWidth: 360,
        margin: '10vh auto 0',
        padding: '2rem',
        textAlign: 'center',
        borderRadius: 16,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 44,
          height: 44,
          borderRadius: 99,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 0.9rem',
          fontSize: 18,
          color: 'var(--muted)',
        }}
      >
        ✦
      </div>
      <h1 style={{ marginBottom: '1.1rem' }}>Undercurrent</h1>
      <button type="button" onClick={google} disabled={busy} style={{ width: '100%' }}>
        {busy ? 'Redirecting…' : 'Sign in with Google →'}
      </button>
    </div>
  )
}
