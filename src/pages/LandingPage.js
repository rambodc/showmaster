import { Link } from 'react-router-dom';
import Brand from '../components/Brand';
import { useAuth } from '../auth/AuthProvider';

export default function LandingPage() {
  const { user } = useAuth();
  return (
    <main className="landing">
      <nav className="site-nav">
        <Brand />
        <div className="site-nav__actions">
          {user ? <Link className="button button--dark" to="/app">Open dashboard</Link> : <><Link className="text-link" to="/login">Log in</Link><Link className="button button--dark" to="/register">Get started</Link></>}
        </div>
      </nav>
      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">The new foundation</p>
          <h1>Run the show.<br /><em>Skip the noise.</em></h1>
          <p className="hero__lead">A fresh, focused workspace for live-production teams. Start simple and shape Showmaster around the way your crew works.</p>
          <div className="hero__actions"><Link className="button button--accent" to={user ? '/app' : '/register'}>{user ? 'Open dashboard' : 'Create your account'} <span>→</span></Link><Link className="text-link" to="/login">I already have an account</Link></div>
        </div>
        <div className="hero__visual" aria-hidden="true">
          <div className="stage-card stage-card--back"><span>03</span><strong>Build</strong></div>
          <div className="stage-card stage-card--middle"><span>02</span><strong>Coordinate</strong></div>
          <div className="stage-card stage-card--front"><span>01</span><strong>Begin</strong><small>Your clean workspace is ready.</small><i>SM</i></div>
        </div>
      </section>
      <footer className="landing-footer"><span>Built for live production teams</span><span>Simple now. Ready for what’s next.</span></footer>
    </main>
  );
}
