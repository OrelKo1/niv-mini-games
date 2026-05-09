export type Difficulty = "easy" | "medium" | "hard";
export type MemoryStatus = "playing" | "won";

export interface MemoryCard {
  id: number;
  slug: string;
  flipped: boolean;
  matched: boolean;
}

export interface MemoryState {
  difficulty: Difficulty;
  cards: MemoryCard[];
  firstSelection?: number;
  secondSelection?: number;
  moves: number;
  mismatches: number;
  streak: number;
  status: MemoryStatus;
  startedAt: number;
  finishedAt?: number;
}

export interface RNG {
  next: () => number; // [0,1)
}

export interface BoardSize {
  cols: number;
  rows: number;
  pairs: number;
}

export const BOARD_BY_DIFFICULTY: Record<Difficulty, BoardSize> = {
  easy: { cols: 4, rows: 3, pairs: 6 },
  medium: { cols: 4, rows: 4, pairs: 8 },
  hard: { cols: 6, rows: 5, pairs: 15 },
};
