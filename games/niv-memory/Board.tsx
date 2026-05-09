"use client";
import { useMemo } from "react";
import { NIV_MANIFEST } from "@/lib/niv-manifest";
import { BOARD_BY_DIFFICULTY, type MemoryState } from "./types";

export function Board({
  state,
  onFlip,
  disabled,
}: {
  state: MemoryState;
  onFlip: (id: number) => void;
  disabled: boolean;
}) {
  const { cols } = BOARD_BY_DIFFICULTY[state.difficulty];

  // slug -> avatar128 url (cached)
  const slugToImg = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of NIV_MANIFEST.assets) {
      m.set(a.slug, a.paths.avatar128);
    }
    return m;
  }, []);

  return (
    <div
      className="grid w-full max-w-[480px] mx-auto p-2"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: state.difficulty === "hard" ? "4px" : "6px",
      }}
    >
      {state.cards.map((card) => {
        const showFront = card.flipped || card.matched;
        const imgSrc = slugToImg.get(card.slug);
        return (
          <button
            key={card.id}
            type="button"
            disabled={disabled || card.matched || card.flipped}
            onClick={() => onFlip(card.id)}
            className="aspect-square relative select-none"
            style={{ perspective: "600px" }}
            aria-label={
              showFront ? `Card ${card.slug}` : "Face-down card"
            }
          >
            <div
              className="absolute inset-0 transition-transform duration-300"
              style={{
                transformStyle: "preserve-3d",
                transform: showFront ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Back face */}
              <div
                className="absolute inset-0 flex items-center justify-center bg-arcade-black border-2 border-arcade-yellow rounded-sm"
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  boxShadow:
                    "inset 0 0 0 2px var(--color-arcade-red), inset 0 0 0 4px var(--color-arcade-black)",
                }}
              >
                <span
                  className="font-pixel text-arcade-yellow"
                  style={{
                    fontSize: state.difficulty === "hard" ? "14px" : "22px",
                    textShadow: "0 0 4px var(--color-arcade-red)",
                  }}
                >
                  N
                </span>
              </div>
              {/* Front face */}
              <div
                className={`absolute inset-0 flex items-center justify-center rounded-sm border-2 ${
                  card.matched
                    ? "border-arcade-green bg-arcade-green/15"
                    : "border-arcade-yellow bg-arcade-black"
                }`}
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                {imgSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgSrc}
                    alt={card.slug}
                    className="w-full h-full object-cover image-pixelated"
                    draggable={false}
                  />
                ) : (
                  <span className="text-arcade-yellow text-[10px]">
                    {card.slug.slice(0, 4)}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
