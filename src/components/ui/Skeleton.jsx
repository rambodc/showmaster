export function PageSkeleton({ cards = 4, label = 'Loading content' }) {
  return <div className="page-skeleton" role="status" aria-label={label}>
    <span className="skeleton-line wide" /><span className="skeleton-line" />
    <div>{Array.from({ length: cards }, (_, index) => <span className="skeleton-card" key={index} />)}</div>
  </div>;
}
