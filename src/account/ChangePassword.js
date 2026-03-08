import React from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import '../shows/showPages.css';

export default function ChangePassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.length > 1 && location.key !== 'default') {
      navigate(-1);
      return;
    }
    navigate('/account');
  };

  return (
    <AppShell title="Change Password">
      <div style={{ maxWidth: 800, width: '100%', margin: '0 auto', padding: '0 16px' }}>
        <div className="show-page-top-nav" style={{ marginBottom: 12 }}>
          <button className="show-btn-outline" type="button" onClick={goBack}>
            <FiArrowLeft /> Back
          </button>
        </div>
        <h1>Change Password</h1>
        <p style={{ color: '#4b5563' }}>This page will let you update your password. Coming soon.</p>
      </div>
    </AppShell>
  );
}
