import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Disc3,
  Edit3,
  ExternalLink,
  FileAudio,
  LayoutDashboard,
  LogOut,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ActionDialog } from "../components/ui/ActionDialog";
import { Dialog } from "../components/ui/Dialog";
import { LoadingButton } from "../components/ui/LoadingButton";
import { PageSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import LogoMark from "../components/LogoMark";
import {
  createRelease,
  createVirtualArtist,
  deleteRelease,
  deleteTrack,
  deleteVirtualArtist,
  friendlyError,
  publishRelease,
  reorderTracks,
  unpublishRelease,
  updateRelease,
  updateTrack,
  updateVirtualArtist,
} from "../lib/api";
import { getArtist, getArtistReleases, getReleaseTracks } from "../lib/catalog";
import { uploadImage, uploadTrack } from "../lib/uploads";
import CatalogArtwork from "../music/CatalogArtwork";
import { useAudio } from "../music/AudioProvider";
import { GENRES } from "../music/constants";

const defaultArtist = { name: "", genre: "Electronic", bio: "" };
const defaultRelease = {
  title: "",
  type: "single",
  genre: "Electronic",
  description: "",
  rightsConfirmed: false,
};

function Notice({ error, children }) {
  return (
    <div
      className={error ? "studio-notice error" : "studio-notice"}
      role={error ? "alert" : undefined}
    >
      {children}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ArtistOnboarding({ onCreated }) {
  const [form, setForm] = useState(defaultArtist);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (event) =>
    setForm((value) => ({ ...value, [key]: event.target.value }));
  return (
    <div className="onboarding-shell">
      <header>
        <div className="music-brand">
          <LogoMark />
          <strong>
            ShowMaster<em>.</em>
          </strong>
        </div>
        <span>Step 1 of 1</span>
      </header>
      <main>
        <aside>
          <span>Virtual Artist</span>
          <h1>
            Give your sound
            <br />
            an identity.
          </h1>
          <p>
            Create the fictional artist behind your AI-generated music. You can
            refine the profile later.
          </p>
          <div className="onboarding-orb">
            <i />
            <i />
          </div>
        </aside>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              const result = await createVirtualArtist(form);
              await onCreated(result.artistId);
            } catch (e) {
              setError(friendlyError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>Artist profile</p>
          <h2>Introduce your Virtual Artist</h2>
          {error && <Notice error>{error}</Notice>}
          <Field label="Artist name">
            <input
              value={form.name}
              onChange={set("name")}
              minLength="2"
              maxLength="60"
              required
              placeholder="e.g. North Arcade"
            />
          </Field>
          <Field label="Primary genre">
            <select value={form.genre} onChange={set("genre")}>
              {GENRES.map((genre) => (
                <option key={genre}>{genre}</option>
              ))}
            </select>
          </Field>
          <Field label="Short bio">
            <textarea
              value={form.bio}
              onChange={set("bio")}
              minLength="20"
              maxLength="500"
              required
              placeholder="Describe the world, sound, and story behind this virtual identity."
            />
            <small>{form.bio.length}/500</small>
          </Field>
          <label className="rights-check">
            <input type="checkbox" required />{" "}
            <span>
              I confirm this identity does not impersonate a real person or
              infringe another artist’s rights.
            </span>
          </label>
          <button className="stream-primary" disabled={busy}>
            {busy ? "Creating artist…" : "Create Virtual Artist"} <span>→</span>
          </button>
        </form>
      </main>
    </div>
  );
}

function StudioSidebar({ view, setView, artist, logout }) {
  const items = [
    ["overview", LayoutDashboard, "Overview"],
    ["releases", Disc3, "Releases"],
    ["artist", UserRound, "Artist profile"],
  ];
  return (
    <aside className="creator-sidebar">
      <div className="music-brand">
        <LogoMark />
        <strong>
          ShowMaster<em>.</em>
        </strong>
      </div>
      <div className="creator-identity">
        <CatalogArtwork item={artist} size="tiny" />
        <div>
          <small>Virtual Artist</small>
          <strong>{artist.name}</strong>
        </div>
      </div>
      <nav>
        {items.map(([id, Icon, label]) => (
          <button
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => setView(id)}
          >
            <Icon />
            {label}
          </button>
        ))}
        <Link to="/library">
          <ExternalLink /> Public library
        </Link>
      </nav>
      <div className="creator-plan">
        <span>Storage</span>
        <div>
          <i
            style={{
              width: `${Math.min(100, ((artist.storageBytes || 0) / (2 * 1024 ** 3)) * 100)}%`,
            }}
          />
        </div>
        <small>Creator beta · 2 GB</small>
      </div>
      <button className="sidebar-logout" onClick={logout}>
        <LogOut /> Log out
      </button>
    </aside>
  );
}

function ReleaseForm({ initial = defaultRelease, onSave, onCancel }) {
  const [form, setForm] = useState({ ...defaultRelease, ...initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (event) =>
    setForm((value) => ({
      ...value,
      [key]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    }));
  return (
    <form
      className="release-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSave(form);
        } catch (e) {
          setError(friendlyError(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <Notice error>{error}</Notice>}
      <div className="form-two">
        <Field label="Release title">
          <input
            required
            maxLength="100"
            value={form.title}
            onChange={set("title")}
          />
        </Field>
        <Field label="Release type">
          <select value={form.type} onChange={set("type")}>
            <option value="single">Single</option>
            <option value="album">Album</option>
          </select>
        </Field>
      </div>
      <Field label="Genre">
        <select value={form.genre} onChange={set("genre")}>
          {GENRES.map((genre) => (
            <option key={genre}>{genre}</option>
          ))}
        </select>
      </Field>
      <Field label="Description">
        <textarea
          maxLength="1000"
          value={form.description}
          onChange={set("description")}
        />
      </Field>
      <label className="rights-check">
        <input
          type="checkbox"
          checked={form.rightsConfirmed}
          onChange={set("rightsConfirmed")}
        />
        <span>
          I own or am licensed to upload this music, identify AI-generated
          content where applicable, and confirm it does not impersonate a real
          person.
        </span>
      </label>
      <footer>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="stream-primary" disabled={busy}>
          {busy ? "Saving…" : "Save release"}
        </button>
      </footer>
    </form>
  );
}

function ReleaseEditor({ release, artist, ownerUid, onBack, onChanged }) {
  const audio = useAudio();
  const toast = useToast();
  const [tracks, setTracks] = useState([]);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [uploadTask, setUploadTask] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [dialog, setDialog] = useState(null);
  const [imageUpload, setImageUpload] = useState(null);
  const load = useCallback(async () => {
    try {
      const values = await getReleaseTracks(release.id, ownerUid);
      setTracks(values);
      setError("");
    } catch (loadError) {
      setError(friendlyError(loadError));
    }
  }, [ownerUid, release.id]);
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [load]);
  const locked = release.status === "published";
  const previewTracks = tracks
    .filter((track) => track.status === "ready" && track.storagePath)
    .map((track) => ({
      ...track,
      access: locked ? "public" : "private-preview",
      artistName: artist.name,
      releaseTitle: release.title,
      release,
    }));
  useEffect(() => () => { if (imageUpload?.previewUrl) URL.revokeObjectURL(imageUpload.previewUrl); }, [imageUpload?.previewUrl]);
  const action = async (key, fn, success) => {
    if (pending) return false;
    setPending(key);
    setError("");
    try {
      await fn();
      await onChanged();
      if (success) toast.success(success);
      return true;
    } catch (e) {
      const message = friendlyError(e); setError(message); toast.error(message);
      return false;
    } finally {
      setPending("");
    }
  };
  return (
    <main className="release-editor">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft /> All releases
      </button>
      <header>
        <div>
          <span>
            {release.type} · {release.status}
          </span>
          <h1>{release.title}</h1>
          <p>
            {artist.name} · {release.genre}
          </p>
        </div>
        <div>
          {locked ? (
            <>
              <Link to={`/release/${release.id}`}>
                <ExternalLink /> View public
              </Link>
              <button
                onClick={() =>
                  action("unpublish", () => unpublishRelease({ releaseId: release.id }), "Release moved back to drafts.")
                }
                disabled={Boolean(pending)}
              >
                {pending === "unpublish" ? "Unpublishing…" : "Unpublish to edit"}
              </button>
            </>
          ) : (
            <>
              <LoadingButton loading={pending === "delete-release"} loadingLabel="Deleting…" disabled={Boolean(pending)} onClick={() => setDialog({ type: "delete-release" })}>
                <Trash2 /> Delete
              </LoadingButton>
              <button disabled={Boolean(pending)} onClick={() => setEditing(true)}>
                <Edit3 /> Edit details
              </button>
              <button
                className="stream-primary"
                onClick={() =>
                  action("publish", () => publishRelease({ releaseId: release.id }), "Release published successfully.")
                }
                disabled={Boolean(pending)}
              >
                {pending === "publish" ? "Publishing…" : "Publish release"}
              </button>
            </>
          )}
        </div>
      </header>
      {error && <Notice error>{error}</Notice>}
      <section className="release-editor-grid">
        <div className="release-cover">
          <div className="artwork-upload-stage">
            <CatalogArtwork item={release} size="hero" previewUrl={imageUpload?.previewUrl} />
            {imageUpload && <div className="artwork-progress" role="status"><strong>{imageUpload.status === "processing" ? "Processing image…" : `Uploading… ${imageUpload.progress}%`}</strong><i><b style={{ width: `${imageUpload.status === "processing" ? 100 : imageUpload.progress}%` }} /></i>{imageUpload.status === "uploading" && <button type="button" onClick={() => imageUpload.task?.cancel()} disabled={!imageUpload.task}>Cancel</button>}</div>}
          </div>
          {!locked && (
            <label>
              <Upload /> {imageUpload ? "Uploading cover…" : "Upload cover"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={Boolean(imageUpload)}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("Artwork must be a JPEG, PNG, or WebP no larger than 5 MB."); event.target.value = ""; return; }
                  const previewUrl = URL.createObjectURL(file);
                  setImageUpload({ previewUrl, progress: 0, status: "uploading", task: null }); setError("");
                  try {
                    const prepared = await uploadImage({
                      targetType: "release",
                      targetId: release.id,
                      file,
                      onProgress: (progress) => setImageUpload((value) => value && ({ ...value, progress })),
                      onTask: (task) => setImageUpload((value) => value && ({ ...value, task })),
                    });
                    setImageUpload((value) => value && ({ ...value, status: "processing", progress: 100, task: null }));
                    let finalized = false;
                    for (let attempt = 0; attempt < 15; attempt += 1) {
                      const result = await onChanged();
                      if (result?.releases?.find((item) => item.id === release.id)?.coverPath === prepared.storagePath) { finalized = true; break; }
                      await new Promise((resolve) => window.setTimeout(resolve, 1000));
                    }
                    setImageUpload(null);
                    toast.success(finalized ? "Cover artwork updated." : "Cover uploaded and is still processing.");
                  } catch (e) {
                    const message = e?.code === "storage/canceled" ? "Cover upload canceled." : friendlyError(e);
                    setError(message); toast.error(message); setImageUpload(null);
                  } finally {
                    event.target.value = "";
                  }
                }}
              />
            </label>
          )}
        </div>
        <div className="track-editor">
          <header>
            <div>
              <h2>Track list</h2>
              <p>{tracks.length} of 20 tracks</p>
            </div>
            {previewTracks.length > 0 && (
              <button
                type="button"
                className="preview-release"
                onClick={() => audio.playTracks(previewTracks)}
              >
                <Play fill="currentColor" /> Preview release
              </button>
            )}
            {!locked && (
              <label className="upload-track">
                <Plus /> Add MP3
                <input
                  type="file"
                  accept="audio/mpeg,.mp3"
                  disabled={Boolean(uploading)}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setUploading({ name: file.name, progress: 0 });
                    setError("");
                    try {
                      await uploadTrack({
                        releaseId: release.id,
                        title: file.name.replace(/\.mp3$/i, ""),
                        file,
                        onProgress: (progress) =>
                          setUploading({ name: file.name, progress }),
                        onTask: setUploadTask,
                      });
                      await load();
                      toast.success("Track uploaded and is being validated.");
                    } catch (e) {
                      const message = e?.code === "storage/canceled" ? "Track upload canceled." : friendlyError(e);
                      setError(message); toast.error(message);
                    } finally {
                      setUploadTask(null);
                      setUploading(null);
                      event.target.value = "";
                    }
                  }}
                />
              </label>
            )}
          </header>
          {uploading && (
            <div className="upload-progress">
              <div>
                <strong>Uploading {uploading.name}</strong>
                <span>{uploading.progress}%</span>
              </div>
              <i>
                <b style={{ width: `${uploading.progress}%` }} />
              </i>
              <button
                type="button"
                className="secondary"
                disabled={!uploadTask}
                onClick={() => uploadTask?.cancel()}
              >
                Cancel upload
              </button>
            </div>
          )}
          {!tracks.length && (
            <div className="empty-tracks">
              <FileAudio />
              <strong>Your track list is empty</strong>
              <p>Add an MP3 to begin building this release.</p>
            </div>
          )}
          {tracks.map((track, index) => (
            <div className={`creator-track${audio.isTrackActive(track.id) ? " active" : ""}`} key={track.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <button
                className="creator-track__play"
                disabled={track.status !== "ready" || !track.storagePath}
                aria-label={
                  audio.isTrackActive(track.id) && audio.playing
                    ? `Pause ${track.title}`
                    : `Play ${track.title}`
                }
                onClick={() => {
                  if (audio.isTrackActive(track.id)) audio.toggle();
                  else audio.playTracks(previewTracks, track.id);
                }}
              >
                {audio.isTrackActive(track.id) && audio.playing
                  ? <Pause fill="currentColor" />
                  : <Play fill="currentColor" />}
              </button>
              <div>
                <strong>{track.title}</strong>
                <small className={`track-status ${track.status}`}>
                  {track.status}
                  {track.rejectionReason ? ` · ${track.rejectionReason}` : ""}
                </small>
                {!locked && track.status === "ready" && (
                  <small className="private-preview-label">Private preview · only you can listen</small>
                )}
              </div>
              <time>
                {track.durationSeconds
                  ? `${Math.floor(track.durationSeconds / 60)}:${String(track.durationSeconds % 60).padStart(2, "0")}`
                  : "—"}
              </time>
              {!locked && (
                <div className="track-actions">
                  <button
                    aria-label={`Move ${track.title} up`}
                    disabled={index === 0}
                    onClick={() =>
                        action(`track-${track.id}`, async () => {
                        const ids = tracks.map((item) => item.id);
                        [ids[index - 1], ids[index]] = [
                          ids[index],
                          ids[index - 1],
                        ];
                        await reorderTracks({
                          releaseId: release.id,
                          trackIds: ids,
                        });
                        await load();
                      })
                    }
                  >
                    <ArrowUp />
                  </button>
                  <button
                    aria-label={`Move ${track.title} down`}
                    disabled={index === tracks.length - 1}
                    onClick={() =>
                      action(`track-${track.id}`, async () => {
                        const ids = tracks.map((item) => item.id);
                        [ids[index + 1], ids[index]] = [
                          ids[index],
                          ids[index + 1],
                        ];
                        await reorderTracks({
                          releaseId: release.id,
                          trackIds: ids,
                        });
                        await load();
                      })
                    }
                  >
                    <ArrowDown />
                  </button>
                  <button
                    aria-label={`Rename ${track.title}`}
                    disabled={Boolean(pending)}
                    onClick={() => setDialog({ type: "rename-track", track })}
                  >
                    <Edit3 />
                  </button>
                  <button
                    aria-label={`Delete ${track.title}`}
                    disabled={Boolean(pending)}
                    onClick={() => setDialog({ type: "delete-track", track })}
                  >
                    <Trash2 />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      <Dialog open={editing} onOpenChange={setEditing} title="Edit release" description="Update the details listeners see when this release is published.">
            <ReleaseForm
              initial={release}
              onCancel={() => setEditing(false)}
              onSave={async (form) => {
                await updateRelease({
                  releaseId: release.id,
                  ...form,
                  coverPath: release.coverPath || "",
                });
                setEditing(false);
                await onChanged();
                toast.success("Release details saved.");
              }}
            />
      </Dialog>
      <ActionDialog open={dialog?.type === "delete-release"} onOpenChange={(open) => !open && setDialog(null)} title="Delete this release?" description="This permanently removes the release, its tracks, and artwork." label="Confirmation" confirmationText="DELETE RELEASE" confirmLabel="Delete release" loadingLabel="Deleting…" destructive busy={pending === "delete-release"} onConfirm={async (confirmation) => { const done = await action("delete-release", () => deleteRelease({ releaseId: release.id, confirmation }), "Release deleted."); if (done) { setDialog(null); onBack(); } }} />
      <ActionDialog open={dialog?.type === "rename-track"} onOpenChange={(open) => !open && setDialog(null)} title="Rename track" description="Update how this track appears on the release." initialValue={dialog?.track?.title || ""} label="Track title" confirmLabel="Save title" loadingLabel="Saving…" busy={pending === `track-${dialog?.track?.id}`} onConfirm={async (title) => { const track = dialog.track; const done = await action(`track-${track.id}`, async () => { await updateTrack({ releaseId: release.id, trackId: track.id, title }); await load(); }, "Track renamed."); if (done) setDialog(null); }} />
      <Dialog open={dialog?.type === "delete-track"} onOpenChange={(open) => { if (!open && !pending) setDialog(null); }} title="Remove this track?" description={`“${dialog?.track?.title || "This track"}” and its uploaded audio will be permanently deleted.`} preventClose={Boolean(pending)}><div className="confirm-dialog-actions"><button className="secondary" disabled={Boolean(pending)} onClick={() => setDialog(null)}>Cancel</button><LoadingButton className="danger-confirm" loading={pending === `track-${dialog?.track?.id}`} loadingLabel="Deleting…" onClick={async () => { const track = dialog.track; const done = await action(`track-${track.id}`, async () => { await deleteTrack({ releaseId: release.id, trackId: track.id }); await load(); }, "Track deleted."); if (done) setDialog(null); }}>Delete track</LoadingButton></div></Dialog>
    </main>
  );
}

export default function DashboardPage({ initialView = "overview" }) {
  const { user, profile, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { releaseId } = useParams();
  const location = useLocation();
  const [artist, setArtist] = useState(null);
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(initialView);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(
    async (artistId = profile?.artistId) => {
      if (!artistId) {
        setLoading(false);
        return;
      }
      try {
        const [artistValue, releaseValues] = await Promise.all([
          getArtist(artistId),
          getArtistReleases(artistId, true, user.uid),
        ]);
        setArtist({ ...artistValue, storageBytes: profile?.storageBytes || 0 });
        setReleases(releaseValues);
        setSelected(releaseId
          ? releaseValues.find((item) => item.id === releaseId) || null
          : null);
        return { artist: artistValue, releases: releaseValues };
      } catch {
        setError("Your creator workspace could not be loaded.");
      } finally {
        setLoading(false);
      }
    },
    [profile?.artistId, profile?.storageBytes, releaseId, user.uid],
  );
  useEffect(() => { setView(initialView); }, [initialView]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!loading && location.hash === "#releases") document.getElementById("releases")?.scrollIntoView({ block: "start" });
  }, [loading, location.hash]);
  if (loading) return <PageSkeleton label="Opening your studio" />;
  if (!profile?.artistId && !artist)
    return (
      <ArtistOnboarding
        onCreated={async (id) => {
          await refreshProfile();
          await load(id);
        }}
      />
    );
  if (selected)
    return (
      <div className="creator-shell">
        <ReleaseEditor
          release={selected}
          artist={artist}
          ownerUid={user.uid}
          onBack={() => navigate("/app/profile#releases")}
          onChanged={() => load(artist.id)}
        />
      </div>
    );
  return (
    <div className="creator-shell">
      <main className="creator-main">
        <header className="creator-header">
          <div>
            <span>Virtual Artist studio</span>
            <h1>
              {view === "overview"
                ? `Welcome back, ${artist.name}.`
                : "Your profile and music"}
            </h1>
          </div>
          <button className="stream-primary" onClick={() => setCreating(true)}>
            <Plus /> New release
          </button>
        </header>
        {error && <Notice error>{error}</Notice>}
        {view === "overview" && (
          <>
            <section className="creator-hero">
              <div>
                <span>Catalog status</span>
                <h2>
                  {
                    releases.filter((item) => item.status === "published")
                      .length
                  }{" "}
                  releases
                  <br />
                  <em>out in the world.</em>
                </h2>
                <p>
                  Build your next release, upload original AI music, and publish
                  when every detail is ready.
                </p>
                <button onClick={() => setCreating(true)}>
                  Create a release <span>→</span>
                </button>
              </div>
              <div className="creator-stack">
                {releases.slice(0, 3).map((release, index) => (
                  <div style={{ "--i": index }} key={release.id}>
                    <CatalogArtwork item={release} size="stack" />
                  </div>
                ))}
              </div>
            </section>
            <div className="studio-stats">
              <article>
                <span>Total releases</span>
                <strong>{releases.length}</strong>
              </article>
              <article>
                <span>Published</span>
                <strong>
                  {
                    releases.filter((item) => item.status === "published")
                      .length
                  }
                </strong>
              </article>
              <article>
                <span>Drafts</span>
                <strong>
                  {releases.filter((item) => item.status === "draft").length}
                </strong>
              </article>
              <article>
                <span>Storage used</span>
                <strong>
                  {((profile?.storageBytes || 0) / 1024 ** 2).toFixed(1)} MB
                </strong>
              </article>
            </div>
          </>
        )}
        {view === "profile" && (
          <ArtistSettings
            artist={artist}
            onSaved={() => load(artist.id)}
            onDeleted={logout}
          />
        )}
        {(view === "overview" || view === "profile") && (
          <section className="creator-releases" id="releases">
            <header>
              <div>
                <span>
                  {view === "overview" ? "Recent work" : "Your music"}
                </span>
                <h2>
                  {view === "overview" ? "Your latest releases" : "Singles, albums, and drafts"}
                </h2>
              </div>
            </header>
            {!releases.length ? (
              <div className="studio-empty">
                <Disc3 />
                <h3>No releases yet</h3>
                <p>Create a single or album, then add your first MP3.</p>
                <button onClick={() => setCreating(true)}>
                  Create first release
                </button>
              </div>
            ) : (
              <div className="creator-release-grid">
                {releases.map((release) => (
                  <button onClick={() => navigate(`/app/releases/${release.id}`)} key={release.id}>
                    <CatalogArtwork item={release} />
                    <span className="artwork-type-badge">{release.type}</span>
                    <span className={`release-state ${release.status}`}>{release.status}</span>
                    <strong>{release.title}</strong>
                    <small>{release.genre}</small>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      <Dialog open={creating} onOpenChange={setCreating} title="Create a release" description="Start as a private draft. Nothing is public until you publish it.">
            <ReleaseForm
              onCancel={() => setCreating(false)}
              onSave={async (form) => {
                const result = await createRelease(form);
                setCreating(false);
                await load(artist.id);
                toast.success("Release created.");
                navigate(`/app/releases/${result.releaseId}`);
              }}
            />
      </Dialog>
    </div>
  );
}

function ArtistSettings({ artist, onSaved, onDeleted }) {
  const [form, setForm] = useState(artist);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [imageUpload, setImageUpload] = useState(null);
  const toast = useToast();
  useEffect(() => setForm(artist), [artist]);
  useEffect(() => () => { if (imageUpload?.previewUrl) URL.revokeObjectURL(imageUpload.previewUrl); }, [imageUpload?.previewUrl]);
  const set = (key) => (event) =>
    setForm((value) => ({ ...value, [key]: event.target.value }));
  return (
    <section className="artist-settings">
      <div className="artist-settings__visual">
        <div className="artwork-upload-stage">
          <CatalogArtwork item={artist} size="hero" previewUrl={imageUpload?.previewUrl} />
          {imageUpload && <div className="artwork-progress" role="status"><strong>{imageUpload.status === "processing" ? "Processing image…" : `Uploading… ${imageUpload.progress}%`}</strong><i><b style={{ width: `${imageUpload.status === "processing" ? 100 : imageUpload.progress}%` }} /></i>{imageUpload.status === "uploading" && <button type="button" onClick={() => imageUpload.task?.cancel()} disabled={!imageUpload.task}>Cancel</button>}</div>}
        </div>
        <label>
          <Upload /> {imageUpload ? "Uploading avatar…" : "Change avatar"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={Boolean(imageUpload)}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("Artwork must be a JPEG, PNG, or WebP no larger than 5 MB."); event.target.value = ""; return; }
              const previewUrl = URL.createObjectURL(file);
              setImageUpload({ previewUrl, progress: 0, status: "uploading", task: null }); setError("");
              try {
                const prepared = await uploadImage({
                  targetType: "artist",
                  targetId: artist.id,
                  file,
                  onProgress: (progress) => setImageUpload((value) => value && ({ ...value, progress })),
                  onTask: (task) => setImageUpload((value) => value && ({ ...value, task })),
                });
                setImageUpload((value) => value && ({ ...value, status: "processing", progress: 100, task: null }));
                let finalized = false;
                for (let attempt = 0; attempt < 15; attempt += 1) {
                  const result = await onSaved();
                  if (result?.artist?.avatarPath === prepared.storagePath) { finalized = true; break; }
                  await new Promise((resolve) => window.setTimeout(resolve, 1000));
                }
                setImageUpload(null);
                toast.success(finalized ? "Artist avatar updated." : "Avatar uploaded and is still processing.");
              } catch (e) {
                const message = e?.code === "storage/canceled" ? "Avatar upload canceled." : friendlyError(e);
                setError(message); toast.error(message); setImageUpload(null);
              } finally {
                event.target.value = "";
              }
            }}
          />
        </label>
      </div>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy("save");
          setError("");
          try {
            await updateVirtualArtist({
              ...form,
              avatarPath: artist.avatarPath || "",
            });
            await onSaved();
            toast.success("Artist profile saved.");
          } catch (e) {
            const message = friendlyError(e); setError(message); toast.error(message);
          } finally { setBusy(""); }
        }}
      >
        <h2>Virtual Artist identity</h2>
        <p>This information appears publicly with every published release.</p>
        {error && <Notice error>{error}</Notice>}
        <Field label="Artist name">
          <input
            required
            minLength="2"
            maxLength="60"
            value={form.name}
            onChange={set("name")}
          />
        </Field>
        <Field label="Primary genre">
          <select value={form.genre} onChange={set("genre")}>
            {GENRES.map((genre) => (
              <option key={genre}>{genre}</option>
            ))}
          </select>
        </Field>
        <Field label="Bio">
          <textarea
            required
            minLength="20"
            maxLength="500"
            value={form.bio}
            onChange={set("bio")}
          />
        </Field>
        <LoadingButton className="stream-primary" loading={busy === "save"} loadingLabel="Saving profile…" disabled={Boolean(busy)}>Save profile</LoadingButton>
        <button type="button" className="danger-button" disabled={Boolean(busy)} onClick={() => setDeleteOpen(true)}>
          <Trash2 /> Delete Virtual Artist
        </button>
      </form>
      <ActionDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete your Virtual Artist?" description="Unpublish every release first. This permanently removes the artist and all associated files." label="Confirmation" confirmationText="DELETE ARTIST" confirmLabel="Delete artist" loadingLabel="Deleting…" destructive busy={busy === "delete"} onConfirm={async (confirmation) => { setBusy("delete"); setError(""); try { await deleteVirtualArtist({ confirmation }); toast.success("Virtual Artist deleted."); setDeleteOpen(false); await onDeleted(); } catch (e) { const message = friendlyError(e); setError(message); toast.error(message); } finally { setBusy(""); } }} />
    </section>
  );
}
