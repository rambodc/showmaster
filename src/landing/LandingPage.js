import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../auth/Auth.css'; // Reuse your clean styles

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>Welcome to Showmaster</h1>
        <h2>Music. Culture. Identity.</h2>

        <p style={{ textAlign: 'center', fontWeight: 300 }}>
          Internal show operations platform.
        </p>

        <button onClick={() => navigate('/signin')}>Sign In</button>
      </div>
    </div>
  );
}

export default LandingPage;
