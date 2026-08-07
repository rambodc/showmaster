import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ListPlus, Plus, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { addTrackToPlaylist, createPlaylist, friendlyError } from "../lib/api";
import { getMyPlaylists } from "../lib/catalog";

const PlaylistContext = createContext(null);

export function PlaylistProvider({ children }) {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [track, setTrack] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!user) { setPlaylists([]); return; }
    setPlaylists(await getMyPlaylists(user.uid));
  }, [user]);
  useEffect(() => { load().catch(() => setPlaylists([])); }, [load]);
  const openAddToPlaylist = useCallback((item) => {
    if (!user) return false;
    setTrack(item);
    setError("");
    return true;
  }, [user]);
  const add = async (playlistId) => {
    setBusy(true); setError("");
    try {
      await addTrackToPlaylist({ playlistId, releaseId: track.release?.id || track.releaseId, trackId: track.id || track.trackId });
      setTrack(null);
      await load();
    } catch (reason) { setError(friendlyError(reason)); }
    finally { setBusy(false); }
  };
  const createAndAdd = async (event) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const created = await createPlaylist({ name });
      setName("");
      await add(created.playlistId);
    } catch (reason) { setError(friendlyError(reason)); setBusy(false); }
  };
  const value = useMemo(() => ({ playlists, load, openAddToPlaylist }), [load, openAddToPlaylist, playlists]);
  return <PlaylistContext.Provider value={value}>
    {children}
    {track && <div className="playlist-dialog" role="dialog" aria-modal="true" aria-labelledby="playlist-dialog-title">
      <button className="playlist-dialog__backdrop" aria-label="Close add to playlist" onClick={() => setTrack(null)} />
      <section>
        <header><div><ListPlus /><div><h2 id="playlist-dialog-title">Add to playlist</h2><p>{track.title}</p></div></div><button onClick={() => setTrack(null)} aria-label="Close"><X /></button></header>
        {error && <p className="playlist-dialog__error" role="alert">{error}</p>}
        <div className="playlist-dialog__lists">
          {playlists.map((playlist) => <button disabled={busy} onClick={() => add(playlist.id)} key={playlist.id}><span>{playlist.name}</span><small>{playlist.trackCount || 0} tracks</small></button>)}
          {!playlists.length && <p>You have no playlists yet. Create one below.</p>}
        </div>
        <form onSubmit={createAndAdd}><input required maxLength="80" value={name} onChange={(event) => setName(event.target.value)} placeholder="New playlist name" aria-label="New playlist name" /><button disabled={busy}><Plus /> Create and add</button></form>
      </section>
    </div>}
  </PlaylistContext.Provider>;
}

export function usePlaylists() {
  const context = useContext(PlaylistContext);
  if (!context) throw new Error("usePlaylists must be used within PlaylistProvider.");
  return context;
}

export function AddToPlaylistButton({ track, className = "", children }) {
  const { user } = useAuth();
  const { openAddToPlaylist } = usePlaylists();
  if (!user || !track || track.access === "private-preview") return null;
  return <button type="button" className={className} onClick={(event) => { event.stopPropagation(); openAddToPlaylist(track); }} aria-label={`Add ${track.title} to playlist`}><ListPlus />{children}</button>;
}
