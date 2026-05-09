"use client";
import { useMemo } from "react";

const NIV_TAUNTS = [
  "GAME OVER. NIV LAUGHED.",
  "NIV IS LAUGHING AT YOU. SPECIFICALLY.",
  "L. NIV WROTE THAT L PERSONALLY.",
  "NIV CHECKED HIS WATCH. STILL LOSING.",
  "NIV RECEIVED A NOTIFICATION ABOUT YOUR SCORE. IT WAS ALSO A LOSS.",
  "NIV WOULD'VE DONE BETTER. NIV IS UNAVAILABLE.",
  "RIP. NIV PRESENT FOR FUNERAL.",
  "NIV SAYS: 'TRY AGAIN, BUT WORSE.'",
  "NIV HAS BEEN INFORMED.",
  "GAME OVER. SOMEWHERE, NIV SMIRKS.",
];

const NIV_VICTORY = [
  "NEW HIGH SCORE. NIV IS ASTONISHED. HE EVEN PUT DOWN HIS PHONE.",
  "NEW HIGH SCORE. NIV: 'OKAY THAT'S ACTUALLY GOOD.'",
  "RECORD BROKEN. NIV: 'WAS NOT EXPECTING THAT.'",
  "NIV NODS APPROVINGLY. HIGH SCORE UNLOCKED.",
  "NIV HAS UPDATED YOUR PROFILE. STATUS: COMPETENT.",
];

export function GameOver({
  score,
  isHighScore,
  onRestart,
  onHome,
}: {
  score: number;
  isHighScore: boolean;
  onRestart: () => void;
  onHome?: () => void;
}) {
  const message = useMemo(() => {
    const pool = isHighScore ? NIV_VICTORY : NIV_TAUNTS;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [isHighScore]);

  return (
    <div className="absolute inset-0 z-30 bg-arcade-black/90 flex flex-col items-center justify-center p-6 text-center gap-4">
      <h2
        className={`text-lg ${
          isHighScore ? "text-arcade-yellow" : "text-arcade-red"
        } animate-flash`}
      >
        {isHighScore ? "★ NEW HIGH SCORE ★" : "GAME OVER"}
      </h2>
      <p className="text-3xl tabular-nums">{score}</p>
      <p className="text-[9px] leading-snug text-arcade-fg/80 max-w-xs">
        {message}
      </p>
      <div className="flex gap-3 mt-2">
        <button
          onClick={onRestart}
          className="border-2 border-arcade-yellow px-4 py-2 text-[10px] hover:bg-arcade-yellow hover:text-arcade-black"
        >
          AGAIN
        </button>
        {onHome && (
          <button
            onClick={onHome}
            className="border-2 border-arcade-fg/40 px-4 py-2 text-[10px] hover:border-arcade-fg"
          >
            HOME
          </button>
        )}
      </div>
    </div>
  );
}
