import Brand from '../components/Brand';

export default function PortalLayout({ user, name, view, onViewChange, onLogout, children }) {
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <div className="app-shell"><aside className="sidebar"><Brand light /><nav aria-label="Application"><button className={view === 'dashboard' ? 'active' : ''} onClick={() => onViewChange('dashboard')}><span>⌂</span> Dashboard</button><button className={view === 'profile' ? 'active' : ''} onClick={() => onViewChange('profile')}><span>○</span> Profile</button></nav><button className="logout" onClick={onLogout}>↗ Log out</button></aside><main className="dashboard"><header className="dashboard-header"><div><p className="eyebrow">Showmaster workspace</p><h1>{view === 'dashboard' ? `Good to see you, ${name}.` : 'Your profile'}</h1></div><button className="avatar" onClick={() => onViewChange('profile')} aria-label="Open profile">{initials || 'SM'}</button></header>{children}</main></div>;
}
