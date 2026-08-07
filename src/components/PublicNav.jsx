import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import LogoMark from './LogoMark';

export default function PublicNav() { const { user } = useAuth(); return <header className="public-nav"><Link className="public-brand" to="/"><LogoMark />ShowMaster<em>.</em></Link><nav><NavLink to="/library">Library</NavLink>{user ? <Link className="public-cta" to="/app">Creator studio</Link> : <><Link to="/login">Log in</Link><Link className="public-cta" to="/register">Join the label</Link></>}</nav></header>; }
