import { describe, it, expect } from "vitest";
import {
  winner,
  move,
  availableCells,
  isGameOver,
} from "./engine";
import { emptyBoard, WINNING_LINES, type Board } from "./types";

function boardWith(map: Record<number, "X" | "O">): Board {
  const b = emptyBoard();
  for (const k of Object.keys(map)) {
    b[Number(k)] = map[Number(k)];
  }
  return b;
}

describe("niv-tac-toe engine", () => {
  it("winner detects all 8 winning lines for X and O", () => {
    for (const line of WINNING_LINES) {
      const bx = emptyBoard();
      const bo = emptyBoard();
      for (const idx of line) {
        bx[idx] = "X";
        bo[idx] = "O";
      }
      expect(winner(bx)).toBe("X");
      expect(winner(bo)).toBe("O");
    }
  });

  it("winner returns 'draw' on full board with no winner", () => {
    // X O X
    // X O O
    // O X X
    const b: Board = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];
    expect(winner(b)).toBe("draw");
  });

  it("winner returns null on incomplete non-winning board", () => {
    const b = boardWith({ 0: "X", 4: "O" });
    expect(winner(b)).toBeNull();
  });

  it("move() rejects taken cells (returns null)", () => {
    const b = boardWith({ 4: "X" });
    const result = move(b, 4, "O");
    expect(result).toBeNull();
  });

  it("move() returns a new board with the cell filled (does not mutate input)", () => {
    const b = emptyBoard();
    const result = move(b, 0, "X");
    expect(result).not.toBeNull();
    expect(result![0]).toBe("X");
    expect(b[0]).toBeNull(); // not mutated
  });

  it("availableCells returns correct indexes", () => {
    const b = boardWith({ 0: "X", 4: "O", 8: "X" });
    const cells = availableCells(b);
    expect(cells.sort()).toEqual([1, 2, 3, 5, 6, 7]);
  });

  it("availableCells on empty board returns 0..8", () => {
    expect(availableCells(emptyBoard())).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("isGameOver true when winner exists", () => {
    const b: Board = ["X", "X", "X", null, null, null, null, null, null];
    expect(isGameOver(b)).toBe(true);
  });

  it("isGameOver false on incomplete board", () => {
    expect(isGameOver(emptyBoard())).toBe(false);
  });
});
