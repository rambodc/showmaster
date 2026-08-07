import { Link, NavLink } from 'react-router-dom';
import { AudioLines } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

export default function PublicNav() { const { user } = useAuth(); return <header className="public-nav"><Link className="public-brand" to="/"><span><AudioLines /></span>showmaster<em>.</em></Link><nav><NavLink to="/library">Library</NavLink>{user ? <Link className="public-cta" to="/app">Creator studio</Link> : <><Link to="/login">Log in</Link><Link className="public-cta" to="/register">Join the label</Link></>}</nav></header>; }
