import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { UserContext } from '../App';

export default function AdminGuard({ children }) {
  const appUser = useContext(UserContext);

  if (!appUser) {
    return (
      <AppShell title="Admin">
        <p className="info-note">Loading admin access...</p>
      </AppShell>
    );
  }

  if (appUser.systemRole !== 'super_admin') {
    return <Navigate to="/shows" replace />;
  }

  return children;
}
