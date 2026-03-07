import React, { useContext, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { UserContext } from '../App';
import { db } from '../firebase';
import { buildShowNavItems, buildShowPath, canAccessModule, useShowContext } from '../services/accessPolicy';
import useShowModules from './useShowModules';
import './showPages.css';

export default function ShowInventory() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const ctx = useShowContext({ showId, appUser });
  const modules = useShowModules(showId);
  const [items, setItems] = useState([]);

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!showId) return undefined;
    const q = query(collection(db, 'shows', showId, 'inventoryItems'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [showId]);

  const navItems = useMemo(() => buildShowNavItems({ showId, modules, ctx }), [ctx, modules, showId]);
  const inventoryModule = modules.find((m) => m.key === 'inventory');
  const hasAccess = canAccessModule({ moduleKey: 'inventory', moduleEnabled: inventoryModule?.enabled, ctx });

  const addItem = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'shows', showId, 'inventoryItems'), {
        name: name.trim(),
        quantity: Number(quantity) || 0,
        notes: notes.trim(),
        status: 'in_stock',
        createdBy: appUser?.id || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setName('');
      setQuantity(1);
      setNotes('');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item) => {
    const next = item.status === 'in_stock' ? 'used' : 'in_stock';
    await updateDoc(doc(db, 'shows', showId, 'inventoryItems', item.id), {
      status: next,
      updatedAt: serverTimestamp(),
    });
  };

  return (
    <ShowRoute permission="view_show">
      <AppShell
        title="Inventory"
        titlePath={buildShowPath(ctx.show?.name, 'inventory')}
        navItems={navItems}
        showMenuButton
        showSettingsButton
      >
        {!hasAccess ? (
          <section className="show-hero-card">
            <h3 style={{ marginTop: 0 }}>Inventory module unavailable</h3>
            <p className="info-note">Ask your show admin to enable inventory access.</p>
          </section>
        ) : (
          <div className="show-page-stack">
            <section className="show-hero-card">
              <span className="show-chip">Inventory</span>
              <h2 className="show-title">Track Show Assets</h2>
              <p className="show-subtitle">Manage consumables, rentals, and equipment status.</p>
            </section>

            <section className="show-card" style={{ padding: 16 }}>
              <form className="form-grid" onSubmit={addItem}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" required />
                <input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min="0" placeholder="Quantity" />
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes" />
                <button className="show-btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add Item'}</button>
              </form>
            </section>

            <section className="members-grid">
              {items.map((item) => (
                <article className="member-card" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <p className="info-note">Qty: {item.quantity ?? 0} - {item.status || 'in_stock'}</p>
                    <p className="info-note">{item.notes || 'No notes'}</p>
                  </div>
                  <div className="show-actions" style={{ marginTop: 0 }}>
                    <button className="show-btn-outline" type="button" onClick={() => toggleStatus(item)}>
                      Mark {item.status === 'in_stock' ? 'Used' : 'In Stock'}
                    </button>
                    <button className="show-btn-danger" type="button" onClick={() => deleteDoc(doc(db, 'shows', showId, 'inventoryItems', item.id))}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </div>
        )}
      </AppShell>
    </ShowRoute>
  );
}
