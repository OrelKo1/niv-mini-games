"use client";
import { useState } from "react";
import { GameFrame } from "@/components/arcade/GameFrame";
import { Renderer } from "@/games/snake-niv/Renderer";
import { useNivStore } from "@/lib/store/use-niv-store";

export default function SnakeNivPage() {
  const [score, setScore] = useState(0);
  const highScore = useNivStore((s) => s.highScores["snake-niv"] ?? 0);

  return (
    <GameFrame
      title="SNAKE-NIV"
      score={score}
      highScore={highScore}
      footer={
        <div className="flex items-center justify-between text-[8px] text-arcade-fg/50">
          <span>SWIPE TO TURN</span>
          <DPadHint />
          <span>EAT JOINTS</span>
        </div>
      }
    >
      <Renderer onScoreChange={(s) => setScore(s.score)} />
    </GameFrame>
  );
}

function DPadHint() {
  return (
    <div
      className="grid grid-cols-3 grid-rows-3 gap-[2px]"
      aria-hidden
      style={{ width: 36, height: 36 }}
    >
      <div />
      <div className="bg-arcade-fg/30" />
      <div />
      <div className="bg-arcade-fg/30" />
      <div className="bg-arcade-fg/10" />
      <div className="bg-arcade-fg/30" />
      <div />
      <div className="bg-arcade-fg/30" />
      <div />
    </div>
  );
}
