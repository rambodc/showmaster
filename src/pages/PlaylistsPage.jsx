import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Edit3, ListMusic, Play, Plus, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
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
  const [playlists, setPlaylists] = useState([]);
  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
  const create = async () => {
    const name = window.prompt("Playlist name");
    if (!name) return;
    try { const result = await createPlaylist({ name }); await playlistContext.load(); navigate(`/app/playlists/${result.playlistId}`); }
    catch (reason) { setError(friendlyError(reason)); }
  };
  const reorder = async (index, direction) => {
    const ids = tracks.map((item) => item.entryId);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    await reorderPlaylistTracks({ playlistId, entryIds: ids });
    await load();
  };
  if (loading) return <main className="playlist-page"><div className="catalog-state">Loading playlists…</div></main>;
  if (!playlistId) return <main className="playlist-page">
    <header><div><span>Your private collection</span><h1>My Playlists</h1><p>Create personal queues from published music across Showmaster.</p></div><button onClick={create}><Plus /> New playlist</button></header>
    {error && <div className="studio-notice error" role="alert">{error}</div>}
    {!playlists.length ? <div className="studio-empty"><ListMusic /><h3>No playlists yet</h3><p>Save songs you love into your own private playlists.</p><button onClick={create}>Create your first playlist</button></div> : <section className="playlist-grid">{playlists.map((item) => <button onClick={() => navigate(`/app/playlists/${item.id}`)} key={item.id}><ListMusic /><strong>{item.name}</strong><small>{item.trackCount || 0} tracks · Private</small></button>)}</section>}
  </main>;
  if (!playlist) return <main className="playlist-page"><button className="back-link" onClick={() => navigate("/app/playlists")}><ArrowLeft /> My Playlists</button><div className="catalog-state">Playlist not found.</div></main>;
  return <main className="playlist-page">
    <button className="back-link" onClick={() => navigate("/app/playlists")}><ArrowLeft /> My Playlists</button>
    <header><div><span>Private playlist</span><h1>{playlist.name}</h1><p>{tracks.length} saved tracks</p></div><div><button disabled={!tracks.length} onClick={() => audio.playTracks(tracks)}><Play fill="currentColor" /> Play all</button><button onClick={async () => { const name = window.prompt("Playlist name", playlist.name); if (!name) return; try { await renamePlaylist({ playlistId, name }); await playlistContext.load(); await load(); } catch (reason) { setError(friendlyError(reason)); } }}><Edit3 /> Rename</button><button onClick={async () => { const confirmation = window.prompt("Type DELETE PLAYLIST to permanently delete this playlist."); if (confirmation !== "DELETE PLAYLIST") return; try { await deletePlaylist({ playlistId, confirmation }); await playlistContext.load(); navigate("/app/playlists"); } catch (reason) { setError(friendlyError(reason)); } }}><Trash2 /> Delete</button></div></header>
    {error && <div className="studio-notice error" role="alert">{error}</div>}
    {!tracks.length ? <div className="studio-empty"><ListMusic /><h3>This playlist is empty</h3><p>Add published tracks from a release page or the music player.</p></div> : <section className="playlist-tracks">{tracks.map((track, index) => <article className={audio.isTrackActive(track.id) ? "active" : ""} key={track.entryId}><button className="playlist-track__play" onClick={() => audio.isTrackActive(track.id) ? audio.toggle() : audio.playTracks(tracks, track.id)}><Play fill="currentColor" /></button><div><strong>{track.title}</strong><small>{track.artistName} · {track.releaseTitle}</small></div><AddToPlaylistButton track={track} /><button disabled={index === 0} onClick={() => reorder(index, -1)} aria-label={`Move ${track.title} up`}><ArrowUp /></button><button disabled={index === tracks.length - 1} onClick={() => reorder(index, 1)} aria-label={`Move ${track.title} down`}><ArrowDown /></button><button onClick={async () => { try { await removeTrackFromPlaylist({ playlistId, entryId: track.entryId }); await playlistContext.load(); await load(); } catch (reason) { setError(friendlyError(reason)); } }} aria-label={`Remove ${track.title}`}><Trash2 /></button></article>)}</section>}
  </main>;
}
