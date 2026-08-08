import { ListMusic } from "lucide-react";

const palettes = [
  ["#ff5cab", "#744ee8", "#1d1140"],
  ["#43d3e8", "#4865e8", "#21124d"],
  ["#ff8d61", "#d94ba5", "#3b174b"],
  ["#72df9b", "#36a9c8", "#172f4c"],
  ["#f2c654", "#ed6f79", "#40204e"],
];

export default function PlaylistArtwork({ playlist, compact = false }) {
  const seed = [...String(playlist?.id || playlist?.name || "playlist")].reduce((total, character) => total + character.charCodeAt(0), 0);
  const [start, end, base] = palettes[seed % palettes.length];
  return <div className={`playlist-artwork${compact ? " compact" : ""}`} style={{ "--playlist-start": start, "--playlist-end": end, "--playlist-base": base }} aria-hidden="true">
    <i /><i /><ListMusic />
    <span>PLAYLIST</span>
  </div>;
}
