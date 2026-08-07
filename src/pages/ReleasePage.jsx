import { Clock3, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getArtist, getRelease, getReleaseTracks } from "../lib/catalog";
import { useAudio } from "../music/AudioProvider";
import CatalogArtwork from "../music/CatalogArtwork";
import { formatTime } from "../music/constants";
import { AddToPlaylistButton } from "../playlists/PlaylistProvider";

export default function ReleasePage() {
  const { releaseId } = useParams();
  const audio = useAudio();
  const [release, setRelease] = useState(null);
  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    (async () => {
      const value = await getRelease(releaseId);
      if (!value || value.status !== "published") return;
      const [artistValue, trackValues] = await Promise.all([
        getArtist(value.artistId),
        getReleaseTracks(value.id),
      ]);
      if (!live) return;
      setRelease(value);
      setArtist(artistValue);
      setTracks(trackValues);
    })()
      .catch(() => live && setError("This release could not be loaded."))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [releaseId]);
  const playable = useMemo(
    () => tracks.map((track) => ({
      ...track,
      access: "public",
      artistName: artist?.name,
      releaseTitle: release?.title,
      release,
    })),
    [artist?.name, release, tracks],
  );
  const releaseActive = audio.track?.release?.id === release?.id;
  const playRelease = () => releaseActive ? audio.toggle() : audio.playTracks(playable);
  if (loading) return <div className="public-shell"><div className="catalog-state">Loading release…</div></div>;
  if (error) return <div className="public-shell"><div className="catalog-state error" role="alert">{error}</div></div>;
  if (!release) return <div className="public-shell"><div className="catalog-state">Release not found.</div></div>;
  return (
    <div className="public-shell">
      <main className="release-public">
        <section className="release-public__hero">
          <CatalogArtwork item={release} size="hero" />
          <div>
            <span>{release.type} · {release.genre}</span>
            <h1>{release.title}</h1>
            {artist && <Link to={`/artist/${artist.slug}`}>{artist.name}</Link>}
            <p>{release.description}</p>
            <button onClick={playRelease} disabled={!playable.length}>
              {releaseActive && audio.playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
              {!playable.length ? "No playable tracks" : releaseActive && audio.playing ? "Pause release" : "Play release"}
            </button>
          </div>
        </section>
        <section className="track-list">
          <header><span>#</span><span>Track</span><Clock3 /></header>
          {tracks.map((track, index) => {
            const active = audio.isTrackActive(track.id);
            const playableTrack = playable.find((item) => item.id === track.id);
            return <article className={active ? "active" : ""} key={track.id}>
              <button onClick={() => active ? audio.toggle() : audio.playTracks(playable, track.id)}>
                <span>{active && audio.playing ? <Pause fill="currentColor" /> : index + 1}</span><span><strong>{track.title}</strong><small>{artist?.name}</small></span><time>{formatTime(track.durationSeconds || 0)}</time>
              </button>
              <AddToPlaylistButton track={playableTrack} />
            </article>;
          })}
        </section>
        <aside className="rights-note">This release is presented as AI-generated or AI-assisted music by a Virtual Artist. Its uploader confirmed the necessary rights to publish it.</aside>
      </main>
    </div>
  );
}
