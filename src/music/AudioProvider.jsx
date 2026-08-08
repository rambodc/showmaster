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
  LoaderCircle,
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
  const compactTitleRef = useRef(null);
  const gestureRef = useRef(null);
  const suppressClickRef = useRef(false);
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
  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.("(max-width: 760px)").matches || false);
  const [retryKey, setRetryKey] = useState(0);
  const [titleOverflowing, setTitleOverflowing] = useState(false);
  const track = queue[index] || null;
  const hasPrevious = index > 0;
  const hasNext = index < queue.length - 1;
  const playbackState = (active) => !active ? "" : loading ? " is-loading" : playing ? " is-playing" : " is-paused";
  const transportIcon = loading
    ? <LoaderCircle className="audio-loading-spinner" aria-hidden="true" />
    : playing
      ? <Pause fill="currentColor" />
      : <Play fill="currentColor" />;
  const openPlayer = useCallback(() => { setCollapsing(false); setExpanded(true); }, []);
  const minimizePlayer = useCallback(() => {
    if (collapsing) return;
    setCollapsing(true);
    window.setTimeout(() => { setExpanded(false); setCollapsing(false); }, 260);
  }, [collapsing]);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

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
    if (!expanded) return undefined;
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
  }, [expanded, collapsing, minimizePlayer]);

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

  const gestureStart = useCallback((event) => {
    if (!isMobile || event.pointerType === "mouse") return;
    const interactive = event.target.closest("button, input, a, [role='menuitem'], .mobile-player__queue, .dialog-content");
    const identity = event.target.closest(".mobile-player__identity");
    if (interactive && !identity) return;
    if (expanded && playerRef.current?.scrollTop > 0) return;
    gestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), locked: false, delta: 0 };
  }, [expanded, isMobile]);

  const gestureMove = useCallback((event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.locked) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      if (Math.abs(dx) >= Math.abs(dy) || (expanded ? dy <= 0 : dy >= 0)) {
        gestureRef.current = null;
        return;
      }
      gesture.locked = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      event.currentTarget.classList.add("is-gesture-dragging");
    }
    event.preventDefault();
    const directional = expanded ? Math.max(0, dy) : Math.min(0, dy);
    gesture.delta = directional;
    const resisted = directional * (1 - Math.min(Math.abs(directional), 500) / 1400);
    event.currentTarget.style.setProperty("--sheet-drag-y", `${resisted}px`);
  }, [expanded]);

  const gestureEnd = useCallback((event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    const element = event.currentTarget;
    element.releasePointerCapture?.(event.pointerId);
    element.classList.remove("is-gesture-dragging");
    const distance = Math.abs(gesture.delta);
    const velocity = distance / Math.max(1, performance.now() - gesture.time);
    const complete = gesture.locked && (distance >= 70 || velocity >= 0.65);
    element.style.removeProperty("--sheet-drag-y");
    if (complete) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 300);
      if (expanded) minimizePlayer(); else openPlayer();
    } else if (gesture.locked) {
      element.classList.add("is-gesture-rebounding");
      window.setTimeout(() => element.classList.remove("is-gesture-rebounding"), 220);
    }
  }, [expanded, minimizePlayer, openPlayer]);

  const gestureCancel = useCallback((event) => {
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    event.currentTarget.classList.remove("is-gesture-dragging");
    event.currentTarget.style.removeProperty("--sheet-drag-y");
  }, []);

  const openFromClick = useCallback(() => {
    if (!suppressClickRef.current) openPlayer();
  }, [openPlayer]);

  useEffect(() => {
    if (expanded || !track) {
      setTitleOverflowing(false);
      return undefined;
    }
    const title = compactTitleRef.current;
    if (!title) return undefined;
    const measure = () => setTitleOverflowing(title.scrollWidth > title.clientWidth + 2);
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(title);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [expanded, isMobile, track]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return undefined;
    const session = navigator.mediaSession;
    if (track && typeof MediaMetadata === "function") {
      session.metadata = new MediaMetadata({
        title: track.title || "Untitled track",
        artist: track.artistName || track.artist || "ShowMaster artist",
        album: track.releaseTitle || track.release?.title || "ShowMaster",
      });
    } else if (!track) session.metadata = null;
    const handlers = {
      play,
      pause,
      previoustrack: hasPrevious ? previous : null,
      nexttrack: hasNext ? next : null,
      seekto: (details) => {
        if (typeof details.seekTime === "number") seek(details.seekTime);
      },
      seekbackward: (details) => seek((audioRef.current?.currentTime || 0) - (details.seekOffset || 10)),
      seekforward: (details) => seek((audioRef.current?.currentTime || 0) + (details.seekOffset || 10)),
    };
    Object.entries(handlers).forEach(([action, handler]) => {
      try { session.setActionHandler(action, handler); } catch { /* Unsupported action. */ }
    });
    return () => Object.keys(handlers).forEach((action) => {
      try { session.setActionHandler(action, null); } catch { /* Unsupported action. */ }
    });
  }, [hasNext, hasPrevious, next, pause, play, previous, seek, track]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try { navigator.mediaSession.playbackState = playing ? "playing" : "paused"; } catch { /* Optional API. */ }
  }, [playing]);

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
        playsInline
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
      {track && (expanded ? (
        <section ref={playerRef} className={`mobile-player is-expanded${!isMobile ? " is-desktop" : ""}${collapsing ? " is-collapsing" : ""}${playing ? " is-playing" : " is-paused"}`} aria-label="Music player" role="dialog" aria-modal="true" onPointerDown={gestureStart} onPointerMove={gestureMove} onPointerUp={gestureEnd} onPointerCancel={gestureCancel}>
          <div className="mobile-player__content">
            <header className="mobile-player__header"><button ref={minimizeRef} onClick={minimizePlayer} aria-label="Minimize player"><ChevronDown /></button><strong>Now Playing</strong><i /></header>
            <div className={`mobile-player__artwork${playing ? " is-playing" : ""}`}><MusicArtwork release={track.release || { color: "art-glass", title: track.releaseTitle || "Release", artist: track.artistName || track.artist }} size="hero" /></div>
            <div className="mobile-player__details"><strong>{track.title}</strong><span>{track.artistName || track.artist}</span><small>{queue.length > 1 ? `${index + 1} of ${queue.length}` : "Single track"}{track.releaseTitle ? ` · ${track.releaseTitle}` : ""}{track.access === "private-preview" ? " · Private preview" : ""}</small></div>
            <label className="mobile-player__seek mobile-player__seek--expanded"><span>{formatTime(currentTime)}</span><input aria-label="Playback position" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(event.target.value)} /><span>{formatTime(duration)}</span></label>
            <div className="mobile-player__controls"><button onClick={previous} disabled={!hasPrevious} aria-label="Previous track"><SkipBack /></button><button className="mobile-player__play" onClick={toggle} disabled={loading && !sourceReady} aria-label={loading ? "Loading audio" : playing ? "Pause" : "Play"}>{transportIcon}</button><button onClick={next} disabled={!hasNext} aria-label="Next track"><SkipForward /></button></div>
            <div className="mobile-player__actions"><AddToPlaylistButton track={track}>Add to playlist</AddToPlaylistButton></div>
            {!isMobile && <div className="mobile-player__desktop-volume"><button onClick={toggleMute} aria-label={volume ? "Mute" : "Unmute"}>{volume ? <Volume2 /> : <VolumeX />}</button><input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(event.target.value)} /></div>}
            {queue.length > 1 && <aside className="mobile-player__queue" aria-label="Playback queue"><header><strong>Up next</strong><span>{queue.length} tracks</span></header>{queue.map((item, itemIndex) => { const active = itemIndex === index; return <button className={`${active ? "active" : ""}${playbackState(active)}`} aria-current={active ? "true" : undefined} aria-label={`${active && loading ? "Loading" : active && playing ? "Pause" : "Play"} ${item.title}`} onClick={() => active ? toggle() : selectTrack(itemIndex)} key={`${item.release?.id || item.releaseId}-${item.id}`}><span className="mobile-player__queue-control">{active && loading ? <LoaderCircle className="audio-loading-spinner" /> : active && playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</span><div><strong>{item.title}</strong><small>{item.artistName || item.artist}</small></div></button>; })}</aside>}
          </div>
          {error && <div className="mobile-player__error" role="alert"><span>{error}</span><button onClick={retry}><RotateCcw /> Retry</button>{hasNext && <button onClick={next}>Next</button>}</div>}
          {loading && <span className="sr-only" role="status" aria-live="polite">Loading audio</span>}
        </section>
      ) : isMobile ? (
        <section ref={playerRef} className={`mobile-player${playing ? " is-playing" : " is-paused"}`} aria-label="Music player" onPointerDown={gestureStart} onPointerMove={gestureMove} onPointerUp={gestureEnd} onPointerCancel={gestureCancel}>
          <button type="button" className="mobile-player__expand-cue" onClick={openFromClick} aria-label="Expand Now Playing"><ChevronUp /></button>
          <div className="mobile-player__toprow"><button type="button" className="mobile-player__identity" onClick={openFromClick} aria-label="Open Now Playing"><MusicArtwork release={track.release || { color: "art-glass", title: track.releaseTitle || "Release", artist: track.artistName || track.artist }} size="mini" /><span><strong ref={compactTitleRef} className={titleOverflowing ? `is-marquee${playing ? " is-running" : ""}` : ""} title={track.title}><span><i>{track.title}</i>{titleOverflowing && <i aria-hidden="true">{track.title}</i>}</span></strong><small>{track.artistName || track.artist}</small></span></button><div className="mobile-player__controls mobile-player__controls--compact"><button onClick={previous} disabled={!hasPrevious} aria-label="Previous track"><SkipBack /></button><button className="mobile-player__play" onClick={toggle} disabled={loading && !sourceReady} aria-label={loading ? "Loading audio" : playing ? "Pause" : "Play"}>{transportIcon}</button><button onClick={next} disabled={!hasNext} aria-label="Next track"><SkipForward /></button></div></div>
          <label className="mobile-player__seek"><span>{formatTime(currentTime)}</span><input aria-label="Playback position" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(event.target.value)} /><span>{formatTime(duration)}</span></label>
          {error && <div className="mobile-player__error" role="alert"><span>{error}</span><button onClick={retry}><RotateCcw /> Retry</button>{hasNext && <button onClick={next}>Next</button>}</div>}
        </section>
      ) : (
        <section className={`real-player${playing ? " is-playing" : " is-paused"}`} aria-label="Music player">
          <button type="button" className="real-player__expand-cue" onClick={openFromClick} aria-label="Expand Now Playing"><ChevronUp /></button>
          <button type="button" className="real-player__track" onClick={openFromClick} aria-label="Open Now Playing"><MusicArtwork release={track.release || { color: "art-glass", title: track.releaseTitle || "Release", artist: track.artistName || track.artist }} size="mini" /><div><strong ref={compactTitleRef} className={titleOverflowing ? `is-marquee${playing ? " is-running" : ""}` : ""} title={track.title}><span><i>{track.title}</i>{titleOverflowing && <i aria-hidden="true">{track.title}</i>}</span></strong><span>{track.artistName || track.artist}</span>{track.access === "private-preview" && <small>Private preview · only you</small>}</div></button>
          <div className="real-player__center"><div><button onClick={previous} disabled={!hasPrevious} aria-label="Previous track"><SkipBack /></button><button className="real-play" onClick={toggle} disabled={loading && !sourceReady} aria-label={loading ? "Loading audio" : playing ? "Pause" : "Play"}>{transportIcon}</button><button onClick={next} disabled={!hasNext} aria-label="Next track"><SkipForward /></button></div><label className="real-player__progress"><span>{formatTime(currentTime)}</span><span className="sr-only">Playback position</span><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(event.target.value)} /><span>{formatTime(duration)}</span></label>{loading && <span className="sr-only" role="status" aria-live="polite">Loading audio</span>}</div>
          <div className="real-player__tools"><AddToPlaylistButton track={track} /><button onClick={toggleMute} aria-label={volume ? "Mute" : "Unmute"}>{volume ? <Volume2 /> : <VolumeX />}</button><input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(event.target.value)} />{queue.length > 1 && <button onClick={() => setQueueOpen(!queueOpen)} aria-label="Toggle queue"><ListMusic /></button>}<button onClick={close} aria-label="Close player"><X /></button></div>
          {error && <div className="real-player__error" role="alert"><span>{error}</span><button onClick={retry}><RotateCcw /> Retry</button>{hasNext && <button onClick={next}>Next track</button>}</div>}
          {queueOpen && queue.length > 1 && <aside className="real-queue" aria-label="Playback queue"><header><strong>Queue</strong><button onClick={() => setQueueOpen(false)} aria-label="Close queue"><X /></button></header>{queue.map((item, itemIndex) => { const active = itemIndex === index; return <div className={`real-queue__item${active ? " active" : ""}${playbackState(active)}`} key={`${item.release?.id || item.releaseId}-${item.id}`}><button aria-current={active ? "true" : undefined} aria-label={`${active && loading ? "Loading" : active && playing ? "Pause" : "Play"} ${item.title}`} onClick={() => active ? toggle() : selectTrack(itemIndex)}><span className="real-queue__control">{active && loading ? <LoaderCircle className="audio-loading-spinner" /> : active && playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</span><div><strong>{item.title}</strong><small>{item.artistName || item.artist}</small></div></button><AddToPlaylistButton track={item} /></div>; })}</aside>}
        </section>
      ))}
    </AudioContext.Provider>
  );
}

export const useAudio = () => useContext(AudioContext);
