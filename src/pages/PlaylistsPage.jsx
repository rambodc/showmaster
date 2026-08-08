import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowLeft, Edit3, GripVertical, ListMusic, ListPlus, LoaderCircle, MoreVertical, Pause, Play, Plus, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ActionDialog } from "../components/ui/ActionDialog";
import { LoadingButton } from "../components/ui/LoadingButton";
import { PageSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { createPlaylist, deletePlaylist, friendlyError, removeTrackFromPlaylist, renamePlaylist, reorderPlaylistTracks } from "../lib/api";
import { getMyPlaylists, getPlaylist, getPlaylistEntries } from "../lib/catalog";
import { useAudio } from "../music/AudioProvider";
import { usePlaylists } from "../playlists/PlaylistProvider";
import PlaylistArtwork from "../playlists/PlaylistArtwork";
import { formatTime } from "../music/constants";

function OptionsMenu({ label, children }) {
  return <DropdownMenu.Root>
    <DropdownMenu.Trigger className="playlist-options-trigger" aria-label={label}><MoreVertical /></DropdownMenu.Trigger>
    <DropdownMenu.Portal><DropdownMenu.Content className="playlist-options-menu" sideOffset={7} align="end" collisionPadding={12}>{children}</DropdownMenu.Content></DropdownMenu.Portal>
  </DropdownMenu.Root>;
}

function MenuItem({ children, destructive = false, ...props }) {
  return <DropdownMenu.Item className={`playlist-options-item${destructive ? " destructive" : ""}`} {...props}>{children}</DropdownMenu.Item>;
}

function TrackRow({ track, tracks, index, audio, disabled, onMove, onRemove, onAddElsewhere }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.entryId, disabled });
  const active = audio.isTrackActive(track.id);
  const trackLoading = active && audio.loading;
  const playbackState = trackLoading ? " is-loading" : active && audio.playing ? " is-playing" : active ? " is-paused" : "";
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`playlist-track-row${active ? " active" : ""}${playbackState}${isDragging ? " is-dragging" : ""}`}>
    <button className="playlist-track__main" onClick={() => active ? audio.toggle() : audio.playTracks(tracks, track.id)} aria-label={`${trackLoading ? "Loading" : active && audio.playing ? "Pause" : "Play"} ${track.title}`}>
      <span className="playlist-track__play">{trackLoading ? <LoaderCircle className="audio-loading-spinner" /> : active && audio.playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</span>
      <span className="playlist-track__details"><strong>{track.title}</strong><small>{track.artistName} · {track.releaseTitle} · {formatTime(track.durationSeconds || 0)}</small></span>
    </button>
    <button className="playlist-drag-handle" disabled={disabled} aria-label={`Reorder ${track.title}`} {...attributes} {...listeners}><GripVertical /></button>
    <OptionsMenu label={`More options for ${track.title}`}>
      <MenuItem onSelect={() => onAddElsewhere(track)}><ListPlus /> Add to another playlist</MenuItem>
      <MenuItem disabled={disabled || index === 0} onSelect={() => onMove(index, 0)}><GripVertical /> Move to top</MenuItem>
      <MenuItem disabled={disabled || index === tracks.length - 1} onSelect={() => onMove(index, tracks.length - 1)}><GripVertical /> Move to bottom</MenuItem>
      <DropdownMenu.Separator className="playlist-options-separator" />
      <MenuItem destructive disabled={disabled} onSelect={() => onRemove(track)}><Trash2 /> Remove from playlist</MenuItem>
    </OptionsMenu>
  </article>;
}

function DraggedTrack({ track }) {
  if (!track) return null;
  return <div className="playlist-drag-overlay"><GripVertical /><div><strong>{track.title}</strong><small>{track.artistName} · {track.releaseTitle}</small></div></div>;
}

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
  const [activeDragId, setActiveDragId] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
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
    if (pending) return false;
    setPending(key); setError("");
    try { await work(); if (success) toast.success(success); return true; }
    catch (reason) { const message = friendlyError(reason); setError(message); toast.error(message); return false; }
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
  const saveOrder = async (nextTracks) => {
    if (pending || nextTracks.every((item, index) => item.entryId === tracks[index]?.entryId)) return;
    const previous = tracks;
    setTracks(nextTracks);
    setPending("reorder"); setError("");
    try {
      await reorderPlaylistTracks({ playlistId, entryIds: nextTracks.map((item) => item.entryId) });
      toast.success("Playlist order updated.");
    } catch (reason) {
      setTracks(previous);
      const message = friendlyError(reason); setError(message); toast.error(`${message} Previous order restored.`);
    } finally { setPending(""); }
  };
  const moveTrack = (from, to) => saveOrder(arrayMove(tracks, from, to));
  const removeTrack = (track) => run(`remove-${track.entryId}`, async () => {
    await removeTrackFromPlaylist({ playlistId, entryId: track.entryId });
    setTracks((current) => current.filter((item) => item.entryId !== track.entryId));
    await playlistContext.load();
  }, "Track removed from playlist.");
  const activeTrack = useMemo(() => tracks.find((item) => item.entryId === activeDragId), [activeDragId, tracks]);
  const dragAnnouncements = {
    onDragStart: ({ active }) => `Picked up ${tracks.find((item) => item.entryId === active.id)?.title || "track"}.`,
    onDragOver: ({ active, over }) => over ? `${tracks.find((item) => item.entryId === active.id)?.title || "Track"} is over position ${tracks.findIndex((item) => item.entryId === over.id) + 1}.` : undefined,
    onDragEnd: ({ active, over }) => over ? `${tracks.find((item) => item.entryId === active.id)?.title || "Track"} was moved to position ${tracks.findIndex((item) => item.entryId === over.id) + 1}.` : "Reordering cancelled.",
    onDragCancel: () => "Reordering cancelled.",
  };

  if (loading) return <main className="playlist-page"><PageSkeleton label="Loading playlists" /></main>;
  if (!playlistId) return <main className="playlist-page">
    <header><div><span>Your private collection</span><h1>My Playlists</h1><p>Create personal queues from published music across ShowMaster.</p></div><LoadingButton loading={pending === "create"} loadingLabel="Creating…" onClick={() => setDialog("create")}><Plus /> New playlist</LoadingButton></header>
    {error && <div className="studio-notice error" role="alert">{error}</div>}
    {!playlists.length ? <div className="studio-empty"><ListMusic /><h3>No playlists yet</h3><p>Save songs you love into your own private playlists.</p><button onClick={() => setDialog("create")}>Create your first playlist</button></div> : <section className="playlist-grid">{playlists.map((item) => <button onClick={() => navigate(`/app/playlists/${item.id}`)} key={item.id}><PlaylistArtwork playlist={item} /><strong>{item.name}</strong><small>{item.trackCount || 0} tracks · Private</small></button>)}</section>}
    <ActionDialog open={dialog === "create"} onOpenChange={(open) => !open && setDialog(null)} title="Create a playlist" description="Build a private collection from published tracks." label="Playlist name" placeholder="Late night discoveries" confirmLabel="Create playlist" loadingLabel="Creating…" busy={pending === "create"} onConfirm={submitDialog} />
  </main>;
  if (!playlist) return <main className="playlist-page"><button className="back-link" onClick={() => navigate("/app/playlists")}><ArrowLeft /> My Playlists</button><div className="catalog-state">Playlist not found.</div></main>;
  return <main className="playlist-page">
    <button className="back-link" onClick={() => navigate("/app/playlists")}><ArrowLeft /> My Playlists</button>
    <header className="playlist-detail-header"><div className="playlist-heading"><PlaylistArtwork playlist={playlist} compact /><div><span>Private playlist</span><h1>{playlist.name}</h1><p>{tracks.length} saved tracks</p></div></div><div className="playlist-header-actions"><button className="playlist-play-all" disabled={!tracks.length} onClick={() => audio.playTracks(tracks)}><Play fill="currentColor" /> Play all</button><OptionsMenu label="Playlist options"><MenuItem onSelect={() => setDialog("rename")}><Edit3 /> Rename playlist</MenuItem><DropdownMenu.Separator className="playlist-options-separator" /><MenuItem destructive onSelect={() => setDialog("delete")}><Trash2 /> Delete playlist</MenuItem></OptionsMenu></div></header>
    {error && <div className="studio-notice error" role="alert">{error}</div>}
    {pending === "reorder" && <div className="playlist-saving" role="status"><LoaderCircle /> Saving new order…</div>}
    {!tracks.length ? <div className="studio-empty"><ListMusic /><h3>This playlist is empty</h3><p>Add published tracks from a release page or the music player.</p></div> : <DndContext sensors={sensors} collisionDetection={closestCenter} accessibility={{ announcements: dragAnnouncements }} onDragStart={({ active }) => { setActiveDragId(String(active.id)); navigator.vibrate?.(12); }} onDragCancel={() => setActiveDragId("")} onDragEnd={({ active, over }) => { setActiveDragId(""); if (!over || active.id === over.id) return; const from = tracks.findIndex((item) => item.entryId === active.id); const to = tracks.findIndex((item) => item.entryId === over.id); if (from >= 0 && to >= 0) saveOrder(arrayMove(tracks, from, to)); }}>
      <SortableContext items={tracks.map((track) => track.entryId)} strategy={verticalListSortingStrategy}><section className="playlist-tracks">{tracks.map((track, index) => <TrackRow track={track} tracks={tracks} index={index} audio={audio} disabled={Boolean(pending)} onMove={moveTrack} onRemove={removeTrack} onAddElsewhere={(item) => playlistContext.openAddToPlaylist(item, { excludePlaylistId: playlistId })} key={track.entryId} />)}</section></SortableContext>
      <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}><DraggedTrack track={activeTrack} /></DragOverlay>
    </DndContext>}
    <ActionDialog open={dialog === "rename"} onOpenChange={(open) => !open && setDialog(null)} title="Rename playlist" description="Choose a name that is easy to recognize." initialValue={playlist.name} label="Playlist name" confirmLabel="Save name" loadingLabel="Renaming…" busy={pending === "rename"} onConfirm={submitDialog} />
    <ActionDialog open={dialog === "delete"} onOpenChange={(open) => !open && setDialog(null)} title="Delete this playlist?" description="This permanently removes the playlist. It does not delete its songs." label="Confirmation" confirmationText="DELETE PLAYLIST" confirmLabel="Delete playlist" loadingLabel="Deleting…" destructive busy={pending === "delete"} onConfirm={submitDialog} />
  </main>;
}
