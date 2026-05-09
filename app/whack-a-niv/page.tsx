"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameFrame } from "@/components/arcade/GameFrame";
import { GameOver } from "@/components/arcade/GameOver";
import { Holes } from "@/games/whack-a-niv/Holes";
import {
  createInitialState,
  defaultRng,
  startGame,
  step,
  whack,
} from "@/games/whack-a-niv/engine";
import { ROUND_MS, type WhackState } from "@/games/whack-a-niv/types";
import { pickFaceForGame } from "@/lib/niv/face-pool";
import { useNivStore } from "@/lib/store/use-niv-store";
import { useAchievements } from "@/lib/achievements/use-achievements";

const ROUNDS_KEY = "whack-a-niv:rounds" as const;

export default function WhackANivPage() {
  const [state, setState] = useState<WhackState>(() => createInitialState(0));
  const stateRef = useRef(state);
  stateRef.current = state;

  const pickAsset = useCallback(() => pickFaceForGame("whack-a-niv"), []);

  const [now, setNow] = useState<number>(() =>
    typeof performance !== "undefined" ? performance.now() : 0
  );
  const [flashing, setFlashing] = useState<Set<number>>(() => new Set());
  const [thumping, setThumping] = useState<Set<number>>(() => new Set());
  const [shake, setShake] = useState(false);

  const { fire } = useAchievements();
  const recordScore = useNivStore((s) => s.recordScore);
  const highScore = useNivStore((s) => s.highScores["whack-a-niv"] ?? 0);
  const roundsHigh = useNivStore(
    // The manifest GameId union doesn't include 'whack-a-niv:rounds'.
    // We piggy-back on highScores keyed by a string we treat as a counter.
    (s) =>
      (s.highScores as Record<string, number | undefined>)[ROUNDS_KEY] ?? 0
  );

  // -------- Combo milestone bookkeeping (one-shot per game) --------
  const firedRef = useRef<Set<string>>(new Set());

  const fireOnce = useCallback(
    (m: string) => {
      if (firedRef.current.has(m)) return;
      firedRef.current.add(m);
      fire(m);
    },
    [fire]
  );

  // -------- Start / restart --------
  const startedAtRef = useRef<number>(0);
  const start = useCallback(() => {
    const t =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    firedRef.current = new Set();
    startedAtRef.current = t;
    setState(startGame(t));
    setNow(t);
    setShake(false);
  }, []);

  // -------- Game loop (rAF) --------
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const t =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      setNow(t);
      const cur = stateRef.current;
      if (cur.status === "playing") {
        const next = step(cur, t, defaultRng, pickAsset);
        if (next !== cur) setState(next);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pickAsset]);

  // -------- End-of-game milestones --------
  const overFiredRef = useRef(false);
  useEffect(() => {
    if (state.status !== "over" || overFiredRef.current) return;
    overFiredRef.current = true;

    if (state.hits === 0) fireOnce("whack:zerogame");
    if (state.lastWhackWasHit) fireOnce("whack:finalhit");

    // hit thresholds (these may also be fired live but firing here is safe — fireOnce dedupes).
    if (state.hits >= 1) fireOnce("whack:hit:1");
    if (state.hits >= 10) fireOnce("whack:hit:10");
    if (state.hits >= 25) fireOnce("whack:hit:25");
    if (state.hits >= 50) fireOnce("whack:hit:50");
    if (state.hits >= 75) fireOnce("whack:hit:75");

    // Combo
    if (state.maxCombo >= 5) fireOnce("whack:combo:5");
    if (state.maxCombo >= 10) fireOnce("whack:combo:10");
    if (state.maxCombo >= 20) fireOnce("whack:combo:20");

    // Misses
    if (state.misses >= 1) fireOnce("whack:firstmiss");
    if (state.maxMissStreak >= 5) fireOnce("whack:miss:5");

    // Pre-crime / perfect5s
    if (state.precrimeFired) fireOnce("whack:precrime");
    if (state.perfect5sFired) fireOnce("whack:perfect5s");

    // High score
    recordScore("whack-a-niv", state.score);

    // Rounds counter (persisted via the store's highScores map under our
    // synthetic key — recordScore only updates when it goes up so we feed it
    // the new total directly).
    const nextRounds = roundsHigh + 1;
    // We need to bypass recordScore's "must be higher" guard for the case
    // where the user resets — but normally rounds only increases. recordScore
    // returns false if not higher, which is fine; we always pass nextRounds.
    recordScore(ROUNDS_KEY as unknown as Parameters<typeof recordScore>[0], nextRounds);
    if (nextRounds >= 10) fireOnce("whack:rounds:10");
    if (nextRounds >= 50) fireOnce("whack:rounds:50");

    // Reset start-game-only flag so the next round can re-fire its own end-game checks.
    overFiredRef.current = true;
  }, [state, fireOnce, recordScore, roundsHigh]);

  useEffect(() => {
    if (state.status === "playing") overFiredRef.current = false;
  }, [state.status]);

  // -------- Whack handler --------
  const handleWhack = useCallback(
    (holeIdx: number) => {
      const t =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const { state: next, result } = whack(stateRef.current, holeIdx, t);
      setState(next);

      if (result.hit) {
        setThumping((prev) => {
          const ns = new Set(prev);
          ns.add(holeIdx);
          return ns;
        });
        setTimeout(() => {
          setThumping((prev) => {
            const ns = new Set(prev);
            ns.delete(holeIdx);
            return ns;
          });
        }, 180);

        // Live-fire hit thresholds for instant unlock toasts.
        if (next.hits === 1) fireOnce("whack:hit:1");
        if (next.hits === 10) fireOnce("whack:hit:10");
        if (next.hits === 25) fireOnce("whack:hit:25");
        if (next.hits === 50) fireOnce("whack:hit:50");
        if (next.hits === 75) fireOnce("whack:hit:75");

        // Live combo unlocks
        if (next.combo === 5) fireOnce("whack:combo:5");
        if (next.combo === 10) fireOnce("whack:combo:10");
        if (next.combo === 20) fireOnce("whack:combo:20");

        if (result.precrime) fireOnce("whack:precrime");

        if (next.combo >= 5) {
          setShake(true);
          setTimeout(() => setShake(false), 200);
        }

        if (
          next.lastMissAt > 0 &&
          t - next.lastMissAt >= 5_000 &&
          next.perfect5sFired
        ) {
          fireOnce("whack:perfect5s");
        }
      } else {
        setFlashing((prev) => {
          const ns = new Set(prev);
          ns.add(holeIdx);
          return ns;
        });
        setTimeout(() => {
          setFlashing((prev) => {
            const ns = new Set(prev);
            ns.delete(holeIdx);
            return ns;
          });
        }, 180);

        if (next.misses === 1) fireOnce("whack:firstmiss");
        if (next.missStreak === 5) fireOnce("whack:miss:5");
      }
    },
    [fireOnce]
  );

  // -------- Derived display values --------
  const remainingMs = useMemo(() => {
    if (state.status === "idle") return ROUND_MS;
    return Math.max(0, state.deadline - now);
  }, [state.status, state.deadline, now]);
  const remainingSec = Math.ceil(remainingMs / 1000);

  const isHigh = state.status === "over" && state.score > 0 && state.score === highScore;

  return (
    <GameFrame
      title="WHACK-A-NIV"
      score={state.score}
      highScore={highScore}
      rightSlot={
        <div className="flex flex-col items-end leading-tight">
          <div className="text-arcade-yellow tabular-nums">{remainingSec}s</div>
          <div className="text-arcade-fg/70">SCORE {state.score}</div>
          <div className={state.combo >= 5 ? "text-arcade-pink" : "text-arcade-fg/50"}>
            x{state.combo}
          </div>
        </div>
      }
    >
      <div
        className={`flex flex-col items-center justify-center w-full p-4 gap-4 ${
          shake ? "animate-whack-shake" : ""
        }`}
      >
        {state.status === "idle" ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-[10px] text-arcade-fg/80 max-w-xs leading-snug">
              30 SECONDS. TAP THE BALD HEADS. BUILD COMBO. DON&apos;T MISS.
            </p>
            <button
              onClick={start}
              className="border-2 border-arcade-yellow px-5 py-2 text-[11px] hover:bg-arcade-yellow hover:text-arcade-black"
            >
              START
            </button>
            {highScore > 0 && (
              <p className="text-[8px] text-arcade-yellow/70">HI {highScore}</p>
            )}
          </div>
        ) : (
          <>
            {/* Top stat strip */}
            <div className="w-full max-w-sm flex items-center justify-between text-[9px] tabular-nums">
              <span className="text-arcade-fg/70">HITS {state.hits}</span>
              <span
                className={`text-[10px] ${
                  remainingSec <= 5 ? "text-arcade-red animate-flash" : "text-arcade-yellow"
                }`}
              >
                {remainingSec}s
              </span>
              <span
                className={
                  state.combo >= 5 ? "text-arcade-pink" : "text-arcade-fg/70"
                }
              >
                COMBO x{state.combo}
              </span>
            </div>

            <Holes
              holes={state.holes}
              flashing={flashing}
              thumping={thumping}
              onWhack={handleWhack}
              disabled={state.status !== "playing"}
            />

            <div className="flex items-center gap-3 text-[8px] text-arcade-fg/50">
              <span>MISSES {state.misses}</span>
              <span>BEST x{state.maxCombo}</span>
            </div>
          </>
        )}

        {state.status === "over" && (
          <GameOver
            score={state.score}
            isHighScore={isHigh}
            onRestart={start}
          />
        )}
      </div>

      <style jsx global>{`
        @keyframes whack-pop {
          0% {
            transform: translateY(40%) scale(0.4);
            opacity: 0;
          }
          60% {
            transform: translateY(-4%) scale(1.05);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        .animate-whack-pop {
          animation: whack-pop 150ms ease-out;
        }
        @keyframes whack-flash-red {
          0%,
          100% {
            background-color: rgba(230, 57, 70, 0);
          }
          50% {
            background-color: rgba(230, 57, 70, 0.5);
          }
        }
        .animate-whack-flash-red {
          animation: whack-flash-red 180ms ease-out;
        }
        @keyframes whack-flash-green {
          0%,
          100% {
            background-color: rgba(6, 214, 160, 0);
          }
          50% {
            background-color: rgba(6, 214, 160, 0.45);
          }
        }
        .animate-whack-flash-green {
          animation: whack-flash-green 180ms ease-out;
        }
        @keyframes whack-shake {
          0%,
          100% {
            transform: translate(0, 0);
          }
          20% {
            transform: translate(-3px, 1px);
          }
          40% {
            transform: translate(3px, -1px);
          }
          60% {
            transform: translate(-2px, 2px);
          }
          80% {
            transform: translate(2px, -2px);
          }
        }
        .animate-whack-shake {
          animation: whack-shake 200ms ease-in-out;
        }
      `}</style>
    </GameFrame>
  );
}
