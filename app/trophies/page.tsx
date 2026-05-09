"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { NIV_MANIFEST } from "@/lib/niv-manifest";
import { useNivStore } from "@/lib/store/use-niv-store";
import type { NivAsset, UnlockTier } from "@/lib/niv-types";
import { clsx } from "clsx";

const TIER_ORDER: UnlockTier[] = ["platinum", "gold", "silver", "bronze"];
const TIER_BORDER: Record<UnlockTier, string> = {
  bronze: "border-amber-700",
  silver: "border-slate-300",
  gold: "border-arcade-yellow",
  platinum: "border-arcade-purple",
};
const TIER_LABEL: Record<UnlockTier, string> = {
  bronze: "text-amber-500",
  silver: "text-slate-300",
  gold: "text-arcade-yellow",
  platinum: "text-arcade-purple",
};

export default function Trophies() {
  const unlocks = useNivStore((s) => s.unlocks);
  const set = new Set(unlocks);
  const total = NIV_MANIFEST.assets.length;
  const owned = set.size;
  const [focused, setFocused] = useState<NivAsset | null>(null);
  const [filter, setFilter] = useState<"all" | "owned" | "locked">("all");

  const sorted = [...(NIV_MANIFEST.assets as NivAsset[])].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
  );

  const visible = sorted.filter((a) => {
    if (filter === "owned") return set.has(a.slug);
    if (filter === "locked") return !set.has(a.slug);
    return true;
  });

  const platinumOwned = sorted.filter((a) => a.tier === "platinum" && set.has(a.slug)).length;
  const platinumTotal = sorted.filter((a) => a.tier === "platinum").length;

  return (
    <div className="min-h-dvh px-4 py-5">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="text-arcade-yellow text-xs hover:text-arcade-pink">
          ◄ HOME
        </Link>
        <h1 className="text-sm tracking-widest">TROPHY ROOM</h1>
        <div className="text-[11px] tabular-nums text-arcade-fg/70 min-w-12 text-right">
          {owned}/{total}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 text-[10px]">
        <span className="text-arcade-purple">★ PLATINUM {platinumOwned}/{platinumTotal}</span>
        <div className="flex gap-1">
          {(["all", "owned", "locked"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "px-2.5 py-1.5 border-2",
                filter === f
                  ? "border-arcade-yellow text-arcade-yellow"
                  : "border-arcade-fg/30 text-arcade-fg/60"
              )}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {visible.map((a) => {
          const has = set.has(a.slug);
          return (
            <li key={a.slug}>
              <button
                onClick={() => has && setFocused(a)}
                className={clsx(
                  "relative border-2 p-2 aspect-square w-full flex flex-col items-center justify-center gap-1.5",
                  TIER_BORDER[a.tier],
                  !has && "opacity-25 grayscale cursor-not-allowed"
                )}
                disabled={!has}
              >
                <Image
                  src={a.paths.avatar128}
                  alt=""
                  width={104}
                  height={104}
                  className="image-pixelated"
                />
                <span className={clsx("text-[9px]", TIER_LABEL[a.tier])}>
                  {a.tier.toUpperCase()}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {focused && (
        <button
          onClick={() => setFocused(null)}
          className="fixed inset-0 z-50 bg-arcade-black/95 flex flex-col items-center justify-center p-6 gap-3"
        >
          <Image
            src={focused.paths.portrait720}
            alt=""
            width={400}
            height={400}
            className={clsx("max-w-full h-auto border-4", TIER_BORDER[focused.tier])}
          />
          <div className={clsx("text-[9px]", TIER_LABEL[focused.tier])}>
            ★ {focused.tier.toUpperCase()} • {focused.game.toUpperCase()}
          </div>
          <p className="text-[10px] text-center max-w-md leading-snug">{focused.caption}</p>
          <span className="text-[8px] text-arcade-fg/40 mt-2">tap anywhere to close</span>
        </button>
      )}
    </div>
  );
}
