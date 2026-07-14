/**
 * A small confirmation dialog: overlay plus centred card with a Cancel and a
 * destructive confirm button. The caller renders it conditionally and owns
 * the busy state while the action runs.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="overlay" onClick={busy ? undefined : onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 0.5rem', fontSize: 15 }}>{title}</h3>
        <p className="muted" style={{ margin: '0 0 1.1rem', fontSize: 13, lineHeight: 1.5 }}>
          {body}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" className="secondary btn-pill" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-pill btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
