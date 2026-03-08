import React, { useContext, useEffect, useMemo, useState } from 'react';
import { collection, collectionGroup, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FiImage, FiRadio } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import { UserContext } from '../App';
import { db } from '../firebase';
import './Home.css';

function Home() {
  const appUser = useContext(UserContext);
  const navigate = useNavigate();

  const [shows, setShows] = useState([]);
  const [memberShowIds, setMemberShowIds] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'shows'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setShows(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!appUser?.id) {
      setMemberShowIds([]);
      return undefined;
    }

    const q = query(collectionGroup(db, 'members'), where('uid', '==', appUser.id));
    const unsub = onSnapshot(q, (snap) => {
      const ids = snap.docs.map((d) => d.ref.parent?.parent?.id).filter(Boolean);
      setMemberShowIds(Array.from(new Set(ids)));
    });

    return () => unsub();
  }, [appUser?.id]);

  const visibleShows = useMemo(() => {
    if (!appUser?.id) return [];
    if (appUser?.systemRole === 'super_admin') return shows;
    const memberSet = new Set(memberShowIds);
    return shows.filter((show) => show.ownerId === appUser.id || memberSet.has(show.id));
  }, [appUser?.id, appUser?.systemRole, memberShowIds, shows]);

  return (
    <AppShell
      title="All Shows"
      showMenuButton={false}
    >
      <div className="shows-layout">
        <section className="shows-list-card">
          <h3 style={{ marginTop: 0 }}>Assigned Shows</h3>
          {visibleShows.length === 0 ? (
            <p className="shows-muted">
              No shows assigned yet. Ask a super admin or show admin to assign you.
            </p>
          ) : (
            <div className="shows-grid">
              {visibleShows.map((show) => (
                <button key={show.id} type="button" className="show-row" onClick={() => navigate(`/shows/${show.id}/workspace`)}>
                  <div className="show-row-main">
                    <div className="show-row-icon-wrap">
                      {show?.iconUrls?.sm ? (
                        <img src={show.iconUrls.sm} alt="" className="show-row-icon-image" />
                      ) : (
                        <FiImage size={18} />
                      )}
                    </div>
                    <div>
                      <strong>{show.name || 'Untitled Show'}</strong>
                      <p>{show.description || 'No description'}</p>
                    </div>
                  </div>
                  <span><FiRadio size={13} /> {show.status || 'active'}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

export default Home;
