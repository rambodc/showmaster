import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  AudioLines,
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
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
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
          <span>
            <AudioLines />
          </span>
          <strong>
            showmaster<em>.</em>
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
        <span>
          <AudioLines />
        </span>
        <strong>
          showmaster<em>.</em>
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
  const [tracks, setTracks] = useState([]);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [uploadTask, setUploadTask] = useState(null);
  const [error, setError] = useState("");
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
  const action = async (fn) => {
    setError("");
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setError(friendlyError(e));
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
                  action(() => unpublishRelease({ releaseId: release.id }))
                }
              >
                Unpublish to edit
              </button>
            </>
          ) : (
            <>
              <button
                onClick={async () => {
                  const confirmation = window.prompt(
                    "Type DELETE RELEASE to permanently remove this release and its files.",
                  );
                  if (confirmation !== "DELETE RELEASE") return;
                  await action(() =>
                    deleteRelease({ releaseId: release.id, confirmation }),
                  );
                  onBack();
                }}
              >
                <Trash2 /> Delete
              </button>
              <button onClick={() => setEditing(true)}>
                <Edit3 /> Edit details
              </button>
              <button
                className="stream-primary"
                onClick={() =>
                  action(() => publishRelease({ releaseId: release.id }))
                }
              >
                Publish release
              </button>
            </>
          )}
        </div>
      </header>
      {error && <Notice error>{error}</Notice>}
      <section className="release-editor-grid">
        <div className="release-cover">
          <CatalogArtwork item={release} size="hero" />
          {!locked && (
            <label>
              <Upload /> Upload cover
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    await uploadImage({
                      targetType: "release",
                      targetId: release.id,
                      file,
                    });
                    await onChanged();
                  } catch (e) {
                    setError(friendlyError(e));
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
                    } catch (e) {
                      setError(friendlyError(e));
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
                      action(async () => {
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
                      action(async () => {
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
                    onClick={() =>
                      action(async () => {
                        const title = window.prompt("Track title", track.title);
                        if (!title) return;
                        await updateTrack({
                          releaseId: release.id,
                          trackId: track.id,
                          title,
                        });
                        await load();
                      })
                    }
                  >
                    <Edit3 />
                  </button>
                  <button
                    aria-label={`Delete ${track.title}`}
                    onClick={() =>
                      action(async () => {
                        await deleteTrack({
                          releaseId: release.id,
                          trackId: track.id,
                        });
                        await load();
                      })
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      {editing && (
        <div className="studio-modal">
          <button aria-label="Close" onClick={() => setEditing(false)} />
          <div>
            <h2>Edit release</h2>
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
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}

export default function DashboardPage() {
  const { user, profile, logout, refreshProfile } = useAuth();
  const [artist, setArtist] = useState(null);
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("overview");
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
        setSelected((value) =>
          value
            ? releaseValues.find((item) => item.id === value.id) || null
            : null,
        );
      } catch {
        setError("Your creator workspace could not be loaded.");
      } finally {
        setLoading(false);
      }
    },
    [profile?.artistId, profile?.storageBytes, user.uid],
  );
  useEffect(() => {
    load();
  }, [load]);
  if (loading) return <div className="catalog-state">Opening your studio…</div>;
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
        <StudioSidebar
          view="releases"
          setView={(next) => {
            setSelected(null);
            setView(next);
          }}
          artist={artist}
          logout={logout}
        />
        <ReleaseEditor
          release={selected}
          artist={artist}
          ownerUid={user.uid}
          onBack={() => setSelected(null)}
          onChanged={() => load(artist.id)}
        />
      </div>
    );
  return (
    <div className="creator-shell">
      <StudioSidebar
        view={view}
        setView={setView}
        artist={artist}
        logout={logout}
      />
      <main className="creator-main">
        <header className="creator-header">
          <div>
            <span>Virtual Artist studio</span>
            <h1>
              {view === "overview"
                ? `Welcome back, ${artist.name}.`
                : view === "releases"
                  ? "Your releases"
                  : "Artist profile"}
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
        {(view === "overview" || view === "releases") && (
          <section className="creator-releases">
            <header>
              <div>
                <span>
                  {view === "overview" ? "Recent work" : "Catalog manager"}
                </span>
                <h2>
                  {view === "overview"
                    ? "Your latest releases"
                    : "Singles and albums"}
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
                  <button onClick={() => setSelected(release)} key={release.id}>
                    <CatalogArtwork item={release} />
                    <span className={`release-state ${release.status}`}>
                      {release.status}
                    </span>
                    <strong>{release.title}</strong>
                    <small>
                      {release.type} · {release.genre}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
        {view === "artist" && (
          <ArtistSettings
            artist={artist}
            onSaved={() => load(artist.id)}
            onDeleted={logout}
          />
        )}
      </main>
      {creating && (
        <div className="studio-modal">
          <button aria-label="Close" onClick={() => setCreating(false)} />
          <div>
            <h2>Create a release</h2>
            <p>
              Start as a private draft. Nothing is public until you publish it.
            </p>
            <ReleaseForm
              onCancel={() => setCreating(false)}
              onSave={async (form) => {
                const result = await createRelease(form);
                setCreating(false);
                await load(artist.id);
                setSelected({
                  id: result.releaseId,
                  ...form,
                  status: "draft",
                  artistId: artist.id,
                });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ArtistSettings({ artist, onSaved, onDeleted }) {
  const [form, setForm] = useState(artist);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const set = (key) => (event) =>
    setForm((value) => ({ ...value, [key]: event.target.value }));
  return (
    <section className="artist-settings">
      <div className="artist-settings__visual">
        <CatalogArtwork item={artist} size="hero" />
        <label>
          <Upload /> Change avatar
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                await uploadImage({
                  targetType: "artist",
                  targetId: artist.id,
                  file,
                });
                setMessage("Avatar uploaded and is processing.");
              } catch (e) {
                setError(friendlyError(e));
              }
            }}
          />
        </label>
      </div>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            await updateVirtualArtist({
              ...form,
              avatarPath: artist.avatarPath || "",
            });
            setMessage("Artist profile saved.");
            await onSaved();
          } catch (e) {
            setError(friendlyError(e));
          }
        }}
      >
        <h2>Virtual Artist identity</h2>
        <p>This information appears publicly with every published release.</p>
        {error && <Notice error>{error}</Notice>}
        {message && <Notice>{message}</Notice>}
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
        <button className="stream-primary">Save profile</button>
        <button
          type="button"
          className="danger-button"
          onClick={async () => {
            const confirmation = window.prompt(
              "Unpublish every release first. Type DELETE ARTIST to permanently remove this artist and all files.",
            );
            if (confirmation !== "DELETE ARTIST") return;
            try {
              await deleteVirtualArtist({ confirmation });
              await onDeleted();
            } catch (e) {
              setError(friendlyError(e));
            }
          }}
        >
          <Trash2 /> Delete Virtual Artist
        </button>
      </form>
    </section>
  );
}
