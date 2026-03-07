import React, { useContext, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { UserContext } from '../App';
import { db } from '../firebase';
import { getVisibleModulesForMember, useShowAccess } from '../services/showRoles';

export default function ShowInventory() {
  const { showId } = useParams();
  const appUser = useContext(UserContext);
  const { show, role, member } = useShowAccess(showId, appUser?.id);
  const [modules, setModules] = useState([]);

  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!showId) return undefined;
    const q = query(collection(db, 'shows', showId, 'inventoryItems'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(list);
    });
    return () => unsub();
  }, [showId]);

  useEffect(() => {
    if (!showId) return undefined;
    const q = query(collection(db, 'shows', showId, 'modules'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setModules(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [showId]);

  const showSlug = (show?.name || 'show').toLowerCase().replace(/\s+/g, '-');
  const visibleModules = getVisibleModulesForMember({ modules, role, member });
  const canSeeInventory = visibleModules.some((m) => (m.key || m.id) === 'inventory');
  const navItems = visibleModules.map((m) => {
    const key = m.key || m.id;
    return {
      label: m.name || key,
      to: key === 'inventory' ? `/shows/${showId}/inventory` : `/shows/${showId}/module/${key}`,
      matches: [key === 'inventory' ? `/shows/${showId}/inventory` : `/shows/${showId}/module/${key}`],
    };
  });

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

  const removeItem = async (itemId) => {
    await deleteDoc(doc(db, 'shows', showId, 'inventoryItems', itemId));
  };

  return (
    <ShowRoute permission="view_show">
      <AppShell
        title="Inventory"
        titlePath={`shows/${showSlug}/inventory`}
        navItems={navItems}
        showMenuButton
        showSettingsButton
      >
        {!canSeeInventory ? (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Inventory Not Available</h3>
            <p style={{ margin: 0, color: '#475569' }}>You do not have access to this module.</p>
          </div>
        ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Inventory - {show?.name || 'Show'}</h2>
            <p style={{ color: '#475569' }}>Track show assets and usage quickly.</p>
            <Link to={`/shows/${showId}`}>Back to workspace</Link>
          </div>

          <form onSubmit={addItem} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 16, display: 'grid', gap: 8 }}>
            <h3 style={{ margin: 0 }}>Add item</h3>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" required />
            <input type="number" value={quantity} min="0" onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={3} />
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Item'}</button>
          </form>

          <div style={{ display: 'grid', gap: 8 }}>
            {items.map((item) => (
              <div key={item.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 14 }}>
                <strong>{item.name}</strong>
                <p style={{ margin: '4px 0', color: '#475569' }}>Qty: {item.quantity ?? 0}</p>
                <p style={{ margin: '4px 0', color: '#64748b' }}>{item.notes || 'No notes'}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => toggleStatus(item)}>
                    Mark {item.status === 'in_stock' ? 'Used' : 'In Stock'}
                  </button>
                  <button type="button" onClick={() => removeItem(item.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </AppShell>
    </ShowRoute>
  );
}
