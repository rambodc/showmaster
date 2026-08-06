import { useState } from 'react';
import Brand from '../components/Brand';
import { useAuth } from '../auth/AuthContext';

export default function DashboardPage() {
  const { user, profile, profileError, refreshProfile, logout } = useAuth();
  const [view, setView] = useState('dashboard');
  const name = profile?.displayName || user?.displayName || 'there';
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand light />
        <nav aria-label="Application"><button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><span>⌂</span> Dashboard</button><button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}><span>○</span> Profile</button></nav>
        <button className="logout" onClick={logout}>↗ Log out</button>
      </aside>
      <main className="dashboard">
        <header className="dashboard-header"><div><p className="eyebrow">Showmaster workspace</p><h1>{view === 'dashboard' ? `Good to see you, ${name}.` : 'Your profile'}</h1></div><button className="avatar" onClick={() => setView('profile')} aria-label="Open profile">{initials || 'SM'}</button></header>
        {profileError && <div className="panel panel--error" role="alert"><div><strong>We couldn’t load your profile.</strong><p>{profileError}</p></div><button onClick={refreshProfile}>Try again</button></div>}
        {view === 'dashboard' ? <section className="dashboard-grid">
          <article className="panel welcome-panel"><span className="panel-number">01</span><div><p className="eyebrow">Your starting point</p><h2>The stage is clear.</h2><p>This clean workspace is ready for the tools and workflows your team needs next.</p></div><div className="signal"><i /><i /><i /><i /><i /></div></article>
          <article className="panel status-panel"><p className="eyebrow">System status</p><h3><span className="status-dot" /> All systems ready</h3><p>Authentication and your secure profile are connected.</p></article>
          <article className="panel profile-preview"><p className="eyebrow">Signed in as</p><strong>{name}</strong><span>{profile?.email || user?.email}</span><button onClick={() => setView('profile')}>View profile →</button></article>
        </section> : <section className="panel profile-panel"><div className="profile-avatar">{initials || 'SM'}</div><div><p className="eyebrow">Account details</p><h2>{name}</h2><dl><div><dt>Email</dt><dd>{profile?.email || user?.email}</dd></div><div><dt>User ID</dt><dd>{profile?.uid || user?.uid}</dd></div><div><dt>Member since</dt><dd>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Just now'}</dd></div></dl></div></section>}
      </main>
    </div>
  );
}
