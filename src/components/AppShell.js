import React, { useContext, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiGrid, FiMenu, FiSettings, FiTv, FiUsers, FiX } from 'react-icons/fi';
import { UserContext } from '../App';
import './AppShell.css';

const defaultNavItems = [
  { label: 'All Shows', to: '/shows', matches: ['/home', '/shows'] },
  { label: 'Settings', to: '/settings', icon: FiSettings, matches: ['/settings', '/more', '/account'] },
];

function isActive(pathname, matches) {
  return (matches || []).some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export default function AppShell({
  title = 'Showmaster',
  children,
  navItems,
  showMenuButton = true,
  showBackButton = false,
}) {
  const appUser = useContext(UserContext);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const showRouteMatch = pathname.match(/^\/shows\/([^/]+)/);
  const jobsPath = showRouteMatch ? `/shows/${showRouteMatch[1]}/jobs` : '';
  const showJobsShortcut = Boolean(showBackButton && jobsPath && pathname !== jobsPath);

  const items = useMemo(() => {
    if (navItems) return navItems;
    if (appUser?.systemRole !== 'super_admin') return defaultNavItems;
    return [
      defaultNavItems[0],
      { label: 'Users', to: '/admin/users', icon: FiUsers, matches: ['/admin/users'] },
      { label: 'Shows Admin', to: '/admin/shows', icon: FiTv, matches: ['/admin/shows'] },
      defaultNavItems[1],
    ];
  }, [appUser?.systemRole, navItems]);
  const brandTitle = showBackButton ? title : 'ShowMaster';
  const email = String(appUser?.email || '').trim();
  const truncate = (value, max = 34) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
  const emailLabel = email ? truncate(email, 34) : 'No email';

  const renderNav = () => (
    <nav className="app-shell-nav">
      {items.map(({ label, to, icon: Icon, matches, variant }) => {
        const active = isActive(pathname, matches || [to]);
        const className = ['app-shell-nav-item'];
        if (active) className.push('active');
        if (variant === 'all-shows-back') className.push('app-shell-nav-item-all-shows');
        return (
          <button
            key={label}
            type="button"
            className={className.join(' ')}
            onClick={() => {
              navigate(to);
              setMobileOpen(false);
            }}
            aria-current={active ? 'page' : undefined}
          >
            {Icon ? <Icon size={16} /> : null}
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="app-shell">
      <aside className="app-shell-sidebar">
        <div className="app-shell-brand-row">
          <div>
            <div className="app-shell-account-email" title={email || undefined}>{emailLabel}</div>
            <div className="app-shell-brand">{brandTitle}</div>
          </div>
        </div>
        {renderNav()}
      </aside>

      {mobileOpen ? <div className="app-shell-backdrop" onClick={() => setMobileOpen(false)} /> : null}

      <aside className={mobileOpen ? 'app-shell-drawer open' : 'app-shell-drawer'}>
        <div className="app-shell-drawer-top">
          <div className="app-shell-drawer-title-row">
            <div className="app-shell-account-email" title={email || undefined}>{emailLabel}</div>
            <strong>{title}</strong>
          </div>
          <button type="button" className="app-shell-icon-btn" onClick={() => setMobileOpen(false)}>
            <FiX />
          </button>
        </div>
        {renderNav()}
      </aside>

      <div className="app-shell-main">
        <header className="app-shell-mobile-topbar">
          <div className="app-shell-mobile-left">
            {showMenuButton ? (
              <button type="button" className="app-shell-icon-btn" onClick={() => setMobileOpen(true)}>
                <FiMenu />
              </button>
            ) : (
              <span style={{ width: 34 }} />
            )}
          </div>
          <div className="app-shell-mobile-title-block">
            <div className="app-shell-mobile-email" title={email || undefined}>{emailLabel}</div>
            <h1>{title}</h1>
          </div>
          <div className="app-shell-mobile-right">
            {showJobsShortcut ? (
              <button
                type="button"
                className="app-shell-icon-btn"
                aria-label="Go to jobs"
                onClick={() => navigate(jobsPath)}
              >
                <FiGrid />
              </button>
            ) : (
              <span style={{ width: 34 }} />
            )}
          </div>
        </header>

        <main className="app-shell-content">{children}</main>
      </div>
    </div>
  );
}
