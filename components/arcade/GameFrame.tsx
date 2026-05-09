"use client";
import Link from "next/link";
import { useAchievements } from "@/lib/achievements/use-achievements";
import { UnlockToast } from "./UnlockToast";
import type { ReactNode } from "react";

export function GameFrame({
  title,
  score,
  highScore,
  children,
  footer,
  rightSlot,
}: {
  title: string;
  score?: number;
  highScore?: number;
  children: ReactNode;
  footer?: ReactNode;
  rightSlot?: ReactNode;
}) {
  const { currentToast, dismissToast } = useAchievements();
  return (
    <div className="min-h-dvh flex flex-col no-scroll">
      <header className="flex items-center justify-between px-3 py-3 border-b-2 border-arcade-fg/30 gap-2">
        <Link
          href="/"
          className="text-arcade-yellow text-[11px] hover:text-arcade-pink shrink-0"
        >
          ◄ HOME
        </Link>
        <h1 className="text-sm truncate text-center flex-1">{title}</h1>
        <div className="text-[11px] text-arcade-fg/70 tabular-nums shrink-0 min-w-20 text-right">
          {rightSlot ??
            (typeof score === "number" || typeof highScore === "number" ? (
              <>
                {typeof score === "number" && <div>{score}</div>}
                {typeof highScore === "number" && (
                  <div className="text-arcade-yellow/70">HI {highScore}</div>
                )}
              </>
            ) : null)}
        </div>
      </header>
      <main className="flex-1 flex items-stretch justify-center relative overflow-hidden">
        {children}
      </main>
      {footer && (
        <footer className="border-t-2 border-arcade-fg/30 p-2">{footer}</footer>
      )}
      {currentToast && (
        <UnlockToast asset={currentToast} onDismiss={dismissToast} />
      )}
    </div>
  );
}
