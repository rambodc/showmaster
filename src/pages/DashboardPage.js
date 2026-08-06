import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import PortalLayout from '../layout/PortalLayout';
import ProfilePage from './ProfilePage';

function Dashboard({ name, profile, user, openProfile }) {
  return <section className="dashboard-grid"><article className="panel welcome-panel"><span className="panel-number">01</span><div><p className="eyebrow">Your starting point</p><h2>The stage is clear.</h2><p>This clean workspace is ready for the tools and workflows your team needs next.</p></div><div className="signal"><i /><i /><i /><i /><i /></div></article><article className="panel status-panel"><p className="eyebrow">System status</p><h3><span className="status-dot" /> All systems ready</h3><p>Authentication and your secure profile are connected.</p></article><article className="panel profile-preview"><p className="eyebrow">Signed in as</p><strong>{name}</strong><span>{profile?.email || user?.email}</span><button onClick={openProfile}>View profile →</button></article></section>;
}

export default function DashboardPage() {
  const { user, profile, profileError, refreshProfile, logout } = useAuth();
  const [view, setView] = useState('dashboard');
  const name = profile?.displayName || user?.displayName || 'there';
  return <PortalLayout user={user} name={name} view={view} onViewChange={setView} onLogout={logout}>{profileError && <div className="panel panel--error" role="alert"><div><strong>We couldn’t load your profile.</strong><p>{profileError}</p></div><button onClick={refreshProfile}>Try again</button></div>}{view === 'profile' ? <ProfilePage user={user} profile={profile} name={name} /> : <Dashboard name={name} profile={profile} user={user} openProfile={() => setView('profile')} />}</PortalLayout>;
}
