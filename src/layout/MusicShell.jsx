import { useState } from "react";
import { AudioLines, Disc3, LayoutDashboard, Library, ListMusic, LogIn, LogOut, Menu, UserRound, UserPlus, X } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function MusicShell() {
  const { user, profile, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <div className="music-shell">
    <header className="music-mobile-bar"><Link to="/library" className="music-shell__brand"><span><AudioLines /></span>showmaster<em>.</em></Link><button onClick={() => setOpen(!open)} aria-label={open ? "Close navigation" : "Open navigation"}>{open ? <X /> : <Menu />}</button></header>
    <aside className={`music-sidebar${open ? " open" : ""}`}>
      <Link to="/library" className="music-shell__brand" onClick={close}><span><AudioLines /></span>showmaster<em>.</em></Link>
      {user && <div className="music-shell__identity"><div>{(user.displayName || user.email || "S").slice(0, 1).toUpperCase()}</div><span><small>Signed in</small><strong>{user.displayName || user.email}</strong></span></div>}
      <nav aria-label="Music application">
        {user && <NavLink end to="/app" onClick={close}><LayoutDashboard /> Overview</NavLink>}
        {user && profile?.artistId && <NavLink to="/app/profile" onClick={close}><UserRound /> My Profile</NavLink>}
        {user && <NavLink to="/app/playlists" onClick={close}><ListMusic /> My Playlists</NavLink>}
        <NavLink to="/library" onClick={close}><Library /> Public Library</NavLink>
        {!user && <NavLink to="/login" onClick={close}><LogIn /> Log in</NavLink>}
        {!user && <NavLink to="/register" onClick={close}><UserPlus /> Join Showmaster</NavLink>}
      </nav>
      {user && <div className="music-shell__storage"><Disc3 /><span><small>Creator storage</small><strong>{((profile?.storageBytes || 0) / 1024 ** 2).toFixed(1)} MB of 2 GB</strong></span></div>}
      {user && <button className="music-shell__logout" onClick={logout}><LogOut /> Log out</button>}
    </aside>
    {open && <button className="music-shell__scrim" aria-label="Close navigation" onClick={close} />}
    <div className="universal-main"><Outlet /></div>
  </div>;
}
