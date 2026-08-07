import { Pause, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { getReleaseTracks } from "../lib/catalog";
import { useAudio } from "../music/AudioProvider";
import CatalogArtwork from "../music/CatalogArtwork";

export default function ReleaseCard({ release }) {
  const audio = useAudio();
  const active = audio.track?.release?.id === release.id;
  const play = async () => {
    if (active) {
      audio.toggle();
      return;
    }
    const tracks = await getReleaseTracks(release.id);
    audio.playTracks(
      tracks.map((track) => ({
        ...track,
        access: "public",
        artistName: release.artist?.name,
        releaseTitle: release.title,
        release,
      })),
    );
  };
  return (
    <article className={`public-release-card${active ? " active" : ""}`}>
      <div>
        <Link to={`/release/${release.id}`}><CatalogArtwork item={release} /></Link>
        <button onClick={() => play().catch(() => undefined)} aria-label={`${active && audio.playing ? "Pause" : "Play"} ${release.title}`}>
          {active && audio.playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
        </button>
      </div>
      <Link to={`/release/${release.id}`}><strong>{release.title}</strong></Link>
      {release.artist && <Link to={`/artist/${release.artist.slug}`}>{release.artist.name}</Link>}
      <span>{release.type} · {release.genre}</span>
    </article>
  );
}
