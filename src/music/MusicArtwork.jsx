import { Play } from 'lucide-react';

export default function MusicArtwork({ release, size = 'card', onPlay }) {
  return <div className={`music-art ${release.color} music-art--${size}`} role="img" aria-label={`Abstract artwork for ${release.title} by ${release.artist}`}>
    <span className="art-orbit" /><span className="art-grid" /><span className="art-glow" />
    {onPlay && <button className="art-play" onClick={onPlay} aria-label={`Play ${release.title}`}><Play size={18} fill="currentColor" /></button>}
  </div>;
}
