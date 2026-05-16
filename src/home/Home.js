import React, { useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FiImage, FiRadio } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import { UserContext } from '../App';
import { db } from '../firebase';
import './Home.css';

function getShowIconUrl(show) {
  return show?.iconUrls?.sm || show?.iconUrls?.md || show?.iconUrls?.lg || show?.iconUrl || '';
}

function Home() {
  const appUser = useContext(UserContext);
  const navigate = useNavigate();

  const [assignedShows, setAssignedShows] = useState([]);
  const [assignedShowDetails, setAssignedShowDetails] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser?.id) {
      setAssignedShows([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const q = query(collection(db, 'users', appUser.id, 'showAccess'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAssignedShows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => {
      setAssignedShows([]);
      setLoading(false);
    });

    return () => unsub();
  }, [appUser?.id]);

  useEffect(() => {
    if (assignedShows.length === 0) {
      setAssignedShowDetails({});
      return undefined;
    }

    const unsubs = assignedShows
      .map((show) => show.showId || show.id)
      .filter(Boolean)
      .map((showId) => onSnapshot(doc(db, 'shows', showId), (snap) => {
        setAssignedShowDetails((prev) => ({
          ...prev,
          [showId]: snap.exists() ? { id: snap.id, ...snap.data() } : null,
        }));
      }));

    return () => unsubs.forEach((unsub) => unsub());
  }, [assignedShows]);

  const visibleShows = useMemo(() => {
    if (!appUser?.id) return [];
    return assignedShows.map((show) => {
      const showId = show.showId || show.id;
      const liveShow = assignedShowDetails[showId];
      return {
        id: showId,
        name: liveShow?.name || show.showName,
        description: liveShow?.description || show.showDescription,
        status: liveShow?.status || show.status,
        iconUrls: liveShow?.iconUrls || show.iconUrls,
        iconUrl: liveShow?.iconUrl || show.iconUrl,
      };
    });
  }, [appUser?.id, assignedShowDetails, assignedShows]);

  return (
    <AppShell title="All Shows">
      <div className="shows-layout">
        <section className="shows-list-card">
          <h3 style={{ marginTop: 0 }}>Assigned Shows</h3>
          {loading ? (
            <p className="shows-muted">Loading shows...</p>
          ) : visibleShows.length === 0 ? (
            <p className="shows-muted">
              No shows assigned yet. Ask a super admin or show admin to assign you.
            </p>
          ) : (
            <div className="shows-grid">
              {visibleShows.map((show) => (
                <button key={show.id} type="button" className="show-row" onClick={() => navigate(`/shows/${show.id}/jobs`)}>
                  <div className="show-row-main">
                    <div className="show-row-icon-wrap">
                      {getShowIconUrl(show) ? (
                        <img src={getShowIconUrl(show)} alt="" className="show-row-icon-image" />
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
