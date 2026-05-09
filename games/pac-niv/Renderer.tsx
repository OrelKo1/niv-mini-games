"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameFrame } from "@/components/arcade/GameFrame";
import { TouchPad, type Dir as TouchDir } from "@/components/arcade/TouchPad";
import { GameOver } from "@/components/arcade/GameOver";
import { NivVideoSplash } from "@/components/arcade/NivVideoSplash";
import { useNivStore } from "@/lib/store/use-niv-store";
import { useAchievements } from "@/lib/achievements/use-achievements";
import { NIV_MANIFEST } from "@/lib/niv-manifest";
import { makeFixedStepLoop } from "@/lib/game/loop";
import {
  createInitialState,
  setPlayerDir,
  step,
  STEP_MS,
} from "./engine";
import { MAZE_W, MAZE_H } from "./maze";
import type { Dir, PacNivState } from "./types";

const CELL = 14;

const GHOST_COLORS: Record<string, string> = {
  cop: "#118ab2", // arcade-blue
  ex: "#ff5d8f", // arcade-pink
  landlord: "#22d3ee", // cyan
  mom: "#ffd166", // arcade-yellow
};

const GHOST_LETTERS: Record<string, string> = {
  cop: "C",
  ex: "X",
  landlord: "L",
  mom: "M",
};

export function PacNivRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<PacNivState>(createInitialState());
  const avatarRef = useRef<HTMLImageElement | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [showVideo, setShowVideo] = useState<null | "highscore" | "gameover">(null);
  const [pulse, setPulse] = useState(0);

  const recordScore = useNivStore((s) => s.recordScore);
  const highScore = useNivStore((s) => s.highScores["pac-niv"] ?? 0);
  const { fire } = useAchievements();

  // Pick a pac-niv asset for the avatar.
  const avatarSrc = useMemo(() => {
    const a = NIV_MANIFEST.assets.find((x) => x.game === "pac-niv");
    return a?.paths.avatar64 ?? null;
  }, []);

  // Load avatar once.
  useEffect(() => {
    if (!avatarSrc) return;
    const img = new Image();
    img.src = avatarSrc;
    img.onload = () => {
      avatarRef.current = img;
    };
    img.onerror = () => {
      avatarRef.current = null;
    };
  }, [avatarSrc]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    const w = s.width * CELL;
    const h = s.height * CELL;
    // background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);

    // tiles: walls + pellets
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const t = s.tiles[y][x];
        const px = x * CELL;
        const py = y * CELL;
        if (t === "wall") {
          ctx.fillStyle = "#1f3a8a"; // arcade wall blue
          ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        } else if (t === "door") {
          ctx.fillStyle = "#ff5d8f";
          ctx.fillRect(px, py + CELL / 2 - 1, CELL, 2);
        } else if (t === "pellet") {
          ctx.fillStyle = "#ffd166";
          ctx.beginPath();
          ctx.arc(px + CELL / 2, py + CELL / 2, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (t === "power") {
          const r = 4.5 + Math.sin(pulse) * 1.2;
          ctx.fillStyle = "#f4f4f4";
          ctx.beginPath();
          ctx.arc(px + CELL / 2, py + CELL / 2, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // player (sprite drawn at 1.4× cell so Niv overlaps neighbors slightly,
    // matching the chunkier feel of the original Pac-Man sprite)
    const px = s.player.x * CELL;
    const py = s.player.y * CELL;
    const SPRITE_OVER = 1.4;
    const sw = CELL * SPRITE_OVER;
    const sh = CELL * SPRITE_OVER;
    if (avatarRef.current) {
      ctx.drawImage(
        avatarRef.current,
        px - (sw - CELL) / 2,
        py - (sh - CELL) / 2,
        sw,
        sh
      );
    } else {
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(px + CELL / 2, py + CELL / 2, sw / 2 - 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // ghosts
    for (const g of s.ghosts) {
      const gx = g.x * CELL;
      const gy = g.y * CELL;
      let color = GHOST_COLORS[g.kind] ?? "#888";
      if (g.mode === "scared") {
        color = Math.floor(pulse * 5) % 2 === 0 ? "#1f3a8a" : "#f4f4f4";
      } else if (g.mode === "eaten") {
        color = "#444";
      }
      ctx.fillStyle = color;
      ctx.fillRect(gx + 1, gy + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = "#0a0a0a";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        GHOST_LETTERS[g.kind] ?? "?",
        gx + CELL / 2,
        gy + CELL / 2 + 1
      );
    }
  }, [pulse]);

  // Game loop.
  useEffect(() => {
    const loop = makeFixedStepLoop({
      stepMs: STEP_MS,
      step: () => {
        const s = stateRef.current;
        if (s.gameOver) return;
        const r = step(s, STEP_MS);
        for (const m of r.milestones) fire(m);
        // Cumulative joints across runs (best-effort): fire on 1000 cumulative
        // by reading the store. Simplification: also fired on 100 in-run.
        if (r.died) {
          // (death captions fire via 'pacniv:death:firstghost' inside engine)
        }
        if (s.score !== score) setScore(s.score);
        if (s.lives !== lives) setLives(s.lives);
        if (s.gameOver) {
          const isHi = recordScore("pac-niv", s.score);
          setGameOver(true);
          setShowVideo(isHi ? "highscore" : "gameover");
        }
      },
      render: () => {
        setPulse((p) => p + 0.15);
        draw();
      },
    });
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      const map: Record<string, Dir> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };
      const dir = map[e.key];
      if (dir) {
        setPlayerDir(s, dir);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSwipe = useCallback((d: TouchDir) => {
    setPlayerDir(stateRef.current, d);
  }, []);

  const restart = useCallback(() => {
    stateRef.current = createInitialState();
    setScore(0);
    setLives(3);
    setGameOver(false);
    setShowVideo(null);
  }, []);

  const goHome = useCallback(() => {
    if (typeof window !== "undefined") window.location.href = "/";
  }, []);

  return (
    <GameFrame title="PAC-NIV" score={score} highScore={highScore}>
      <div className="absolute inset-0 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-2">
          <div
            className="relative"
            style={{
              width: "min(95vw, 78dvh)",
              aspectRatio: `${MAZE_W} / ${MAZE_H}`,
            }}
          >
            <canvas
              ref={canvasRef}
              width={MAZE_W * CELL}
              height={MAZE_H * CELL}
              className="w-full h-full image-pixelated"
              style={{ imageRendering: "pixelated" }}
            />
            <TouchPad onSwipe={handleSwipe} />
          </div>
        </div>
        <div className="absolute top-2 left-2 text-[8px] text-arcade-yellow tabular-nums z-10">
          LIVES {lives} · LV {stateRef.current.level}
        </div>
        {showVideo && (
          <NivVideoSplash
            role={showVideo}
            onDone={() => setShowVideo(null)}
          />
        )}
        {gameOver && !showVideo && (
          <GameOver
            score={score}
            isHighScore={score > highScore && score > 0}
            onRestart={restart}
            onHome={goHome}
          />
        )}
      </div>
    </GameFrame>
  );
}
