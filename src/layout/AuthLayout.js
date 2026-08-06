import { Link } from 'react-router-dom';
import Brand from '../components/Brand';

export default function AuthLayout({ eyebrow, title, description, alternate, alternateTo, alternateLabel, children }) {
  return <main className="auth-page"><section className="auth-aside"><Brand light /><div><p className="eyebrow">A cleaner way to work</p><h2>Your next production starts with a clear stage.</h2><p>One secure home for the tools your team will build next.</p></div><p className="auth-aside__foot">Showmaster starter · Built for what comes next</p></section><section className="auth-main"><div className="auth-card"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="auth-card__description">{description}</p>{children}<p className="auth-alternate">{alternate} <Link to={alternateTo}>{alternateLabel}</Link></p></div></section></main>;
}
