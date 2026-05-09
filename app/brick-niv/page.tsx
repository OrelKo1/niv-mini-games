"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GameFrame } from "@/components/arcade/GameFrame";
import { TouchPad } from "@/components/arcade/TouchPad";
import { GameOver } from "@/components/arcade/GameOver";
import { NivVideoSplash } from "@/components/arcade/NivVideoSplash";
import { useNivStore } from "@/lib/store/use-niv-store";
import { useAchievements } from "@/lib/achievements/use-achievements";
import { makeFixedStepLoop } from "@/lib/game/loop";
import { Renderer } from "@/games/brick-niv/Renderer";
import { setPaddleX, start, step } from "@/games/brick-niv/engine";
import {
  ADULTING_LABELS,
  FIELD_W,
  type BrickState,
} from "@/games/brick-niv/types";

const ADULTING_MILESTONES: Record<string, string> = {
  "Pay rent": "brick:rent",
  "Reply to mom": "brick:replymom",
  Gym: "brick:gym",
  Taxes: "brick:taxes",
};

export default function BrickNivPage() {
  const router = useRouter();
  const recordScore = useNivStore((s) => s.recordScore);
  const highScore = useNivStore((s) => s.highScores["brick-niv"] ?? 0);
  const { fire } = useAchievements();

  const stateRef = useRef<BrickState>(start(1));
  const [, setRenderTick] = useState(0);
  const [splashRole, setSplashRole] = useState<string | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [isHighScore, setIsHighScore] = useState(false);

  // milestone tracking flags (per game session)
  const flagsRef = useRef({
    firedFirstGame: false,
    firedFirstBreak: false,
    firedFirstPowerUp: false,
    firedFirstLevel: false,
    fired1k: false,
    fired3k: false,
    fired7500: false,
    firedFastLoss: false,
    firedBurst: false,
    firedAdultSweep: false,
    firedMulti30s: false,
    firedTristack: false,
    roundStartMs: 0,
    burstWindow: [] as number[],
  });

  const reset = useCallback((level = 1) => {
    stateRef.current = start(level);
    flagsRef.current.roundStartMs = performance.now();
    flagsRef.current.burstWindow = [];
    setShowGameOver(false);
    setIsHighScore(false);
  }, []);

  // initial mount: fire firstgame
  useEffect(() => {
    if (!flagsRef.current.firedFirstGame) {
      flagsRef.current.firedFirstGame = true;
      fire("brick:firstgame");
    }
    flagsRef.current.roundStartMs = performance.now();
  }, [fire]);

  // game loop
  useEffect(() => {
    const STEP_MS = 16;
    const loop = makeFixedStepLoop({
      stepMs: STEP_MS,
      step: () => {
        const s = stateRef.current;
        const before = s.status;
        step(s, STEP_MS);

        const ev = s.events;

        // brick break events
        for (const br of ev.brokenBricks) {
          if (!flagsRef.current.firedFirstBreak) {
            flagsRef.current.firedFirstBreak = true;
            fire("brick:break:1");
          }
          // adulting individual
          const m = ADULTING_MILESTONES[br.label];
          if (m) fire(m);

          // burst window
          const now = performance.now();
          flagsRef.current.burstWindow.push(now);
          flagsRef.current.burstWindow = flagsRef.current.burstWindow.filter(
            (t) => t >= now - 5000
          );
          if (
            !flagsRef.current.firedBurst &&
            flagsRef.current.burstWindow.length >= 10
          ) {
            flagsRef.current.firedBurst = true;
            fire("brick:burst:10in5");
          }
        }

        // power-ups collected
        if (ev.collectedPowerUps.length > 0 && !flagsRef.current.firedFirstPowerUp) {
          flagsRef.current.firedFirstPowerUp = true;
          fire("brick:powerup:1");
        }

        // fast loss
        if (
          ev.ballsLostThisStep > 0 &&
          !flagsRef.current.firedFastLoss &&
          performance.now() - flagsRef.current.roundStartMs <= 4000
        ) {
          flagsRef.current.firedFastLoss = true;
          fire("brick:fastloss");
        }
        if (ev.ballsLostThisStep > 0) {
          flagsRef.current.roundStartMs = performance.now();
        }

        // adulting sweep
        if (
          !flagsRef.current.firedAdultSweep &&
          ADULTING_LABELS.every((l) => s.adultingSmashed.includes(l))
        ) {
          flagsRef.current.firedAdultSweep = true;
          fire("brick:adultsweep");
        }

        // multi 30s
        if (!flagsRef.current.firedMulti30s && s.multiBallActiveMs >= 30_000) {
          flagsRef.current.firedMulti30s = true;
          fire("brick:multi:30s");
        }

        // tristack: multi-ball (≥2 balls) + wide-paddle + slow-ball active simultaneously
        if (
          !flagsRef.current.firedTristack &&
          s.balls.length >= 2 &&
          s.effects.widePaddleMs > 0 &&
          s.effects.slowBallMs > 0
        ) {
          flagsRef.current.firedTristack = true;
          fire("brick:tristack");
        }

        // score milestones
        if (!flagsRef.current.fired1k && s.score >= 1000) {
          flagsRef.current.fired1k = true;
          fire("brick:score:1000");
        }
        if (!flagsRef.current.fired3k && s.score >= 3000) {
          flagsRef.current.fired3k = true;
          fire("brick:score:3000");
        }
        if (!flagsRef.current.fired7500 && s.score >= 7500) {
          flagsRef.current.fired7500 = true;
          fire("brick:score:7500");
        }

        // status transitions
        if (before === "playing" && s.status === "cleared") {
          if (!flagsRef.current.firedFirstLevel) {
            flagsRef.current.firedFirstLevel = true;
            fire("brick:level:1");
          }
        }
        if (before === "playing" && s.status === "gameover") {
          const isHi = recordScore("brick-niv", s.score);
          setIsHighScore(isHi);
          setSplashRole(isHi ? "highscore" : "gameover");
        }
      },
      render: () => {
        // Force React update so overlays react to status changes
        setRenderTick((n) => (n + 1) & 0xffff);
      },
    });
    loop.start();
    return () => loop.stop();
  }, [fire, recordScore]);

  const onPan = useCallback((x: number, _y: number, rect: DOMRect) => {
    const s = stateRef.current;
    if (s.status !== "playing") return;
    const rel = (x - rect.left) / rect.width;
    setPaddleX(s, Math.max(0, Math.min(1, rel)) * FIELD_W);
  }, []);

  const onTap = useCallback(() => {
    const s = stateRef.current;
    if (s.status === "cleared") {
      reset(s.level + 1);
    }
  }, [reset]);

  const status = stateRef.current.status;
  const score = stateRef.current.score;

  const footer = useMemo(
    () => (
      <p className="text-[8px] text-arcade-fg/50 text-center">
        DRAG TO MOVE PADDLE — TAP TO ADVANCE
      </p>
    ),
    []
  );

  return (
    <GameFrame
      title="BRICK-NIV"
      score={score}
      highScore={highScore}
      footer={footer}
    >
      <div className="absolute inset-0">
        <Renderer stateRef={stateRef} />
      </div>
      <TouchPad onPan={onPan} onTap={onTap} />

      {status === "cleared" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-arcade-black/85 gap-4 p-6 text-center">
          <h2 className="text-lg text-arcade-green animate-flash">
            ★ LEVEL CLEARED ★
          </h2>
          <p className="text-[10px] text-arcade-fg/80">
            Niv resigns from his job.
          </p>
          <button
            onClick={() => reset(stateRef.current.level + 1)}
            className="border-2 border-arcade-yellow px-4 py-2 text-[10px] hover:bg-arcade-yellow hover:text-arcade-black"
          >
            NEXT LEVEL
          </button>
        </div>
      )}

      {showGameOver && (
        <GameOver
          score={score}
          isHighScore={isHighScore}
          onRestart={() => {
            reset(1);
            flagsRef.current.firedFirstGame = true; // already fired, don't refire
          }}
          onHome={() => router.push("/")}
        />
      )}

      {splashRole && (
        <NivVideoSplash
          role={splashRole}
          onDone={() => {
            setSplashRole(null);
            setShowGameOver(true);
          }}
        />
      )}
    </GameFrame>
  );
}
