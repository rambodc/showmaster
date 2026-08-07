import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { LoadingButton } from './LoadingButton';

export function ActionDialog({ open, onOpenChange, title, description, initialValue = '', label, placeholder, confirmLabel = 'Save', loadingLabel = 'Saving…', destructive = false, confirmationText = '', onConfirm, busy = false }) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => { if (open) setValue(initialValue); }, [initialValue, open]);
  const valid = confirmationText ? value === confirmationText : value.trim().length > 0;
  return <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }} title={title} description={description} preventClose={busy}>
    <form className="action-dialog" onSubmit={(event) => { event.preventDefault(); if (valid && !busy) onConfirm(value.trim()); }}>
      <label><span>{label}</span><input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} maxLength={confirmationText ? confirmationText.length : 80} /></label>
      {confirmationText && <small>Enter <strong>{confirmationText}</strong> exactly to continue.</small>}
      <footer>
        <button type="button" className="secondary" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</button>
        <LoadingButton className={destructive ? 'danger-confirm' : 'stream-primary'} loading={busy} loadingLabel={loadingLabel} disabled={!valid}>{confirmLabel}</LoadingButton>
      </footer>
    </form>
  </Dialog>;
}
