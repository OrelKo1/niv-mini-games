import { availableCells, move, winner } from "./engine";
import type { Board, Player } from "./types";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Find a cell where placing `player` would immediately win.
 * Returns null if no such cell.
 */
function findWinningCell(board: Board, player: Player): number | null {
  for (const idx of availableCells(board)) {
    const next = move(board, idx, player);
    if (next && winner(next) === player) return idx;
  }
  return null;
}

/**
 * Stoned AI: mostly random.
 * If X is about to win, blocks 50% of the time.
 * AI plays as O.
 */
export function stonedAi(board: Board): number {
  const cells = availableCells(board);
  if (cells.length === 0) {
    throw new Error("stonedAi: no available cells");
  }
  // 50% chance to actually pay attention and block an immediate X win.
  if (Math.random() < 0.5) {
    const blocking = findWinningCell(board, "X");
    if (blocking !== null) return blocking;
  }
  return pickRandom(cells);
}

/**
 * Sober AI: minimax with alpha-beta pruning. Unbeatable.
 * AI plays as O (maximizer for O); X is the minimizer.
 */
export function soberAi(board: Board): number {
  const cells = availableCells(board);
  if (cells.length === 0) {
    throw new Error("soberAi: no available cells");
  }

  let bestScore = -Infinity;
  let bestMove = cells[0];
  for (const idx of cells) {
    const next = move(board, idx, "O");
    if (!next) continue;
    const score = minimax(next, "X", 0, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestMove = idx;
    }
  }
  return bestMove;
}

/**
 * Minimax with alpha-beta. O is the maximizer, X the minimizer.
 * Returns a score:
 *   +10 - depth  (O wins; prefer faster wins)
 *   -10 + depth  (X wins; prefer slower losses)
 *    0           (draw)
 */
function minimax(
  board: Board,
  turn: Player,
  depth: number,
  alpha: number,
  beta: number
): number {
  const w = winner(board);
  if (w === "O") return 10 - depth;
  if (w === "X") return -10 + depth;
  if (w === "draw") return 0;

  const cells = availableCells(board);

  if (turn === "O") {
    let best = -Infinity;
    for (const idx of cells) {
      const next = move(board, idx, "O");
      if (!next) continue;
      const score = minimax(next, "X", depth + 1, alpha, beta);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const idx of cells) {
      const next = move(board, idx, "X");
      if (!next) continue;
      const score = minimax(next, "O", depth + 1, alpha, beta);
      if (score < best) best = score;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}
