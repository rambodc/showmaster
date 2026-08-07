import { LoaderCircle } from 'lucide-react';

export function LoadingButton({ loading = false, loadingLabel = 'Working…', disabled, children, className = '', ...props }) {
  return <button {...props} className={`loading-button ${className}`} disabled={disabled || loading} aria-busy={loading}>
    {loading && <LoaderCircle className="loading-button__spinner" aria-hidden="true" />}
    <span>{loading ? loadingLabel : children}</span>
  </button>;
}
