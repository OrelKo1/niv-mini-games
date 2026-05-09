"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { NIV_MANIFEST } from "@/lib/niv-manifest";
import type { NivAsset } from "@/lib/niv-types";

const REMARKS = [
  "Niv has noticed your behavior.",
  "Niv would like a word.",
  "Niv is unimpressed but supportive.",
  "Niv wonders if you've eaten.",
  "Niv thinks you should call your mother.",
  "Niv approves of this session.",
  "Niv is taking notes.",
  "Niv has a small note for you. The note is: 'k'.",
  "Niv has been watching. He is fine with what he saw.",
  "Niv does not normally do this but: nice.",
  "Niv has prepared a 14-point critique. He won't share it.",
  "Niv saw what you did at minute 4. No further comment.",
];

const PROBABILITY = 0.18;

export function NivWantsAWord() {
  const [showing, setShowing] = useState<{
    asset: NivAsset;
    remark: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Math.random() > PROBABILITY) return;
    const t = window.setTimeout(() => {
      const candidates = NIV_MANIFEST.assets as NivAsset[];
      if (candidates.length === 0) return;
      const asset = candidates[Math.floor(Math.random() * candidates.length)];
      const remark = REMARKS[Math.floor(Math.random() * REMARKS.length)];
      setShowing({ asset, remark });
    }, 8000 + Math.random() * 12000);
    return () => window.clearTimeout(t);
  }, []);

  if (!showing) return null;

  return (
    <button
      onClick={() => setShowing(null)}
      className="fixed inset-0 z-50 bg-arcade-black/95 flex flex-col items-center justify-center p-6 gap-3"
    >
      <div className="text-arcade-yellow text-[9px] animate-flash">
        ★ NIV WANTS A WORD ★
      </div>
      <Image
        src={showing.asset.paths.portrait720}
        alt=""
        width={320}
        height={320}
        className="border-4 border-arcade-yellow max-w-full h-auto"
      />
      <p className="text-[10px] text-center max-w-md leading-snug">
        &ldquo;{showing.remark}&rdquo;
      </p>
      <span className="text-[8px] text-arcade-fg/40">tap to acknowledge</span>
    </button>
  );
}
