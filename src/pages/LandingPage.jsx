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
          <p className="eyebrow">The virtual artist label</p>
          <h1>Imagine the artist.<br /><em>Release the sound.</em></h1>
          <p className="hero__lead">Create a Virtual Artist, upload original AI-generated music, and share complete singles and albums with listeners everywhere.</p>
          <div className="hero__actions"><Link className="button button--accent" to={user ? '/app' : '/register'}>{user ? 'Open creator studio' : 'Create your artist'} <span>→</span></Link><Link className="text-link" to="/library">Explore the library</Link></div>
        </div>
        <div className="hero__visual" aria-hidden="true">
          <div className="stage-card stage-card--back"><span>03</span><strong>Publish</strong></div>
          <div className="stage-card stage-card--middle"><span>02</span><strong>Upload</strong></div>
          <div className="stage-card stage-card--front"><span>01</span><strong>Create</strong><small>Your virtual roster begins here.</small><i>SM</i></div>
        </div>
      </section>
      <footer className="landing-footer"><span>Built for AI music creators</span><span>Original identities. Original sound.</span></footer>
    </main>
  );
}
