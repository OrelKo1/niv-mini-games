"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameFrame } from "@/components/arcade/GameFrame";
import { NivVideoSplash } from "@/components/arcade/NivVideoSplash";
import { NIV_MANIFEST } from "@/lib/niv-manifest";
import { useAchievements } from "@/lib/achievements/use-achievements";
import { useNivStore } from "@/lib/store/use-niv-store";
import { Board } from "@/games/niv-memory/Board";
import {
  start,
  flip,
  resolve,
  bothSelected,
} from "@/games/niv-memory/engine";
import {
  BOARD_BY_DIFFICULTY,
  type Difficulty,
  type MemoryState,
} from "@/games/niv-memory/types";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const REVEAL_MS = 900;

interface BestRecord {
  moves: number;
  mismatches: number;
  timeMs: number;
}

function bestKey(d: Difficulty) {
  return `nivtendo:memory:best:${d}`;
}

function loadBest(d: Difficulty): BestRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(bestKey(d));
    if (!raw) return null;
    const v = JSON.parse(raw) as BestRecord;
    if (
      typeof v?.moves === "number" &&
      typeof v?.mismatches === "number" &&
      typeof v?.timeMs === "number"
    )
      return v;
    return null;
  } catch {
    return null;
  }
}

function saveBest(d: Difficulty, rec: BestRecord) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(bestKey(d), JSON.stringify(rec));
  } catch {
    // ignore
  }
}

function isBetter(prev: BestRecord | null, next: BestRecord): boolean {
  if (!prev) return true;
  if (next.mismatches !== prev.mismatches)
    return next.mismatches < prev.mismatches;
  return next.timeMs < prev.timeMs;
}

function computeScore(rec: BestRecord): number {
  const timeBonus = rec.timeMs < 60_000 ? 100 : 0;
  return Math.max(0, 1000 - rec.moves * 10 - rec.mismatches * 30 + timeBonus);
}

/** Persistent counters that live across rounds. */
const FIRSTMISS_KEY = "nivtendo:memory:firstmiss";
const ROUNDS_KEY = "nivtendo:memory:rounds";
function loadFirstMissFired(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(FIRSTMISS_KEY) === "1";
}
function setFirstMissFired() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FIRSTMISS_KEY, "1");
}
function loadRounds(): number {
  if (typeof window === "undefined") return 0;
  const v = window.localStorage.getItem(ROUNDS_KEY);
  return v ? parseInt(v, 10) || 0 : 0;
}
function bumpRounds(): number {
  const n = loadRounds() + 1;
  if (typeof window !== "undefined")
    window.localStorage.setItem(ROUNDS_KEY, String(n));
  return n;
}

export default function NivMemoryPage() {
  const recordScore = useNivStore((s) => s.recordScore);
  const { fire } = useAchievements();

  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [state, setState] = useState<MemoryState | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(false);
  const [isHighScore, setIsHighScore] = useState(false);

  // Build a slug pool for niv-memory; supplement with other games' slugs
  // if there aren't enough unique niv-memory assets for hard mode.
  const slugPool = useMemo(() => {
    const memorySlugs = NIV_MANIFEST.assets
      .filter((a) => a.game === "niv-memory")
      .map((a) => a.slug);
    if (memorySlugs.length >= BOARD_BY_DIFFICULTY.hard.pairs) return memorySlugs;
    const seen = new Set(memorySlugs);
    const pool = [...memorySlugs];
    for (const a of NIV_MANIFEST.assets) {
      if (!seen.has(a.slug)) {
        seen.add(a.slug);
        pool.push(a.slug);
      }
    }
    return pool;
  }, []);

  const slugToCaption = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of NIV_MANIFEST.assets) m.set(a.slug, a.caption);
    return m;
  }, []);

  // ---- lifecycle: track quit-mid-game on unmount ----
  const stateRef = useRef<MemoryState | null>(null);
  stateRef.current = state;
  useEffect(() => {
    return () => {
      const s = stateRef.current;
      if (
        s &&
        s.status === "playing" &&
        s.cards.some((c) => c.flipped || c.matched)
      ) {
        fire("memory:quit");
      }
    };
    // fire is stable enough; we only want this on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- start a fresh round ----
  const begin = useCallback(
    (d: Difficulty) => {
      setBanner(null);
      setShowSplash(false);
      setIsHighScore(false);
      setState(start(d, slugPool));
    },
    [slugPool]
  );

  // ---- handle flips with auto-resolve ----
  const onFlip = useCallback(
    (id: number) => {
      setState((prev) => {
        if (!prev) return prev;
        if (bothSelected(prev)) return prev;
        return flip(prev, id);
      });
    },
    []
  );

  // when both are selected, resolve after a short delay
  useEffect(() => {
    if (!state) return;
    if (!bothSelected(state)) return;
    const first = state.cards.find((c) => c.id === state.firstSelection);
    const second = state.cards.find((c) => c.id === state.secondSelection);
    const isMatch = first && second && first.slug === second.slug;

    const delay = isMatch ? 400 : REVEAL_MS;

    let bannerTimer: ReturnType<typeof setTimeout> | undefined;
    if (isMatch && first) {
      const cap = slugToCaption.get(first.slug);
      if (cap) {
        setBanner(cap);
        bannerTimer = setTimeout(() => setBanner(null), 1500);
      }
    }

    const resolveTimer = setTimeout(() => {
      setState((prev) => {
        if (!prev) return prev;
        if (!bothSelected(prev)) return prev;
        return resolve(prev);
      });
    }, delay);

    return () => {
      clearTimeout(resolveTimer);
      if (bannerTimer) clearTimeout(bannerTimer);
    };
  }, [state, slugToCaption]);

  // ---- emit milestones on state transitions ----
  const prevRef = useRef<MemoryState | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = state;
    if (!state) return;

    if (!prev) return;

    // mismatch transitions
    if (state.mismatches > prev.mismatches) {
      // first ever mismatch (across all rounds)
      if (!loadFirstMissFired()) {
        fire("memory:firstmiss");
        setFirstMissFired();
      }
      if (state.mismatches >= 10 && prev.mismatches < 10) {
        fire("memory:miss:10");
      }
    }

    // streak transitions (just hit threshold)
    if (state.streak > prev.streak) {
      const matchedPairs = state.cards.filter((c) => c.matched).length / 2;
      const prevMatchedPairs = prev.cards.filter((c) => c.matched).length / 2;
      if (matchedPairs >= 1 && prevMatchedPairs < 1) fire("memory:match:1");
      if (matchedPairs >= 5 && prevMatchedPairs < 5) fire("memory:match:5");
      if (state.streak >= 3 && prev.streak < 3) fire("memory:streak:3");
      if (state.streak >= 5 && prev.streak < 5) fire("memory:streak:5");
    }

    // win transition
    if (state.status === "won" && prev.status !== "won") {
      const timeMs = (state.finishedAt ?? Date.now()) - state.startedAt;
      const rec: BestRecord = {
        moves: state.moves,
        mismatches: state.mismatches,
        timeMs,
      };
      const previousBest = loadBest(state.difficulty);
      const better = isBetter(previousBest, rec);
      if (better) saveBest(state.difficulty, rec);
      setIsHighScore(better);

      // record an aggregate score under the GameId so the lobby has something
      recordScore("niv-memory", computeScore(rec));

      // fire clear / perfect / fast / moves milestones
      fire(`memory:clear:${state.difficulty}`);
      if (state.difficulty === "hard" && timeMs < 120_000) {
        fire("memory:clear:hard:120s");
      }
      if (state.mismatches === 0) {
        fire(`memory:perfect:${state.difficulty}`);
      }
      if (state.moves <= 15) fire("memory:moves:15");
      if (timeMs < 30_000) fire("memory:fast:30s");

      const total = bumpRounds();
      if (total === 5) fire("memory:rounds:5");
      if (total === 25) fire("memory:rounds:25");

      if (better) setShowSplash(true);
    }
  }, [state, fire, recordScore]);

  // ---- render ----
  const best = state ? loadBest(state.difficulty) : null;

  return (
    <GameFrame
      title="NIV-MEMORY"
      rightSlot={
        state ? (
          <div className="text-[8px] text-arcade-fg/70 tabular-nums">
            <div>MV {state.moves}</div>
            <div className="text-arcade-red">X {state.mismatches}</div>
            {best && (
              <div className="text-arcade-yellow/70">
                BEST {best.moves}/{best.mismatches}
              </div>
            )}
          </div>
        ) : null
      }
    >
      <div className="w-full flex flex-col items-center justify-start gap-3 py-3 px-2 overflow-y-auto">
        {/* difficulty selector */}
        <div className="flex gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDifficulty(d);
                begin(d);
              }}
              className={`px-3 py-2 text-[10px] border-2 ${
                difficulty === d
                  ? "border-arcade-yellow text-arcade-yellow"
                  : "border-arcade-fg/30 text-arcade-fg/60 hover:border-arcade-fg/70"
              }`}
            >
              {d.toUpperCase()}
            </button>
          ))}
        </div>

        {!state && (
          <div className="text-[10px] text-arcade-fg/70 text-center max-w-xs leading-snug pt-6">
            PICK A DIFFICULTY TO BEGIN.
            <br />
            EASY 4×3 · MEDIUM 4×4 · HARD 6×5.
          </div>
        )}

        {state && (
          <Board state={state} onFlip={onFlip} disabled={bothSelected(state)} />
        )}

        {banner && (
          <div className="text-[9px] text-arcade-yellow text-center max-w-xs leading-snug px-3 py-1 border border-arcade-yellow/50 bg-arcade-black animate-toast-in">
            {banner}
          </div>
        )}

        {/* won celebration */}
        {state?.status === "won" && !showSplash && (
          <WonOverlay
            state={state}
            isHighScore={isHighScore}
            onAgain={() => begin(state.difficulty)}
          />
        )}

        {showSplash && (
          <NivVideoSplash
            role="highscore"
            onDone={() => setShowSplash(false)}
          />
        )}
      </div>
    </GameFrame>
  );
}

function WonOverlay({
  state,
  isHighScore,
  onAgain,
}: {
  state: MemoryState;
  isHighScore: boolean;
  onAgain: () => void;
}) {
  const timeMs = (state.finishedAt ?? Date.now()) - state.startedAt;
  const seconds = (timeMs / 1000).toFixed(1);
  return (
    <div className="absolute inset-0 z-30 bg-arcade-black/90 flex flex-col items-center justify-center p-6 text-center gap-4">
      <h2
        className={`text-lg ${
          isHighScore ? "text-arcade-yellow" : "text-arcade-green"
        } animate-flash`}
      >
        {isHighScore ? "★ NEW BEST ★" : "WON"}
      </h2>
      <div className="text-[10px] text-arcade-fg/80 leading-relaxed tabular-nums">
        <div>MOVES: {state.moves}</div>
        <div>MISMATCHES: {state.mismatches}</div>
        <div>TIME: {seconds}s</div>
        <div className="text-arcade-fg/50 mt-1">
          {state.difficulty.toUpperCase()} BOARD
        </div>
      </div>
      <button
        onClick={onAgain}
        className="border-2 border-arcade-yellow px-4 py-2 text-[10px] hover:bg-arcade-yellow hover:text-arcade-black"
      >
        PLAY AGAIN
      </button>
    </div>
  );
}
