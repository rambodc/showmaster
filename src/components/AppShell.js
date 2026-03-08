import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiGrid, FiMenu, FiSettings, FiX } from 'react-icons/fi';
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
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const showRouteMatch = pathname.match(/^\/shows\/([^/]+)/);
  const workspacePath = showRouteMatch ? `/shows/${showRouteMatch[1]}/workspace` : '';
  const showWorkspaceShortcut = Boolean(showBackButton && workspacePath && pathname !== workspacePath);

  const items = useMemo(() => navItems || defaultNavItems, [navItems]);
  const brandTitle = showBackButton ? title : 'ShowMaster';

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
          <div className="app-shell-brand">{brandTitle}</div>
        </div>
        {renderNav()}
      </aside>

      {mobileOpen ? <div className="app-shell-backdrop" onClick={() => setMobileOpen(false)} /> : null}

      <aside className={mobileOpen ? 'app-shell-drawer open' : 'app-shell-drawer'}>
        <div className="app-shell-drawer-top">
          <div className="app-shell-drawer-title-row">
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
          <h1>{title}</h1>
          <div className="app-shell-mobile-right">
            {showWorkspaceShortcut ? (
              <button
                type="button"
                className="app-shell-icon-btn"
                aria-label="Go to workspace"
                onClick={() => navigate(workspacePath)}
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
