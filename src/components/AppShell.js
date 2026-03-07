import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiGrid, FiUser, FiBell, FiMoreHorizontal } from 'react-icons/fi';
import './AppShell.css';

const navItems = [
  { label: 'Shows', to: '/shows', icon: FiGrid, matches: ['/home', '/shows'] },
  { label: 'Profile', to: '/profile', icon: FiUser, matches: ['/profile'] },
  { label: 'Updates', to: '/updates', icon: FiBell, matches: ['/updates'] },
  { label: 'More', to: '/more', icon: FiMoreHorizontal, matches: ['/more', '/account', '/username'] },
];

function isActive(pathname, matches) {
  return matches.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export default function AppShell({ title, children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const renderNav = (compact = false) => (
    <nav className={compact ? 'app-shell-nav app-shell-nav-compact' : 'app-shell-nav'}>
      {navItems.map(({ label, to, icon: Icon, matches }) => {
        const active = isActive(pathname, matches);
        return (
          <button
            key={label}
            type="button"
            className={active ? 'app-shell-nav-item active' : 'app-shell-nav-item'}
            onClick={() => navigate(to)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={compact ? 16 : 18} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="app-shell">
      <aside className="app-shell-sidebar">
        <div className="app-shell-brand">showmaster</div>
        {renderNav(false)}
      </aside>

      <div className="app-shell-main">
        <header className="app-shell-mobile-topbar">
          <h1>{title}</h1>
          {renderNav(true)}
        </header>

        <main className="app-shell-content">{children}</main>
      </div>
    </div>
  );
}
