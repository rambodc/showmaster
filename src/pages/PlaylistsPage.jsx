import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Edit3, ListMusic, Play, Plus, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ActionDialog } from "../components/ui/ActionDialog";
import { LoadingButton } from "../components/ui/LoadingButton";
import { PageSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { createPlaylist, deletePlaylist, friendlyError, removeTrackFromPlaylist, renamePlaylist, reorderPlaylistTracks } from "../lib/api";
import { getMyPlaylists, getPlaylist, getPlaylistEntries } from "../lib/catalog";
import { useAudio } from "../music/AudioProvider";
import { AddToPlaylistButton, usePlaylists } from "../playlists/PlaylistProvider";

export default function PlaylistsPage() {
  const { playlistId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const audio = useAudio();
  const playlistContext = usePlaylists();
  const toast = useToast();
  const [playlists, setPlaylists] = useState([]);
  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [pending, setPending] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (playlistId) {
        const [list, entries] = await Promise.all([getPlaylist(playlistId), getPlaylistEntries(playlistId)]);
        setPlaylist(list); setTracks(entries);
      } else setPlaylists(await getMyPlaylists(user.uid));
    } catch (reason) { setError(friendlyError(reason)); }
    finally { setLoading(false); }
  }, [playlistId, user.uid]);
  useEffect(() => { load(); }, [load]);

  const run = async (key, work, success) => {
    if (pending) return;
    setPending(key); setError("");
    try { await work(); if (success) toast.success(success); }
    catch (reason) { const message = friendlyError(reason); setError(message); toast.error(message); }
    finally { setPending(""); }
  };
  const submitDialog = async (value) => {
    if (dialog === "create") await run("create", async () => {
      const result = await createPlaylist({ name: value });
      await playlistContext.load(); setDialog(null); navigate(`/app/playlists/${result.playlistId}`);
    }, "Playlist created.");
    if (dialog === "rename") await run("rename", async () => {
      await renamePlaylist({ playlistId, name: value }); await playlistContext.load(); await load(); setDialog(null);
    }, "Playlist renamed.");
    if (dialog === "delete") await run("delete", async () => {
      await deletePlaylist({ playlistId, confirmation: value }); await playlistContext.load(); setDialog(null); navigate("/app/playlists");
    }, "Playlist deleted.");
  };
  const reorder = async (index, direction) => run(`reorder-${tracks[index].entryId}`, async () => {
    const ids = tracks.map((item) => item.entryId);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    setTracks((current) => ids.map((id) => current.find((item) => item.entryId === id)));
    try { await reorderPlaylistTracks({ playlistId, entryIds: ids }); await load(); }
    catch (reason) { await load(); throw reason; }
  }, "Playlist order updated.");

  if (loading) return <main className="playlist-page"><PageSkeleton label="Loading playlists" /></main>;
  if (!playlistId) return <main className="playlist-page">
    <header><div><span>Your private collection</span><h1>My Playlists</h1><p>Create personal queues from published music across Showmaster.</p></div><LoadingButton loading={pending === "create"} loadingLabel="Creating…" onClick={() => setDialog("create")}><Plus /> New playlist</LoadingButton></header>
    {error && <div className="studio-notice error" role="alert">{error}</div>}
    {!playlists.length ? <div className="studio-empty"><ListMusic /><h3>No playlists yet</h3><p>Save songs you love into your own private playlists.</p><button onClick={() => setDialog("create")}>Create your first playlist</button></div> : <section className="playlist-grid">{playlists.map((item) => <button onClick={() => navigate(`/app/playlists/${item.id}`)} key={item.id}><ListMusic /><strong>{item.name}</strong><small>{item.trackCount || 0} tracks · Private</small></button>)}</section>}
    <ActionDialog open={dialog === "create"} onOpenChange={(open) => !open && setDialog(null)} title="Create a playlist" description="Build a private collection from published tracks." label="Playlist name" placeholder="Late night discoveries" confirmLabel="Create playlist" loadingLabel="Creating…" busy={pending === "create"} onConfirm={submitDialog} />
  </main>;
  if (!playlist) return <main className="playlist-page"><button className="back-link" onClick={() => navigate("/app/playlists")}><ArrowLeft /> My Playlists</button><div className="catalog-state">Playlist not found.</div></main>;
  return <main className="playlist-page">
    <button className="back-link" onClick={() => navigate("/app/playlists")}><ArrowLeft /> My Playlists</button>
    <header><div><span>Private playlist</span><h1>{playlist.name}</h1><p>{tracks.length} saved tracks</p></div><div><button disabled={!tracks.length} onClick={() => audio.playTracks(tracks)}><Play fill="currentColor" /> Play all</button><LoadingButton loading={pending === "rename"} loadingLabel="Renaming…" onClick={() => setDialog("rename")}><Edit3 /> Rename</LoadingButton><LoadingButton loading={pending === "delete"} loadingLabel="Deleting…" onClick={() => setDialog("delete")}><Trash2 /> Delete</LoadingButton></div></header>
    {error && <div className="studio-notice error" role="alert">{error}</div>}
    {!tracks.length ? <div className="studio-empty"><ListMusic /><h3>This playlist is empty</h3><p>Add published tracks from a release page or the music player.</p></div> : <section className="playlist-tracks">{tracks.map((track, index) => <article className={audio.isTrackActive(track.id) ? "active" : ""} key={track.entryId}><button className="playlist-track__play" onClick={() => audio.isTrackActive(track.id) ? audio.toggle() : audio.playTracks(tracks, track.id)}><Play fill="currentColor" /></button><div><strong>{track.title}</strong><small>{track.artistName} · {track.releaseTitle}</small></div><AddToPlaylistButton track={track} /><LoadingButton loading={pending === `reorder-${track.entryId}`} disabled={Boolean(pending) || index === 0} onClick={() => reorder(index, -1)} aria-label={`Move ${track.title} up`}><ArrowUp /></LoadingButton><LoadingButton loading={pending === `reorder-${track.entryId}`} disabled={Boolean(pending) || index === tracks.length - 1} onClick={() => reorder(index, 1)} aria-label={`Move ${track.title} down`}><ArrowDown /></LoadingButton><LoadingButton loading={pending === `remove-${track.entryId}`} disabled={Boolean(pending)} onClick={() => run(`remove-${track.entryId}`, async () => { await removeTrackFromPlaylist({ playlistId, entryId: track.entryId }); await playlistContext.load(); await load(); }, "Track removed from playlist.")} aria-label={`Remove ${track.title}`}><Trash2 /></LoadingButton></article>)}</section>}
    <ActionDialog open={dialog === "rename"} onOpenChange={(open) => !open && setDialog(null)} title="Rename playlist" description="Choose a name that is easy to recognize." initialValue={playlist.name} label="Playlist name" confirmLabel="Save name" loadingLabel="Renaming…" busy={pending === "rename"} onConfirm={submitDialog} />
    <ActionDialog open={dialog === "delete"} onOpenChange={(open) => !open && setDialog(null)} title="Delete this playlist?" description="This permanently removes the playlist. It does not delete its songs." label="Confirmation" confirmationText="DELETE PLAYLIST" confirmLabel="Delete playlist" loadingLabel="Deleting…" destructive busy={pending === "delete"} onConfirm={submitDialog} />
  </main>;
}
