import React, { useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppShell from './AppShell';
import { UserContext } from '../App';
import { canShowRole, useShowAccess } from '../services/showRoles';

export default function ShowRoute({ children, permission = 'view_show' }) {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const { loading, hasAccess, role, show } = useShowAccess(showId, appUser?.id);

  if (loading) {
    return (
      <AppShell title="Show">
        <p>Loading show…</p>
      </AppShell>
    );
  }

  if (!hasAccess) {
    return (
      <AppShell title="Show Access">
        <div style={{ maxWidth: 640, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>No access to this show</h2>
          <p>You are not a member of this show yet.</p>
          <Link to="/shows">Back to shows</Link>
        </div>
      </AppShell>
    );
  }

  if (!canShowRole(role, permission)) {
    return (
      <AppShell title={show?.name || 'Show'}>
        <div style={{ maxWidth: 640, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Permission required</h2>
          <p>Your role does not allow this action.</p>
          <Link to={`/shows/${showId}`}>Back to workspace</Link>
        </div>
      </AppShell>
    );
  }

  return children;
}
