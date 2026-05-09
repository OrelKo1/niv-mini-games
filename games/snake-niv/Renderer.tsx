"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { TouchPad, type Dir as PadDir } from "@/components/arcade/TouchPad";
import { GameOver } from "@/components/arcade/GameOver";
import { NivVideoSplash } from "@/components/arcade/NivVideoSplash";
import { useAchievements } from "@/lib/achievements/use-achievements";
import { useNivStore } from "@/lib/store/use-niv-store";
import { NIV_MANIFEST } from "@/lib/niv-manifest";
import {
  applyInput,
  createInitialState,
  makeRng,
  step,
  tickRate,
} from "./engine";
import { GRID_SIZE, type SnakeState, type Dir } from "./types";

const HEAD_AVATAR = NIV_MANIFEST.assets[0]?.paths.avatar64 ?? null;

function seedFromTime() {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function Renderer({
  onScoreChange,
}: {
  onScoreChange?: (s: SnakeState) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SnakeState>(createInitialState(makeRng(seedFromTime())));
  const rngRef = useRef(makeRng(seedFromTime() + 1));
  const headImgRef = useRef<HTMLImageElement | null>(null);
  const headLoadedRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const firedRef = useRef<Set<string>>(new Set());
  const everEatenFalafelRef = useRef<boolean>(false);
  const everEatenNonFalafelRef = useRef<boolean>(false);
  const rafRef = useRef<number>(0);
  const accRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(NaN);

  const [status, setStatus] = useState<"playing" | "dead">("playing");
  const [score, setScore] = useState(0);
  const [splashRole, setSplashRole] = useState<null | "highscore" | "gameover">(
    null
  );
  const [splashDone, setSplashDone] = useState(false);
  const isHighScoreRef = useRef(false);

  const { fire } = useAchievements();
  const recordScore = useNivStore((s) => s.recordScore);

  // Preload head image
  useEffect(() => {
    if (!HEAD_AVATAR) return;
    const img = new Image();
    img.onload = () => {
      headLoadedRef.current = true;
    };
    img.src = HEAD_AVATAR;
    headImgRef.current = img;
  }, []);

  // Resize canvas
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      const side = Math.floor(Math.min(rect.width, rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = `${side}px`;
      canvas.style.height = `${side}px`;
      canvas.width = Math.floor(side * dpr);
      canvas.height = Math.floor(side * dpr);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const checkMilestones = useCallback(
    (prev: SnakeState, next: SnakeState) => {
      const fireOnce = (key: string) => {
        if (firedRef.current.has(key)) return;
        firedRef.current.add(key);
        fire(key);
      };

      const len = next.snake.length;
      const prevLen = prev.snake.length;
      for (const g of [5, 10, 25, 50, 100, 200]) {
        if (prevLen < g && len >= g) fireOnce(`snake:length:${g}`);
      }
      for (const g of [500, 1500, 3000]) {
        if (prev.score < g && next.score >= g) fireOnce(`snake:score:${g}`);
      }

      if (next.ateThisTick === "falafel") {
        everEatenFalafelRef.current = true;
        fireOnce("snake:falafel:1");
      } else if (next.ateThisTick === "hummus") {
        everEatenNonFalafelRef.current = true;
        fireOnce("snake:hummus:1");
      } else if (
        next.ateThisTick === "joint" ||
        next.ateThisTick === "golden"
      ) {
        everEatenNonFalafelRef.current = true;
      }

      if (next.recentJointTimes.length >= 10) fireOnce("snake:burst:10in30");

      const elapsed = performance.now() - startTimeRef.current;
      if (startTimeRef.current && elapsed >= 180_000)
        fireOnce("snake:time:180s");

      if (prevLen < 30 && len >= 30) {
        if (!everEatenFalafelRef.current) fireOnce("snake:nofalafel:30");
        if (everEatenFalafelRef.current && !everEatenNonFalafelRef.current)
          fireOnce("snake:allfalafel:30");
      }

      if (prev.status === "playing" && next.status === "dead") {
        fireOnce("snake:firstdeath");
        if (next.death?.reason === "self") fireOnce("snake:selfbite");
        if (
          next.death?.reason === "wall" &&
          (next.death.lengthAtDeath ?? 0) < 5
        )
          fireOnce("snake:wall:short");
      }
    },
    [fire]
  );

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const cell = W / GRID_SIZE;
    const gap = Math.max(1, Math.floor(cell * 0.08));

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(244,244,244,0.05)";
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(W, i * cell);
      ctx.stroke();
    }

    const s = stateRef.current;

    // food
    const f = s.food;
    const fx = f.x * cell;
    const fy = f.y * cell;
    if (f.type === "joint") {
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(fx + cell * 0.25, fy + cell * 0.4, cell * 0.5, cell * 0.2);
    } else if (f.type === "falafel") {
      ctx.fillStyle = "#a0522d";
      ctx.beginPath();
      ctx.arc(fx + cell / 2, fy + cell / 2, cell * 0.32, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.type === "hummus") {
      ctx.fillStyle = "#e8d8a0";
      ctx.fillRect(fx + cell * 0.2, fy + cell * 0.2, cell * 0.6, cell * 0.6);
    } else {
      // golden
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 150);
      ctx.strokeStyle = `rgba(255,209,102,${pulse.toFixed(3)})`;
      ctx.lineWidth = Math.max(2, cell * 0.12);
      ctx.strokeRect(
        fx + cell * 0.1,
        fy + cell * 0.1,
        cell * 0.8,
        cell * 0.8
      );
      if (headLoadedRef.current && headImgRef.current) {
        ctx.drawImage(
          headImgRef.current,
          fx + cell * 0.18,
          fy + cell * 0.18,
          cell * 0.64,
          cell * 0.64
        );
      } else {
        ctx.fillStyle = "#ffd166";
        ctx.fillRect(
          fx + cell * 0.3,
          fy + cell * 0.3,
          cell * 0.4,
          cell * 0.4
        );
      }
    }

    // body
    ctx.fillStyle = "#06d6a0";
    for (let i = 1; i < s.snake.length; i++) {
      const c = s.snake[i];
      ctx.fillRect(
        c.x * cell + gap,
        c.y * cell + gap,
        cell - gap * 2,
        cell - gap * 2
      );
    }

    // head
    const head = s.snake[0];
    const hx = head.x * cell;
    const hy = head.y * cell;
    if (headLoadedRef.current && headImgRef.current) {
      ctx.drawImage(
        headImgRef.current,
        hx + gap,
        hy + gap,
        cell - gap * 2,
        cell - gap * 2
      );
    } else {
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(hx + gap, hy + gap, cell - gap * 2, cell - gap * 2);
    }
  }, []);

  // Main RAF loop with adaptive step
  useEffect(() => {
    startTimeRef.current = performance.now();
    let alive = true;

    const tick = (now: number) => {
      if (!alive) return;
      if (Number.isNaN(lastTimeRef.current)) {
        lastTimeRef.current = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      accRef.current += now - lastTimeRef.current;
      lastTimeRef.current = now;

      const cur = stateRef.current;
      const stepMs = 1000 / tickRate(cur.score);

      let safety = 8;
      while (accRef.current >= stepMs && safety-- > 0) {
        const before = stateRef.current;
        if (before.status !== "playing") {
          accRef.current = 0;
          break;
        }
        const next = step(before, rngRef.current, now);
        stateRef.current = next;
        checkMilestones(before, next);
        if (next.score !== before.score) setScore(next.score);
        onScoreChange?.(next);
        if (next.status === "dead") {
          const isHi = recordScore("snake-niv", next.score);
          isHighScoreRef.current = isHi;
          if (isHi) setSplashRole("highscore");
          else if (Math.random() < 0.3) setSplashRole("gameover");
          else setSplashDone(true);
          setStatus("dead");
          accRef.current = 0;
          break;
        }
        accRef.current -= stepMs;
      }

      drawFrame();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = NaN;
      accRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard
  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
      W: "up",
      S: "down",
      A: "left",
      D: "right",
    };
    const onKey = (e: KeyboardEvent) => {
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      stateRef.current = applyInput(stateRef.current, d);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSwipe = useCallback((d: PadDir) => {
    stateRef.current = applyInput(stateRef.current, d);
  }, []);

  const handleRestart = useCallback(() => {
    firedRef.current.clear();
    everEatenFalafelRef.current = false;
    everEatenNonFalafelRef.current = false;
    rngRef.current = makeRng(seedFromTime());
    stateRef.current = createInitialState(makeRng(seedFromTime() + 7));
    startTimeRef.current = performance.now();
    accRef.current = 0;
    lastTimeRef.current = NaN;
    setScore(0);
    setStatus("playing");
    setSplashRole(null);
    setSplashDone(false);
    isHighScoreRef.current = false;
  }, []);

  const handleHome = useCallback(() => {
    if (typeof window !== "undefined") window.location.href = "/";
  }, []);

  const showGameOver = status === "dead" && (splashRole === null || splashDone);

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        ref={wrapRef}
        className="relative w-[min(100vmin,560px)] h-[min(100vmin,560px)] aspect-square"
      >
        <canvas
          ref={canvasRef}
          className="image-pixelated block bg-arcade-black"
        />
        <TouchPad onSwipe={handleSwipe} />
      </div>
      {splashRole && !splashDone && (
        <NivVideoSplash
          role={splashRole}
          onDone={() => setSplashDone(true)}
        />
      )}
      {showGameOver && (
        <GameOver
          score={score}
          isHighScore={isHighScoreRef.current}
          onRestart={handleRestart}
          onHome={handleHome}
        />
      )}
    </div>
  );
}
