"use client";
import { useEffect, useRef, useState } from "react";
import { NIV_VIDEOS } from "@/lib/niv-videos";

export function AttractMode() {
  const [showing, setShowing] = useState(false);
  const idleTimer = useRef<number | null>(null);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reset = () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      setShowing(false);
      idleTimer.current = window.setTimeout(() => setShowing(true), 25000);
    };
    reset();
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset));
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, []);

  if (!showing || NIV_VIDEOS.videos.length === 0) return null;

  const idleVideos = NIV_VIDEOS.videos.filter((v) => v.role === "idle");
  const pool = idleVideos.length > 0 ? idleVideos : NIV_VIDEOS.videos;
  const video = pool[Math.floor(Math.random() * pool.length)];

  return (
    <button
      onClick={() => setShowing(false)}
      className="fixed inset-0 z-30 bg-arcade-black/90 flex flex-col items-center justify-center gap-3 cursor-pointer"
      aria-label="dismiss attract mode"
    >
      <video
        ref={ref}
        src={video.src}
        autoPlay
        playsInline
        muted
        loop
        className="max-h-[60vh] max-w-full border-4 border-arcade-purple"
      />
      <p className="text-[10px] text-arcade-purple animate-flash">
        {video.caption}
      </p>
      <p className="text-[8px] text-arcade-fg/40">tap to dismiss</p>
    </button>
  );
}
