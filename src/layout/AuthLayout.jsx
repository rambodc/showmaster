import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import Brand from '../components/Brand';

export default function AuthLayout({ eyebrow, title, description, alternate, alternateTo, alternateLabel, children }) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const root = document.documentElement;
    let focusTimer;
    const sync = () => {
      root.style.setProperty('--auth-viewport-height', `${viewport.height}px`);
      root.style.setProperty('--auth-viewport-offset', `${viewport.offsetTop}px`);
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        const focused = document.activeElement;
        if (focused?.matches?.('.auth-form input')) focused.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 80);
    };
    sync();
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    return () => {
      window.clearTimeout(focusTimer);
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
      root.style.removeProperty('--auth-viewport-height');
      root.style.removeProperty('--auth-viewport-offset');
    };
  }, []);
  return <main className="auth-page"><section className="auth-aside"><Brand light /><div><p className="eyebrow">A cleaner way to work</p><h2>Your next production starts with a clear stage.</h2><p>One secure home for the tools your team will build next.</p></div><p className="auth-aside__foot">ShowMaster starter · Built for what comes next</p></section><section className="auth-main"><div className="auth-card"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="auth-card__description">{description}</p>{children}<p className="auth-alternate">{alternate} <Link to={alternateTo}>{alternateLabel}</Link></p></div></section></main>;
}
