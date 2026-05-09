"use client";
import { useEffect } from "react";
import { useNivStore } from "@/lib/store/use-niv-store";

const SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

export function KonamiListener() {
  const setKonami = useNivStore((s) => s.setKonami);
  const konami = useNivStore((s) => s.konami);

  useEffect(() => {
    if (konami) return;
    let i = 0;
    const onKey = (e: KeyboardEvent) => {
      const expected = SEQUENCE[i];
      if (e.key.toLowerCase() === expected.toLowerCase()) {
        i++;
        if (i === SEQUENCE.length) {
          setKonami(true);
          if (typeof window !== "undefined") {
            window.alert("✷ KONAMI ACCEPTED ✷\n\nNiv has noticed you. He is impressed.\n\n(Niv-Cam unlocked in trophy room.)");
          }
        }
      } else {
        i = e.key === SEQUENCE[0] ? 1 : 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setKonami, konami]);

  return null;
}
