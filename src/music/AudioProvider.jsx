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
import { AddToPlaylistButton } from "../playlists/PlaylistProvider";

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
  const requestRef = useRef(0);
  const autoplayRef = useRef(false);
  const transitioningRef = useRef(false);
  const previousVolumeRef = useRef(DEFAULT_VOLUME);
  const minimizeRef = useRef(null);
  const playerRef = useRef(null);
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sourceReady, setSourceReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(storedVolume);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [queueOpen, setQueueOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const track = queue[index] || null;
  const hasPrevious = index > 0;
  const hasNext = index < queue.length - 1;
  const openPlayer = () => { setCollapsing(false); setExpanded(true); };
  const minimizePlayer = () => {
    if (collapsing) return;
    setCollapsing(true);
    window.setTimeout(() => { setExpanded(false); setCollapsing(false); }, 260);
  };

  useEffect(() => {
    let live = true;
    const request = ++requestRef.current;
    const element = audioRef.current;
    setError("");
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }
    if (!track?.storagePath) {
      setPlaying(false);
      setLoading(false);
      transitioningRef.current = false;
      return undefined;
    }
    setLoading(true);
    mediaUrl(track.storagePath, {
      privateAccess: track.access === "private-preview",
    })
      .then((url) => {
        if (!live || request !== requestRef.current) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
          return;
        }
        if (url.startsWith("blob:")) objectUrlRef.current = url;
        element.src = url;
        element.load();
        setSourceReady(true);
        if (autoplayRef.current) {
          element.play().catch(() => {
            autoplayRef.current = false;
            transitioningRef.current = false;
            setPlaying(false);
            setError("Playback was blocked. Press play to try again.");
          });
        } else {
          transitioningRef.current = false;
        }
      })
      .catch(() => {
        if (!live) return;
        setError(
          track.access === "private-preview"
            ? "This private preview is unavailable. Check that you are still signed in as its owner."
            : "This track could not be loaded.",
        );
        setPlaying(false);
        autoplayRef.current = false;
        transitioningRef.current = false;
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

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!expanded || (window.matchMedia && !window.matchMedia("(max-width: 760px)").matches)) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    minimizeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") minimizePlayer();
      if (event.key === "Tab") {
        const controls = [...(playerRef.current?.querySelectorAll("button:not(:disabled), input:not(:disabled)") || [])].filter((control) => control.offsetParent !== null || control === document.activeElement);
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown); };
  }, [expanded, collapsing]);

  const detachSource = useCallback(() => {
    const element = audioRef.current;
    requestRef.current += 1;
    transitioningRef.current = true;
    setSourceReady(false);
    setCurrentTime(0);
    setDuration(0);
    if (!element) return;
    element.pause();
    element.removeAttribute("src");
    element.load();
  }, []);
  const play = useCallback(() => {
    if (!track) return;
    autoplayRef.current = true;
    setError("");
    setPlaying(true);
    if (sourceReady)
      audioRef.current?.play().catch(() => {
        autoplayRef.current = false;
        setPlaying(false);
        setError("Playback was blocked. Press play to try again.");
      });
  }, [sourceReady, track]);
  const pause = useCallback(() => {
    autoplayRef.current = false;
    transitioningRef.current = false;
    audioRef.current?.pause();
    setPlaying(false);
  }, []);
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
    autoplayRef.current = true;
    detachSource();
    setIndex(nextIndex);
    setRetryKey((value) => value + 1);
    setPlaying(true);
    setLoading(true);
  }, [detachSource]);
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
    autoplayRef.current = true;
    detachSource();
    const requestedIndex = playable.findIndex((item) => item.id === startId);
    setQueue(playable);
    setIndex(requestedIndex >= 0 ? requestedIndex : 0);
    setRetryKey((value) => value + 1);
    setPlaying(true);
    setError("");
    setLoading(true);
    return true;
  }, [detachSource]);
  const retry = useCallback(() => {
    autoplayRef.current = true;
    detachSource();
    setError("");
    setPlaying(true);
    setRetryKey((value) => value + 1);
  }, [detachSource]);
  const close = useCallback(() => {
    autoplayRef.current = false;
    detachSource();
    setPlaying(false);
    setQueue([]);
    setIndex(0);
    setQueueOpen(false);
    setExpanded(false);
    setError("");
  }, [detachSource]);
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
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => {
          if (!transitioningRef.current) setPlaying(false);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onDurationChange={(event) =>
          setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)
        }
        onWaiting={() => setLoading(true)}
        onPlaying={() => {
          transitioningRef.current = false;
          setLoading(false);
          setPlaying(true);
        }}
        onCanPlay={() => setLoading(false)}
        onEnded={() => {
          if (hasNext) next();
          else setPlaying(false);
        }}
        onError={() => {
          if (!sourceReady) return;
          autoplayRef.current = false;
          transitioningRef.current = false;
          setPlaying(false);
          setLoading(false);
          setError("This track could not be played.");
        }}
      />
      {track && (
        <section ref={playerRef} className={`real-player${expanded ? " expanded" : ""}${collapsing ? " collapsing" : ""}`} aria-label="Music player" role={expanded ? "dialog" : undefined} aria-modal={expanded ? "true" : undefined}>
          <header className="real-player__sheet-head">
            <button ref={minimizeRef} onClick={minimizePlayer} aria-label="Minimize player"><ChevronDown /></button>
            <span>Now Playing</span>
            <i aria-hidden="true" />
          </header>
          <button type="button" className="real-player__track" onClick={() => !expanded && openPlayer()} aria-label={expanded ? undefined : "Open Now Playing"}>
            <MusicArtwork
              release={track.release || {
                color: "art-glass",
                title: track.releaseTitle || "Release",
                artist: track.artistName || track.artist,
              }}
              size="mini"
            />
            <div>
              <strong className={playing ? "is-playing" : ""} title={track.title}><span>{track.title}</span></strong>
              <span>{track.artistName || track.artist}</span>
              <em>{queue.length > 1 ? `${index + 1} of ${queue.length} · Queue` : "Single track"}</em>
              {track.access === "private-preview" && <small>Private preview · only you</small>}
            </div>
          </button>
          <div className="real-player__center">
            <div>
              <button onClick={previous} disabled={!hasPrevious} aria-label="Previous track"><SkipBack /></button>
              <button className="real-play" onClick={toggle} disabled={loading && !sourceReady} aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
              </button>
              <button onClick={next} disabled={!hasNext} aria-label="Next track"><SkipForward /></button>
            </div>
            <label className="real-player__progress">
              <span>{formatTime(currentTime)}</span>
              <span className="sr-only">Playback position</span>
              <input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onInput={(event) => seek(event.currentTarget.value)} onChange={(event) => seek(event.target.value)} />
              <span>{formatTime(duration)}</span>
            </label>
            {loading && <small role="status">Loading audio…</small>}
          </div>
          <div className="real-player__tools">
            <AddToPlaylistButton track={track} />
            <button onClick={toggleMute} aria-label={volume ? "Mute" : "Unmute"}>{volume ? <Volume2 /> : <VolumeX />}</button>
            <input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onInput={(event) => setVolume(event.currentTarget.value)} onChange={(event) => setVolume(event.target.value)} />
            {queue.length > 1 && <button onClick={() => setQueueOpen(!queueOpen)} aria-label="Toggle queue"><ListMusic /></button>}
            <button onClick={close} aria-label="Close player"><X /></button>
          </div>
          {error && (
            <div className="real-player__error" role="alert">
              <span>{error}</span>
              <button onClick={retry}><RotateCcw /> Retry</button>
              {hasNext && <button onClick={next}>Next track</button>}
            </div>
          )}
          {(queueOpen || expanded) && queue.length > 1 && (
            <aside className="real-queue" aria-label="Playback queue">
              <header><strong>Queue</strong><button onClick={() => setQueueOpen(false)} aria-label="Close queue"><X /></button></header>
              {queue.map((item, itemIndex) => (
                <div className={`real-queue__item${itemIndex === index ? " active" : ""}`} key={`${item.release?.id || item.releaseId}-${item.id}`}>
                  <button aria-current={itemIndex === index ? "true" : undefined} onClick={() => selectTrack(itemIndex)}>
                    <span>{itemIndex + 1}</span><div><strong>{item.title}</strong><small>{item.artistName || item.artist}</small></div>
                  </button>
                  <AddToPlaylistButton track={item} />
                </div>
              ))}
            </aside>
          )}
        </section>
      )}
    </AudioContext.Provider>
  );
}

export const useAudio = () => useContext(AudioContext);
