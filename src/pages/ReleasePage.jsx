import { Clock3, LoaderCircle, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getArtist, getRelease, getReleaseTracks } from "../lib/catalog";
import { useAudio } from "../music/AudioProvider";
import CatalogArtwork from "../music/CatalogArtwork";
import { formatTime } from "../music/constants";
import { AddToPlaylistButton } from "../playlists/PlaylistProvider";
import { PageSkeleton } from "../components/ui/Skeleton";

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
  if (loading) return <div className="public-shell"><PageSkeleton label="Loading release" /></div>;
  if (error) return <div className="public-shell"><div className="catalog-state error" role="alert">{error}</div></div>;
  if (!release) return <div className="public-shell"><div className="catalog-state">Release not found.</div></div>;
  return (
    <div className="public-shell">
      <main className="release-public">
        <section className="release-public__hero">
          <div className="release-hero-artwork"><CatalogArtwork item={release} size="hero" /><span className="artwork-type-badge">{release.type}</span></div>
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
        <section className="track-list public-track-list">
          <header><span>#</span><span aria-hidden="true" /><span>Track</span><Clock3 /></header>
          {tracks.map((track, index) => {
            const active = audio.isTrackActive(track.id);
            const trackLoading = active && audio.loading;
            const playableTrack = playable.find((item) => item.id === track.id);
            return <article className={`public-track-row${active ? " active" : ""}`} key={track.id}>
              <button className="public-track-row__main" onClick={() => active ? audio.toggle() : audio.playTracks(playable, track.id)} aria-label={`${trackLoading ? "Loading" : active && audio.playing ? "Pause" : "Play"} ${track.title}`}>
                <span className="public-track-row__number">{String(index + 1).padStart(2, "0")}</span>
                <span className="public-track-row__play">{trackLoading ? <LoaderCircle className="audio-loading-spinner" /> : active && audio.playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</span>
                <span className="public-track-row__details"><strong>{track.title}</strong><small>{artist?.name}</small></span>
              </button>
              <time>{formatTime(track.durationSeconds || 0)}</time>
              <AddToPlaylistButton track={playableTrack} className="public-track-row__playlist" />
            </article>;
          })}
        </section>
        <aside className="rights-note">This release is presented as AI-generated or AI-assisted music by a Virtual Artist. Its uploader confirmed the necessary rights to publish it.</aside>
      </main>
    </div>
  );
}
