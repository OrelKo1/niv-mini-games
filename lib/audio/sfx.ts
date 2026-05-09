"use client";
import { Howl } from "howler";

const cache = new Map<string, Howl>();

export function playSfx(name: string, opts: { volume?: number } = {}) {
  if (typeof window === "undefined") return;
  if (typeof document !== "undefined") {
    try {
      const raw = localStorage.getItem("nivtendo:v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.state?.settings?.sound === false) return;
      }
    } catch {}
  }
  let h = cache.get(name);
  if (!h) {
    h = new Howl({
      src: [`/sfx/${name}.mp3`, `/sfx/${name}.ogg`, `/sfx/${name}.wav`],
      volume: opts.volume ?? 0.5,
      preload: true,
      onloaderror: () => {},
    });
    cache.set(name, h);
  }
  h.play();
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    const raw = localStorage.getItem("nivtendo:v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.settings?.haptics === false) return;
    }
  } catch {}
  navigator.vibrate(pattern);
}
