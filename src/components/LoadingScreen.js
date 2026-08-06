export default function LoadingScreen({ label = 'Loading' }) {
  return <main className="loading-screen" aria-live="polite"><span className="spinner" />{label}</main>;
}
