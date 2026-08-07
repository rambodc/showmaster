import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ListPlus, Plus } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Dialog } from "../components/ui/Dialog";
import { LoadingButton } from "../components/ui/LoadingButton";
import { useToast } from "../components/ui/Toast";
import { addTrackToPlaylist, createPlaylist, friendlyError } from "../lib/api";
import { getMyPlaylists } from "../lib/catalog";

const PlaylistContext = createContext(null);

export function PlaylistProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [playlists, setPlaylists] = useState([]);
  const [track, setTrack] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
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
    setBusy(playlistId); setError("");
    try {
      await addTrackToPlaylist({ playlistId, releaseId: track.release?.id || track.releaseId, trackId: track.id || track.trackId });
      setTrack(null);
      await load();
      toast.success("Track added to playlist.");
    } catch (reason) { const message = friendlyError(reason); setError(message); toast.error(message); }
    finally { setBusy(""); }
  };
  const createAndAdd = async (event) => {
    event.preventDefault();
    setBusy("create"); setError("");
    try {
      const created = await createPlaylist({ name });
      setName("");
      await addTrackToPlaylist({ playlistId: created.playlistId, releaseId: track.release?.id || track.releaseId, trackId: track.id || track.trackId });
      await load();
      setTrack(null);
      toast.success("Playlist created and track added.");
    } catch (reason) { const message = friendlyError(reason); setError(message); toast.error(message); }
    finally { setBusy(""); }
  };
  const value = useMemo(() => ({ playlists, load, openAddToPlaylist }), [load, openAddToPlaylist, playlists]);
  return <PlaylistContext.Provider value={value}>
    {children}
    <Dialog open={Boolean(track)} onOpenChange={(open) => { if (!open && !busy) setTrack(null); }} preventClose={Boolean(busy)} title="Add to playlist" description={track?.title || "Choose a private playlist."} className="playlist-dialog-content">
      {track && <div className="playlist-dialog-body">
        <ListPlus className="playlist-dialog-icon" />
        {error && <p className="playlist-dialog__error" role="alert">{error}</p>}
        <div className="playlist-dialog__lists">
          {playlists.map((playlist) => <LoadingButton loading={busy === playlist.id} loadingLabel="Adding…" disabled={Boolean(busy)} onClick={() => add(playlist.id)} key={playlist.id}><span>{playlist.name}</span><small>{playlist.trackCount || 0} tracks</small></LoadingButton>)}
          {!playlists.length && <p>You have no playlists yet. Create one below.</p>}
        </div>
        <form onSubmit={createAndAdd}><input required maxLength="80" value={name} onChange={(event) => setName(event.target.value)} placeholder="New playlist name" aria-label="New playlist name" /><LoadingButton loading={busy === "create"} loadingLabel="Creating…" disabled={Boolean(busy)}><Plus /> Create and add</LoadingButton></form>
      </div>}
    </Dialog>
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
