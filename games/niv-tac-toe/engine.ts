import {
  WINNING_LINES,
  type Board,
  type Player,
  type Winner,
} from "./types";

/**
 * Returns the game outcome:
 *   "X" | "O" — that player has 3 in a row
 *   "draw"     — board is full with no winner
 *   null       — game still in progress
 */
export function winner(board: Board): Winner {
  for (const [a, b, c] of WINNING_LINES) {
    const v = board[a];
    if (v && v === board[b] && v === board[c]) {
      return v;
    }
  }
  if (board.every((cell) => cell !== null)) return "draw";
  return null;
}

/**
 * Returns a new board with `player` placed at `cell`.
 * Returns null if the cell is already taken or out of bounds.
 * Does NOT mutate the input board.
 */
export function move(
  board: Board,
  cell: number,
  player: Player
): Board | null {
  if (cell < 0 || cell > 8) return null;
  if (board[cell] !== null) return null;
  const next = board.slice();
  next[cell] = player;
  return next;
}

/** Returns the indexes of empty cells. */
export function availableCells(board: Board): number[] {
  const result: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) result.push(i);
  }
  return result;
}

/** True when there is a winner or the board is full (draw). */
export function isGameOver(board: Board): boolean {
  return winner(board) !== null;
}
