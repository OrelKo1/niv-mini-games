"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

const GREETINGS = [
  "READY 1UP NIV",
  "INSERT NIV TO CONTINUE",
  "NIV ONLINE — STATUS: BLAZED",
  "NIV.EXE LOADED SUCCESSFULLY",
  "NIV STANDS BY",
  "NIV IS WAITING. NIV IS PATIENT. NIV IS HUNGRY.",
];

export function LobbyMascot({ avatars }: { avatars: string[] }) {
  const [idx, setIdx] = useState(0);
  const [greet, setGreet] = useState(GREETINGS[0]);

  useEffect(() => {
    if (avatars.length === 0) return;
    setIdx(Math.floor(Math.random() * avatars.length));
    setGreet(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % avatars.length);
    }, 2200);
    return () => window.clearInterval(t);
  }, [avatars.length]);

  if (avatars.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-1 mt-2">
      <div className="relative">
        <Image
          src={avatars[idx]}
          alt=""
          width={96}
          height={96}
          className="image-pixelated border-4 border-arcade-yellow"
          priority
          unoptimized
        />
        <span className="absolute -bottom-2 -right-2 bg-arcade-red text-arcade-fg text-[7px] px-1 py-0.5">
          NIV
        </span>
      </div>
      <p className="text-[8px] text-arcade-green mt-3 tracking-wider">{greet}</p>
    </div>
  );
}
