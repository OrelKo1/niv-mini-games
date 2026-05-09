"use client";
import { useEffect, useRef, useState } from "react";

interface VideoEntry {
  slug: string;
  src: string;
  role: string;
  caption: string;
}

let cachedVideos: VideoEntry[] | null = null;

async function loadVideos(): Promise<VideoEntry[]> {
  if (cachedVideos) return cachedVideos;
  try {
    const mod = await import("@/lib/niv-videos");
    cachedVideos = (mod as { NIV_VIDEOS: { videos: VideoEntry[] } }).NIV_VIDEOS
      .videos;
  } catch {
    cachedVideos = [];
  }
  return cachedVideos;
}

export function NivVideoSplash({
  role,
  onDone,
}: {
  role: string;
  onDone?: () => void;
}) {
  const [video, setVideo] = useState<VideoEntry | null>(null);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let alive = true;
    loadVideos().then((vids) => {
      if (!alive) return;
      const matches = vids.filter((v) => v.role === role);
      const pool = matches.length > 0 ? matches : vids;
      if (pool.length === 0) {
        onDone?.();
        return;
      }
      setVideo(pool[Math.floor(Math.random() * pool.length)]);
    });
    return () => {
      alive = false;
    };
  }, [role, onDone]);

  if (!video) return null;

  return (
    <div className="absolute inset-0 z-40 bg-arcade-black/90 flex flex-col items-center justify-center p-4 gap-3">
      <video
        ref={ref}
        src={video.src}
        autoPlay
        playsInline
        muted
        onEnded={onDone}
        className="max-h-[60vh] max-w-full border-4 border-arcade-yellow"
      />
      <p className="text-[10px] text-arcade-yellow text-center max-w-xs leading-snug">
        {video.caption}
      </p>
      <button
        onClick={onDone}
        className="text-[8px] text-arcade-fg/50 hover:text-arcade-fg"
      >
        skip
      </button>
    </div>
  );
}
