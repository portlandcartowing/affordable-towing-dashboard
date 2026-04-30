"use client";

import { useEffect, useRef, useState } from "react";

function formatTime(sec: number) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => {
      if (!seeking) setCurrent(el.currentTime);
    };
    const onMeta = () => {
      setDuration(el.duration || 0);
      setReady(true);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [seeking]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play();
    else el.pause();
  };

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setCurrent(v);
    const el = audioRef.current;
    if (el) el.currentTime = v;
  };

  const endSeek = () => setSeeking(false);

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 bg-white rounded-lg ring-1 ring-slate-200 px-3 py-2 max-w-md">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        disabled={!ready}
        className="shrink-0 w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4l14 8-14 8V4z" />
          </svg>
        )}
      </button>

      <div className="flex-1 flex items-center gap-2">
        <span className="text-[11px] text-slate-500 tabular-nums w-9 text-right">{formatTime(current)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={handleScrubChange}
          onMouseDown={() => setSeeking(true)}
          onTouchStart={() => setSeeking(true)}
          onMouseUp={endSeek}
          onTouchEnd={endSeek}
          onKeyUp={endSeek}
          disabled={!ready}
          className="flex-1 h-1.5 appearance-none cursor-pointer rounded-full bg-slate-200 disabled:opacity-50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-0"
          style={{
            background: `linear-gradient(to right, #2563eb 0%, #2563eb ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`,
          }}
        />
        <span className="text-[11px] text-slate-500 tabular-nums w-9">{formatTime(duration)}</span>
      </div>
    </div>
  );
}
