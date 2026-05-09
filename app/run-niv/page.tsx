"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameFrame } from "@/components/arcade/GameFrame";
import { GameOver } from "@/components/arcade/GameOver";
import { NivVideoSplash } from "@/components/arcade/NivVideoSplash";
import { Renderer } from "@/games/run-niv/Renderer";
import {
  createInitialState,
  jump,
  startGame,
  stepWithEvents,
} from "@/games/run-niv/engine";
import type { RunNivState } from "@/games/run-niv/types";
import { useNivStore } from "@/lib/store/use-niv-store";
import { useAchievements } from "@/lib/achievements/use-achievements";
import { pickFaceForGame } from "@/lib/niv/face-pool";

const MILESTONE_FIRSTRUN_KEY = "run-niv:firstrun";

export default function RunNiv() {
  const [stateVersion, setStateVersion] = useState(0);
  const stateRef = useRef<RunNivState | null>(null);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState<{
    youDist: number;
    nivDist: number;
    trips: number;
    won: boolean;
    isHighScore: boolean;
  } | null>(null);
  const [splashRole, setSplashRole] = useState<string | null>(null);
  const [nivFaceUrl, setNivFaceUrl] = useState<string>(
    () => pickFaceForGame("run-niv").paths.avatar128
  );
  const playerFaceUrl = "/niv/cb2aea18265e/avatar-128.webp"; // generic stand-in

  const recordScore = useNivStore((s) => s.recordScore);
  const highScore = useNivStore((s) => s.highScores["run-niv"] ?? 0);
  const { fire } = useAchievements();

  const begin = useCallback(() => {
    const fresh = createInitialState();
    const started = startGame(fresh, performance.now());
    stateRef.current = started;
    setRunning(true);
    setOver(null);
    setSplashRole(null);
    setNivFaceUrl(pickFaceForGame("run-niv").paths.avatar128);
    setStateVersion((v) => v + 1);

    if (typeof window !== "undefined" &&
        !window.localStorage.getItem(MILESTONE_FIRSTRUN_KEY)) {
      fire("run:firstrun");
      window.localStorage.setItem(MILESTONE_FIRSTRUN_KEY, "1");
    }
  }, [fire]);

  // game loop
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const trippedAt: number[] = [];

    const tick = () => {
      const s = stateRef.current;
      if (!s) return;
      const result = stepWithEvents(s, performance.now());
      stateRef.current = result.state;

      for (const ev of result.events) {
        if (ev.kind === "niv-trip") {
          if (ev.reason === "phantom" && !result.state.flags.phantomFired) {
            result.state.flags.phantomFired = true;
            fire("run:trip:phantom");
          }
          trippedAt.push(result.state.now);
          // chain: 3 niv obstacle-trips in 6s
          if (ev.reason === "obstacle") {
            const recent = trippedAt.filter((t) => result.state.now - t < 6000);
            if (recent.length >= 3 && result.state.flags.nivchainCount < 1) {
              result.state.flags.nivchainCount = 1;
              fire("run:nivchain:3");
            }
          }
          // milestone counts
          if (result.state.niv.trips === 5) fire("run:trip:5");
          if (result.state.niv.trips === 10) fire("run:trip:10");
          if (result.state.niv.trips === 20) fire("run:trip:20");
        }
        if (ev.kind === "player-stumble") {
          result.state.flags.flawlessImpossible = true;
          if (result.state.player.stumbles === 1 &&
              result.state.player.distance < 80) {
            fire("run:headbutt");
          }
        }
        if (ev.kind === "round-end") {
          const youDist = Math.floor(result.state.player.distance);
          const nivDist = Math.floor(result.state.niv.distance);
          const won = youDist > nivDist;
          const beatBy = youDist - nivDist;
          const isHigh = recordScore("run-niv", youDist);

          if (won) fire("run:beat");
          else fire("run:lose");
          if (won && beatBy >= 500) fire("run:beat:500");
          if (won && beatBy >= 1000) fire("run:beat:1000");
          if (youDist >= 500) fire("run:dist:500");
          if (youDist >= 1000) fire("run:dist:1000");
          if (youDist >= 1500) fire("run:dist:1500");
          if (won && !result.state.flags.flawlessImpossible) fire("run:flawless");
          if (won && result.state.niv.tripUntil > result.state.now)
            fire("run:airborn");

          setOver({
            youDist,
            nivDist,
            trips: result.state.niv.trips,
            won,
            isHighScore: isHigh,
          });
          setSplashRole(won ? "trip" : "gameover");
          setRunning(false);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, fire, recordScore]);

  // input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space" || e.key === "ArrowUp" || e.key === "w") {
        e.preventDefault();
        if (stateRef.current) {
          stateRef.current = jump(stateRef.current, performance.now());
        }
      }
      if (e.key === "Enter" && !running && !over) {
        begin();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, over, begin]);

  const onTap = useCallback(() => {
    if (stateRef.current) {
      stateRef.current = jump(stateRef.current, performance.now());
    }
  }, []);

  return (
    <GameFrame
      title="RUN-NIV"
      score={over ? over.youDist : Math.floor(stateRef.current?.player.distance ?? 0)}
      highScore={highScore}
    >
      <div
        className="w-full h-full flex flex-col items-stretch justify-center px-2 py-2 gap-3"
        onPointerDown={onTap}
      >
        <div
          className="relative mx-auto w-full"
          style={{
            maxWidth: "min(96vw, 88dvh)",
            aspectRatio: "3 / 2",
          }}
        >
          {stateVersion > 0 && (
            <Renderer
              stateRef={stateRef}
              nivFaceUrl={nivFaceUrl}
              playerFaceUrl={playerFaceUrl}
            />
          )}
          {!running && !over && stateVersion === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-arcade-black/80 border-2 border-arcade-yellow/40">
              <h2 className="text-arcade-yellow text-lg animate-flash">RUN-NIV</h2>
              <p className="text-[10px] text-arcade-fg/80 max-w-xs text-center leading-snug px-4">
                60-SECOND SPRINT VS NIV.<br />
                NIV WILL TRIP.<br />
                TAP / SPACE TO JUMP.
              </p>
              <button
                onClick={begin}
                className="border-2 border-arcade-yellow text-arcade-yellow text-[11px] px-5 py-3 hover:bg-arcade-yellow hover:text-arcade-black"
              >
                START
              </button>
            </div>
          )}
          {!running && over && stateVersion > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-arcade-black/85 px-4 text-center">
              <p
                className={`text-base ${
                  over.won ? "text-arcade-green" : "text-arcade-red"
                } animate-flash`}
              >
                {over.won ? "YOU BEAT NIV" : "NIV BEAT YOU"}
              </p>
              <p className="text-[10px] text-arcade-fg/80 mt-1">
                YOU {over.youDist}m • NIV {over.nivDist}m
              </p>
              <p className="text-[9px] text-arcade-pink mt-1">
                NIV TRIPPED {over.trips}× —{" "}
                {over.trips === 0 ? "miraculous" : "as nature intended"}
              </p>
              {over.isHighScore && (
                <p className="text-[10px] text-arcade-yellow mt-2">★ NEW HIGH SCORE</p>
              )}
              <div className="flex gap-3 mt-3">
                <button
                  onClick={begin}
                  className="border-2 border-arcade-yellow text-arcade-yellow text-[10px] px-4 py-2 hover:bg-arcade-yellow hover:text-arcade-black"
                >
                  RUN AGAIN
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            onClick={onTap}
            className="border-2 border-arcade-yellow text-arcade-yellow text-base w-32 h-14 hover:bg-arcade-yellow hover:text-arcade-black active:bg-arcade-yellow active:text-arcade-black select-none touch-none"
          >
            JUMP ▲
          </button>
          <p className="text-[8px] text-arcade-fg/40">tap anywhere on the track too</p>
        </div>

        {splashRole && (
          <NivVideoSplash
            role={splashRole}
            onDone={() => setSplashRole(null)}
          />
        )}
      </div>
    </GameFrame>
  );
}
