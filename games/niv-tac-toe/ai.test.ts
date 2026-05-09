import { describe, it, expect } from "vitest";
import { stonedAi, soberAi } from "./ai";
import { move, winner, availableCells } from "./engine";
import { emptyBoard } from "./types";
import type { Board, Player } from "./types";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function playGame(
  oStrategy: (b: Board) => number,
  xStrategy: (b: Board) => number
): "X" | "O" | "draw" {
  let b: Board = emptyBoard();
  let turn: Player = "X";
  while (!winner(b)) {
    const idx = turn === "X" ? xStrategy(b) : oStrategy(b);
    const next = move(b, idx, turn);
    if (!next) throw new Error("AI returned an invalid cell");
    b = next;
    turn = turn === "X" ? "O" : "X";
  }
  const w = winner(b);
  if (w === "X" || w === "O") return w;
  return "draw";
}

const randomStrategy = (b: Board): number => pickRandom(availableCells(b));

describe("niv-tac-toe AI", () => {
  it("sober AI never loses to a random X player (30 games)", () => {
    let aiLosses = 0;
    for (let i = 0; i < 30; i++) {
      const result = playGame(soberAi, randomStrategy);
      if (result === "X") aiLosses += 1;
    }
    expect(aiLosses).toBe(0);
  });

  it("stoned AI loses sometimes to a random X player (50 games)", () => {
    let xWins = 0;
    for (let i = 0; i < 50; i++) {
      const result = playGame(stonedAi, randomStrategy);
      if (result === "X") xWins += 1;
    }
    expect(xWins).toBeGreaterThanOrEqual(5);
  });

  it("sober AI returns a valid (available) cell index", () => {
    const b: Board = ["X", null, null, null, "O", null, null, null, null];
    const idx = soberAi(b);
    expect(availableCells(b)).toContain(idx);
  });

  it("stoned AI returns a valid (available) cell index", () => {
    const b: Board = ["X", null, null, null, "O", null, null, null, null];
    const idx = stonedAi(b);
    expect(availableCells(b)).toContain(idx);
  });

  it("sober AI blocks an immediate X win", () => {
    // X about to win on top row; O must block at index 2.
    const b: Board = ["X", "X", null, null, "O", null, null, null, null];
    const idx = soberAi(b);
    expect(idx).toBe(2);
  });

  it("sober AI takes the win when available", () => {
    // O can win on middle column at index 7.
    const b: Board = ["X", "O", "X", null, "O", null, "X", null, null];
    const idx = soberAi(b);
    expect(idx).toBe(7);
  });
});
