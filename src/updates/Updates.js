import React from 'react';
import AppShell from '../components/AppShell';

const updates = [
  { id: 1, title: 'Responsive app shell', detail: 'Desktop now uses a sidebar and mobile uses a top navigation bar.', time: 'Today' },
  { id: 2, title: 'Auth pages simplified', detail: 'Sign in and sign up now load without background images.', time: 'Today' },
  { id: 3, title: 'Clean base reset', detail: 'Removed legacy scaffolding for a fresh start.', time: 'Today' },
];

export default function Updates() {
  return (
    <AppShell title="Updates">
      <div
        style={{
          maxWidth: 700,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h2 style={{ margin: '0 0 6px' }}>Updates</h2>
        {updates.map((item) => (
          <div
            key={item.id}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 16,
              border: '1px solid #e2e8f0',
              boxShadow: '0 12px 30px rgba(15,23,42,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <strong style={{ fontSize: 16 }}>{item.title}</strong>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{item.time}</span>
            </div>
            <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>{item.detail}</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
