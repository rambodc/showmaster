import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { mediaUrl } from "../lib/catalog";
import MusicArtwork from "./MusicArtwork";

const AudioContext = createContext(null);
const VOLUME_KEY = "showmaster.player.volume.v1";
const DEFAULT_VOLUME = 0.72;

const storedVolume = () => {
  const stored = window.localStorage.getItem(VOLUME_KEY);
  if (stored === null) return DEFAULT_VOLUME;
  const value = Number(stored);
  return Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_VOLUME;
};

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

export function AudioProvider({ children }) {
  const audioRef = useRef(null);
  const objectUrlRef = useRef("");
  const previousVolumeRef = useRef(DEFAULT_VOLUME);
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [source, setSource] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(storedVolume);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [queueOpen, setQueueOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const track = queue[index] || null;
  const hasPrevious = index > 0;
  const hasNext = index < queue.length - 1;

  useEffect(() => {
    let live = true;
    const element = audioRef.current;
    element?.pause();
    setSource("");
    setCurrentTime(0);
    setDuration(0);
    setError("");
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }
    if (!track?.storagePath) {
      setPlaying(false);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    mediaUrl(track.storagePath, {
      privateAccess: track.access === "private-preview",
    })
      .then((url) => {
        if (!live) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
          return;
        }
        if (url.startsWith("blob:")) objectUrlRef.current = url;
        setSource(url);
      })
      .catch(() => {
        if (!live) return;
        setError(
          track.access === "private-preview"
            ? "This private preview is unavailable. Check that you are still signed in as its owner."
            : "This track could not be loaded.",
        );
        setPlaying(false);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [retryKey, track?.access, track?.id, track?.storagePath]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    element.volume = volume;
    window.localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    if (!playing) {
      element.pause();
      return;
    }
    if (!source) return;
    element.play().catch(() => {
      setPlaying(false);
      setError("Playback was blocked. Press play to try again.");
    });
  }, [playing, source]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const play = useCallback(() => {
    if (track) {
      setError("");
      setPlaying(true);
    }
  }, [track]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(
    () => (playing ? pause() : play()),
    [pause, play, playing],
  );
  const seek = useCallback((seconds) => {
    if (!audioRef.current) return;
    const next = Math.max(0, Math.min(Number(seconds), duration || 0));
    audioRef.current.currentTime = next;
    setCurrentTime(next);
  }, [duration]);
  const setVolume = useCallback((nextVolume) => {
    const next = Math.max(0, Math.min(1, Number(nextVolume)));
    if (next > 0) previousVolumeRef.current = next;
    setVolumeState(next);
  }, []);
  const toggleMute = useCallback(() => {
    if (volume > 0) {
      previousVolumeRef.current = volume;
      setVolumeState(0);
    } else {
      setVolumeState(previousVolumeRef.current || DEFAULT_VOLUME);
    }
  }, [volume]);
  const selectTrack = useCallback((nextIndex) => {
    setIndex(nextIndex);
    setPlaying(true);
  }, []);
  const previous = useCallback(() => {
    if (!hasPrevious) return;
    selectTrack(index - 1);
  }, [hasPrevious, index, selectTrack]);
  const next = useCallback(() => {
    if (!hasNext) return;
    selectTrack(index + 1);
  }, [hasNext, index, selectTrack]);
  const playTracks = useCallback((items, startId = items[0]?.id) => {
    const playable = items.filter(
      (item) => item.status === "ready" && item.storagePath,
    );
    if (!playable.length) return false;
    const requestedIndex = playable.findIndex((item) => item.id === startId);
    setQueue(playable);
    setIndex(requestedIndex >= 0 ? requestedIndex : 0);
    setPlaying(true);
    setError("");
    return true;
  }, []);
  const retry = useCallback(() => {
    setError("");
    setPlaying(true);
    setRetryKey((value) => value + 1);
  }, []);
  const close = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
    setQueue([]);
    setIndex(0);
    setSource("");
    setQueueOpen(false);
    setExpanded(false);
    setError("");
  }, []);
  const isTrackActive = useCallback(
    (trackId) => track?.id === trackId,
    [track?.id],
  );

  const value = useMemo(
    () => ({
      queue,
      track,
      index,
      playing,
      loading,
      error,
      currentTime,
      duration,
      volume,
      hasPrevious,
      hasNext,
      queueOpen,
      expanded,
      play,
      pause,
      toggle,
      seek,
      setVolume,
      toggleMute,
      previous,
      next,
      selectTrack,
      playTracks,
      retry,
      close,
      isTrackActive,
      setQueueOpen,
      setExpanded,
    }),
    [
      queue, track, index, playing, loading, error, currentTime, duration,
      volume, hasPrevious, hasNext, queueOpen, expanded, play, pause, toggle,
      seek, setVolume, toggleMute, previous, next, selectTrack, playTracks,
      retry, close, isTrackActive,
    ],
  );

  return (
    <AudioContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        src={source || undefined}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onDurationChange={(event) =>
          setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)
        }
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onEnded={() => {
          if (hasNext) next();
          else setPlaying(false);
        }}
        onError={() => {
          if (!source) return;
          setPlaying(false);
          setLoading(false);
          setError("This track could not be played.");
        }}
      />
      {track && (
        <section className={`real-player${expanded ? " expanded" : ""}`} aria-label="Music player">
          <div className="real-player__track">
            <MusicArtwork
              release={track.release || {
                color: "art-glass",
                title: track.releaseTitle || "Release",
                artist: track.artistName || track.artist,
              }}
              size="mini"
            />
            <div>
              <strong>{track.title}</strong>
              <span>{track.artistName || track.artist}</span>
              {track.access === "private-preview" && <small>Private preview · only you</small>}
            </div>
          </div>
          <div className="real-player__center">
            <div>
              <button onClick={previous} disabled={!hasPrevious} aria-label="Previous track"><SkipBack /></button>
              <button className="real-play" onClick={toggle} disabled={loading && !source} aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
              </button>
              <button onClick={next} disabled={!hasNext} aria-label="Next track"><SkipForward /></button>
            </div>
            <label className="real-player__progress">
              <span>{formatTime(currentTime)}</span>
              <span className="sr-only">Playback position</span>
              <input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(event.target.value)} />
              <span>{formatTime(duration)}</span>
            </label>
            {loading && <small role="status">Loading audio…</small>}
          </div>
          <div className="real-player__tools">
            <button onClick={toggleMute} aria-label={volume ? "Mute" : "Unmute"}>{volume ? <Volume2 /> : <VolumeX />}</button>
            <input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(event.target.value)} />
            <button onClick={() => setQueueOpen(!queueOpen)} aria-label="Toggle queue"><ListMusic /></button>
            <button className="real-player__expand" onClick={() => setExpanded(!expanded)} aria-label={expanded ? "Collapse player" : "Expand player"}>{expanded ? <ChevronDown /> : <ChevronUp />}</button>
            <button onClick={close} aria-label="Close player"><X /></button>
          </div>
          {error && (
            <div className="real-player__error" role="alert">
              <span>{error}</span>
              <button onClick={retry}><RotateCcw /> Retry</button>
              {hasNext && <button onClick={next}>Next track</button>}
            </div>
          )}
          {queueOpen && (
            <aside className="real-queue" aria-label="Playback queue">
              <header><strong>Queue</strong><button onClick={() => setQueueOpen(false)} aria-label="Close queue"><X /></button></header>
              {queue.map((item, itemIndex) => (
                <button className={itemIndex === index ? "active" : ""} aria-current={itemIndex === index ? "true" : undefined} onClick={() => selectTrack(itemIndex)} key={item.id}>
                  <span>{itemIndex + 1}</span>
                  <div><strong>{item.title}</strong><small>{item.artistName || item.artist}</small></div>
                </button>
              ))}
            </aside>
          )}
        </section>
      )}
    </AudioContext.Provider>
  );
}

export const useAudio = () => useContext(AudioContext);
