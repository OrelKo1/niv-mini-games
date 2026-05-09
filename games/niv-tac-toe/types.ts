export type Cell = "X" | "O" | null;
export type Board = Cell[]; // length 9, indexed 0..8 row-major
export type Player = "X" | "O";
export type Winner = "X" | "O" | "draw" | null;
export type Difficulty = "stoned" | "sober";

export const WINNING_LINES: ReadonlyArray<readonly [number, number, number]> = [
  // rows
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  // cols
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  // diagonals
  [0, 4, 8],
  [2, 4, 6],
];

export function emptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}
