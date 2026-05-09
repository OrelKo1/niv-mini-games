"use client";
import Image from "next/image";
import { clsx } from "clsx";
import type { Hole } from "./types";

export interface HolesProps {
  holes: Hole[];
  /** Hole ids that should flash red (recent miss-tap). */
  flashing: Set<number>;
  /** Hole ids that should flash green (recent hit). */
  thumping: Set<number>;
  onWhack: (holeIdx: number) => void;
  disabled?: boolean;
}

const PLACEHOLDER_HEAD = "/niv/placeholder.webp";

export function Holes({
  holes,
  flashing,
  thumping,
  onWhack,
  disabled,
}: HolesProps) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full max-w-sm aspect-square mx-auto select-none">
      {holes.map((h) => {
        const flashed = flashing.has(h.id);
        const thumped = thumping.has(h.id);
        return (
          <button
            key={h.id}
            type="button"
            disabled={disabled}
            onPointerDown={(e) => {
              e.preventDefault();
              if (!disabled) onWhack(h.id);
            }}
            className={clsx(
              "relative aspect-square rounded-full border-4 overflow-visible",
              "bg-arcade-black/80 transition-colors",
              flashed
                ? "border-arcade-red animate-whack-flash-red"
                : thumped
                ? "border-arcade-green animate-whack-flash-green"
                : "border-arcade-fg/40",
              !disabled && "active:translate-y-[1px]"
            )}
            aria-label={`hole-${h.id}`}
          >
            {/* Inner well shadow */}
            <div className="absolute inset-2 rounded-full bg-arcade-black shadow-[inset_0_8px_12px_rgba(0,0,0,0.6)]" />

            {/* Head */}
            {h.occupied && (
              <div className="absolute inset-0 flex items-end justify-center pb-1 pointer-events-none">
                <div className="relative w-[78%] aspect-square animate-whack-pop">
                  <Image
                    src={
                      h.asset?.paths.avatar128 ??
                      h.asset?.paths.avatar64 ??
                      PLACEHOLDER_HEAD
                    }
                    alt=""
                    fill
                    sizes="80px"
                    className="image-pixelated rounded-full object-cover"
                    priority={false}
                  />
                  {h.thoughtBubble && (
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-arcade-fg text-arcade-black text-[7px] rounded-md whitespace-nowrap border border-arcade-black shadow-md">
                      {h.thoughtBubble}
                      <span
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0"
                        style={{
                          borderLeft: "3px solid transparent",
                          borderRight: "3px solid transparent",
                          borderTop: "4px solid var(--color-arcade-fg)",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
