"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameFrame } from "@/components/arcade/GameFrame";
import { NivVideoSplash } from "@/components/arcade/NivVideoSplash";
import { useAchievements } from "@/lib/achievements/use-achievements";
import { useNivStore } from "@/lib/store/use-niv-store";
import { pickFaceForGame } from "@/lib/niv/face-pool";
import { Board } from "@/games/niv-tac-toe/Board";
import {
  availableCells,
  isGameOver,
  move,
  winner,
} from "@/games/niv-tac-toe/engine";
import { soberAi, stonedAi } from "@/games/niv-tac-toe/ai";
import {
  emptyBoard,
  WINNING_LINES,
  type Board as BoardT,
  type Difficulty,
  type Winner,
} from "@/games/niv-tac-toe/types";

const STONED_BANTER = [
  "your move",
  "i wasn't paying attention",
  "wait what",
  "fine fine",
  "ok this is mine",
  "my turn obviously",
  "huh.",
  "where were we",
];

const SOBER_BANTER = [
  "calculated.",
  "predictable.",
  "as expected.",
  "i told you.",
  "easy.",
  "this ends one way.",
];

// Ad-hoc cumulative state stored in the existing highScores slot.
const PLAYED_KEY = "niv-tac-toe" as const;

function findWinningLine(board: BoardT): readonly number[] | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return line;
  }
  return null;
}

interface HistoryEntry {
  result: Winner; // "X" | "O" | "draw"
  difficulty: Difficulty;
  movesByX: number;
}

export default function NivTacToePage() {
  const { fire } = useAchievements();
  const recordScore = useNivStore((s) => s.recordScore);
  const playedCount = useNivStore((s) => s.highScores[PLAYED_KEY] ?? 0);

  const [difficulty, setDifficulty] = useState<Difficulty>("stoned");
  const [board, setBoard] = useState<BoardT>(emptyBoard);
  const [turn, setTurn] = useState<"X" | "O">("X");
  const [banter, setBanter] = useState<string>(STONED_BANTER[0]);
  const [showVictoryVideo, setShowVictoryVideo] = useState(false);
  const xMoveCountRef = useRef(0);
  const historyRef = useRef<HistoryEntry[]>([]);
  const stonedStreakRef = useRef(0);
  const drawStreakRef = useRef(0);
  const finishedRef = useRef(false);

  const [faceUrl, setFaceUrl] = useState<string>(
    () => pickFaceForGame("niv-tac-toe").paths.avatar128
  );

  const newFace = useCallback(() => {
    setFaceUrl(pickFaceForGame("niv-tac-toe").paths.avatar128);
  }, []);

  const result = winner(board);
  const gameOver = result !== null;
  const winningLine = useMemo(() => findWinningLine(board), [board]);

  const rotateBanter = useCallback(
    (diff: Difficulty) => {
      const pool = diff === "stoned" ? STONED_BANTER : SOBER_BANTER;
      setBanter(pool[Math.floor(Math.random() * pool.length)]);
    },
    []
  );

  // AI move effect — runs when it's O's turn and game isn't over.
  useEffect(() => {
    if (gameOver) return;
    if (turn !== "O") return;
    const handle = setTimeout(() => {
      const cells = availableCells(board);
      if (cells.length === 0) return;
      const idx = difficulty === "sober" ? soberAi(board) : stonedAi(board);
      const next = move(board, idx, "O");
      if (next) {
        setBoard(next);
        setTurn("X");
        rotateBanter(difficulty);
      }
    }, 450);
    return () => clearTimeout(handle);
  }, [turn, board, gameOver, difficulty, rotateBanter]);

  // Game-end effect — fire achievements once per finished game.
  useEffect(() => {
    if (!gameOver || finishedRef.current) return;
    finishedRef.current = true;

    const movesByX = xMoveCountRef.current;
    const entry: HistoryEntry = { result, difficulty, movesByX };
    historyRef.current = [...historyRef.current, entry].slice(-10);

    // Cumulative played counter via highScores (recordScore only writes if greater).
    const newCount = playedCount + 1;
    recordScore(PLAYED_KEY, newCount);

    // First-game milestone.
    if (newCount === 1) fire("xo:firstgame");
    if (newCount >= 25) fire("xo:played:25");
    if (newCount >= 100) fire("xo:played:100");

    if (result === "X") {
      // Player won.
      if (difficulty === "stoned") {
        fire("xo:win:stoned");
        stonedStreakRef.current += 1;
        if (stonedStreakRef.current >= 5) fire("xo:streak:stoned:5");
        if (stonedStreakRef.current >= 10) fire("xo:streak:stoned:10");
      } else {
        fire("xo:win:sober");
        stonedStreakRef.current = 0;
      }
      drawStreakRef.current = 0;
      if (movesByX === 3) fire("xo:win:fast");
      // High-score splash for the rare sober win.
      if (difficulty === "sober") setShowVictoryVideo(true);
    } else if (result === "O") {
      // Player lost.
      if (difficulty === "stoned") fire("xo:loss:stoned");
      stonedStreakRef.current = 0;
      drawStreakRef.current = 0;
    } else if (result === "draw") {
      if (difficulty === "sober") fire("xo:draw:sober");
      drawStreakRef.current += 1;
      if (drawStreakRef.current >= 3) fire("xo:draw:streak:3");
      stonedStreakRef.current = 0;
    }

    // Pattern: win, draw, win in last 3.
    const last3 = historyRef.current.slice(-3).map((e) => e.result);
    if (
      last3.length === 3 &&
      last3[0] === "X" &&
      last3[1] === "draw" &&
      last3[2] === "X"
    ) {
      fire("xo:wdw");
    }
  }, [gameOver, result, difficulty, fire, recordScore, playedCount]);

  const handleCellClick = useCallback(
    (idx: number) => {
      if (gameOver || turn !== "X") return;
      const next = move(board, idx, "X");
      if (!next) return;
      xMoveCountRef.current += 1;
      setBoard(next);
      setTurn("O");
      rotateBanter(difficulty);
    },
    [board, gameOver, turn, difficulty, rotateBanter]
  );

  const startNewGame = useCallback(
    (diff: Difficulty = difficulty) => {
      setBoard(emptyBoard());
      setTurn("X");
      xMoveCountRef.current = 0;
      finishedRef.current = false;
      setShowVictoryVideo(false);
      const pool = diff === "stoned" ? STONED_BANTER : SOBER_BANTER;
      setBanter(pool[0]);
      newFace();
    },
    [difficulty, newFace]
  );

  const handleDifficultyChange = useCallback(
    (diff: Difficulty) => {
      if (diff === difficulty) return;
      setDifficulty(diff);
      startNewGame(diff);
      newFace();
    },
    [difficulty, startNewGame, newFace]
  );

  const overlayCaption = useMemo(() => {
    if (!isGameOver(board)) return "";
    if (result === "X")
      return difficulty === "sober"
        ? "you beat sober niv. mathematically rude."
        : "stoned niv lost. shocking.";
    if (result === "O")
      return difficulty === "sober"
        ? "sober niv was always going to win."
        : "stoned niv woke up. unlucky.";
    return difficulty === "sober"
      ? "draw vs sober niv. honorable."
      : "a draw. somehow.";
  }, [board, result, difficulty]);

  return (
    <GameFrame
      title="NIV-TAC-TOE"
      rightSlot={
        <div className="text-[8px] text-arcade-fg/70 leading-tight">
          <div>played</div>
          <div className="tabular-nums text-arcade-yellow">{playedCount}</div>
        </div>
      }
    >
      <div className="flex-1 flex flex-col items-center justify-between gap-3 p-3 w-full">
        {/* Difficulty toggle */}
        <div className="flex gap-2 text-[10px]">
          <button
            type="button"
            onClick={() => handleDifficultyChange("stoned")}
            className={`border-2 px-3 py-1 ${
              difficulty === "stoned"
                ? "border-arcade-green bg-arcade-green/20 text-arcade-green"
                : "border-arcade-fg/40 text-arcade-fg/60"
            }`}
          >
            STONED
          </button>
          <button
            type="button"
            onClick={() => handleDifficultyChange("sober")}
            className={`border-2 px-3 py-1 ${
              difficulty === "sober"
                ? "border-arcade-red bg-arcade-red/20 text-arcade-red"
                : "border-arcade-fg/40 text-arcade-fg/60"
            }`}
          >
            SOBER
          </button>
        </div>

        {/* Banter line */}
        <div className="text-[10px] text-arcade-fg/80 min-h-[1em] text-center">
          {gameOver ? "" : `niv: "${banter}"`}
        </div>

        {/* Board */}
        <Board
          board={board}
          onCellClick={handleCellClick}
          disabled={gameOver || turn !== "X"}
          faceUrl={faceUrl}
          winningLine={winningLine}
        />

        {/* Status bar */}
        <div className="text-[9px] text-arcade-fg/60 text-center min-h-[1em]">
          {!gameOver &&
            (turn === "X" ? "your move" : "niv is thinking (sort of)")}
        </div>

        {/* Game over overlay */}
        {gameOver && !showVictoryVideo && (
          <div className="absolute inset-0 z-30 bg-arcade-black/90 flex flex-col items-center justify-center p-6 text-center gap-4">
            <h2
              className={`text-lg animate-flash ${
                result === "X"
                  ? "text-arcade-yellow"
                  : result === "O"
                  ? "text-arcade-red"
                  : "text-arcade-fg"
              }`}
            >
              {result === "X"
                ? "★ YOU WIN ★"
                : result === "O"
                ? "GAME OVER"
                : "DRAW"}
            </h2>
            <p className="text-[10px] leading-snug text-arcade-fg/80 max-w-xs">
              {overlayCaption}
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => startNewGame(difficulty)}
                className="border-2 border-arcade-yellow px-4 py-2 text-[10px] hover:bg-arcade-yellow hover:text-arcade-black"
              >
                PLAY AGAIN
              </button>
            </div>
          </div>
        )}

        {/* Victory video splash for sober wins */}
        {showVictoryVideo && (
          <NivVideoSplash
            role="highscore"
            onDone={() => setShowVictoryVideo(false)}
          />
        )}
      </div>
    </GameFrame>
  );
}
