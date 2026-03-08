import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMenu, FiX } from 'react-icons/fi';
import './AppShell.css';

const defaultNavItems = [
  { label: 'All Shows', to: '/shows', matches: ['/home', '/shows'] },
  { label: 'Settings', to: '/settings', matches: ['/settings', '/more', '/account', '/username'] },
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
  backTo = '/shows',
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = useMemo(() => navItems || defaultNavItems, [navItems]);
  const brandTitle = showBackButton ? title : 'ShowMaster';

  const renderNav = () => (
    <nav className="app-shell-nav">
      {items.map(({ label, to, icon: Icon, matches }) => {
        const active = isActive(pathname, matches || [to]);
        return (
          <button
            key={label}
            type="button"
            className={active ? 'app-shell-nav-item active' : 'app-shell-nav-item'}
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
          {showBackButton ? (
            <button type="button" className="app-shell-icon-btn" onClick={() => navigate(backTo)} aria-label="Back to all shows">
              <FiArrowLeft />
            </button>
          ) : null}
          <div className="app-shell-brand">{brandTitle}</div>
        </div>
        {renderNav()}
      </aside>

      {mobileOpen ? <div className="app-shell-backdrop" onClick={() => setMobileOpen(false)} /> : null}

      <aside className={mobileOpen ? 'app-shell-drawer open' : 'app-shell-drawer'}>
        <div className="app-shell-drawer-top">
          <strong>{title}</strong>
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
            ) : showBackButton ? (
              <button type="button" className="app-shell-icon-btn" onClick={() => navigate(backTo)}>
                <FiArrowLeft />
              </button>
            ) : (
              <span style={{ width: 34 }} />
            )}
          </div>
          <h1>{title}</h1>
          <div className="app-shell-mobile-right">
            <span style={{ width: 34 }} />
          </div>
        </header>

        <main className="app-shell-content">{children}</main>
      </div>
    </div>
  );
}
