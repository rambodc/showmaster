import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-root">
      <div className="landing-overlay" />
      <main className="landing-card">
        <span className="landing-chip">SHOWMASTER</span>
        <h1>Run Live Shows with Precision</h1>
        <p>Operations workspace for teams, access, inventory, artists, and 3D planning.</p>
        <div className="landing-actions">
          <button className="landing-btn-primary" type="button" onClick={() => navigate('/signin')}>Sign In</button>
        </div>
      </main>
      <div className="landing-glow landing-glow-left" />
      <div className="landing-glow landing-glow-right" />
    </div>
  );
}

export default LandingPage;
