"use client";
import Image from "next/image";
import type { NivAsset } from "@/lib/niv-types";
import { clsx } from "clsx";

const TIER_BORDER: Record<NivAsset["tier"], string> = {
  bronze: "border-amber-700",
  silver: "border-slate-300",
  gold: "border-arcade-yellow",
  platinum: "border-arcade-purple",
};

const TIER_LABEL_COLOR: Record<NivAsset["tier"], string> = {
  bronze: "text-amber-500",
  silver: "text-slate-200",
  gold: "text-arcade-yellow",
  platinum: "text-arcade-purple",
};

export function UnlockToast({
  asset,
  onDismiss,
}: {
  asset: NivAsset;
  onDismiss: () => void;
}) {
  return (
    <button
      onClick={onDismiss}
      className={clsx(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,380px)]",
        "bg-arcade-black/95 border-4 p-3 flex gap-3 items-center text-left animate-toast-in shadow-2xl",
        TIER_BORDER[asset.tier]
      )}
    >
      <Image
        src={asset.paths.avatar128}
        alt=""
        width={64}
        height={64}
        className="shrink-0 image-pixelated"
      />
      <div className="flex flex-col text-[10px] leading-tight flex-1 min-w-0">
        <span className={clsx("text-[8px]", TIER_LABEL_COLOR[asset.tier])}>
          ★ UNLOCK • {asset.tier.toUpperCase()}
        </span>
        <span className="mt-1 text-white break-words">{asset.caption}</span>
      </div>
    </button>
  );
}
