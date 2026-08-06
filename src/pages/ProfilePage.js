export default function ProfilePage({ user, profile, name }) {
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <section className="panel profile-panel"><div className="profile-avatar">{initials || 'SM'}</div><div><p className="eyebrow">Account details</p><h2>{name}</h2><dl><div><dt>Email</dt><dd>{profile?.email || user?.email}</dd></div><div><dt>User ID</dt><dd>{profile?.uid || user?.uid}</dd></div><div><dt>Member since</dt><dd>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Just now'}</dd></div></dl></div></section>;
}
