export const HOLE_COUNT = 9; // 3x3
export const ROUND_MS = 30_000;

/** Lifespan a freshly spawned head sticks around for, in ms. */
export const HEAD_TTL_MIN = 800;
export const HEAD_TTL_MAX = 1100;

/** Probability per tick (assumed ~60Hz) of attempting a spawn in an empty hole. */
export const SPAWN_P_PER_TICK = 0.04;

/** Window in ms after spawn where a hit counts as "pre-crime". */
export const PRECRIME_WINDOW_MS = 100;

/** A hit within this many ms of the deadline is treated as the "final hit". */
export const FINAL_HIT_WINDOW_MS = 5_000;

export const THOUGHT_BUBBLES: readonly string[] = [
  "ow",
  "stop",
  "i'm trying",
  "leave me alone",
  "pls",
  "no",
  "k",
  "🚬",
  "rude",
  "i felt that",
  "rude.",
  "really?",
] as const;

export type WhackStatus = "idle" | "playing" | "over";

export interface Hole {
  id: number; // 0..8
  occupied: boolean;
  /** ms timestamp when the head should despawn if not whacked */
  expiresAt?: number;
  /** ms timestamp when this head spawned (used for pre-crime detection) */
  spawnedAt?: number;
  /** Random thought-bubble text to render above the head. */
  thoughtBubble?: string;
}

export interface WhackState {
  status: WhackStatus;
  holes: Hole[];
  score: number;
  hits: number;
  misses: number;
  combo: number;
  /** Highest combo reached this game (used to drive combo milestones once). */
  maxCombo: number;
  /** Consecutive misses (resets to 0 on any hit). */
  missStreak: number;
  /** Highest miss-streak reached this game. */
  maxMissStreak: number;
  startedAt: number;
  deadline: number;
  /** ms timestamp of the last miss (for perfect-5s window). 0 = no miss yet. */
  lastMissAt: number;
  /** Whether the player has already triggered the perfect-5s milestone this game. */
  perfect5sFired: boolean;
  /** Whether the very last whack registered was a hit (for whack:finalhit at game over). */
  lastWhackWasHit: boolean;
  /** Whether any pre-crime hit happened this game. */
  precrimeFired: boolean;
}

export interface WhackResult {
  hit: boolean;
  /** True if the hit was within PRECRIME_WINDOW_MS of spawn. */
  precrime: boolean;
}
