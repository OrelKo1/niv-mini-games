"use client";
import type { Dir } from "./TouchPad";
import { clsx } from "clsx";

export function DPad({
  onDir,
  className,
}: {
  onDir: (d: Dir) => void;
  className?: string;
}) {
  const Btn = ({ dir, char, cls }: { dir: Dir; char: string; cls: string }) => (
    <button
      type="button"
      aria-label={dir}
      onPointerDown={(e) => {
        e.preventDefault();
        onDir(dir);
      }}
      className={clsx(
        "absolute w-16 h-16 border-2 border-arcade-fg/60 bg-arcade-black/70",
        "flex items-center justify-center text-arcade-yellow text-xl",
        "active:bg-arcade-yellow active:text-arcade-black active:border-arcade-yellow",
        "select-none touch-none",
        cls
      )}
    >
      {char}
    </button>
  );
  return (
    <div className={clsx("relative w-48 h-48 mx-auto select-none touch-none", className)}>
      <Btn dir="up" char="▲" cls="left-1/2 -translate-x-1/2 top-0" />
      <Btn dir="down" char="▼" cls="left-1/2 -translate-x-1/2 bottom-0" />
      <Btn dir="left" char="◄" cls="left-0 top-1/2 -translate-y-1/2" />
      <Btn dir="right" char="►" cls="right-0 top-1/2 -translate-y-1/2" />
    </div>
  );
}
