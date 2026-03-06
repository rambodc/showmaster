import React, { useContext } from 'react';
import { FiArrowRight, FiUser, FiShield } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../App';
import AppShell from '../components/AppShell';
import './Home.css';

function Home() {
  const appUser = useContext(UserContext);
  const navigate = useNavigate();

  const displayName = `${appUser?.firstName || ''} ${appUser?.lastName || ''}`.trim() || 'there';

  return (
    <AppShell title="Home">
      <section className="home-hero">
        <p className="home-eyebrow">Dashboard</p>
        <h2>Welcome back, {displayName}</h2>
        <p>
          This is your clean Showmaster starter app. Use this as a base to build your next modules.
        </p>
      </section>

      <section className="home-grid">
        <article className="home-card">
          <div className="home-card-icon">
            <FiUser />
          </div>
          <h3>Profile Setup</h3>
          <p>Update photo and account details so your workspace is ready.</p>
          <button type="button" onClick={() => navigate('/profile')}>
            Open Profile <FiArrowRight />
          </button>
        </article>

        <article className="home-card">
          <div className="home-card-icon">
            <FiShield />
          </div>
          <h3>Account & Security</h3>
          <p>Manage username, email, password, and sign-out options.</p>
          <button type="button" onClick={() => navigate('/more')}>
            Open More <FiArrowRight />
          </button>
        </article>
      </section>
    </AppShell>
  );
}

export default Home;
