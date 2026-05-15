import React from 'react';
import { FiX } from 'react-icons/fi';

export default function RightDrawer({ open, title, eyebrow, children, onClose, width = 520 }) {
  if (!open) return null;

  return (
    <div className="right-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="right-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ '--drawer-width': `${width}px` }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="right-drawer-head">
          <div>
            {eyebrow ? <span className="show-chip">{eyebrow}</span> : null}
            <h3>{title}</h3>
          </div>
          <button className="app-shell-icon-btn" type="button" onClick={onClose} aria-label="Close drawer">
            <FiX />
          </button>
        </div>
        <div className="right-drawer-body">{children}</div>
      </aside>
    </div>
  );
}
