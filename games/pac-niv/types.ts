import type { TileKind } from "./maze";

export type Dir = "up" | "down" | "left" | "right";

export type GhostKind = "cop" | "ex" | "landlord" | "mom";

export type GhostMode = "scatter" | "chase" | "scared" | "eaten";

export interface Ghost {
  kind: GhostKind;
  x: number;
  y: number;
  dir: Dir;
  mode: GhostMode;
  scaredUntilMs: number; // absolute game time when scared expires
  homeCorner: { x: number; y: number };
  spawn: { x: number; y: number };
  // tracking flags for milestones
  everEaten: boolean;
}

export interface PacNivState {
  // grid state
  tiles: TileKind[][];
  width: number;
  height: number;
  pelletsRemaining: number;
  // player
  player: { x: number; y: number; dir: Dir; pendingDir: Dir | null };
  spawn: { x: number; y: number };
  // ghosts
  ghosts: Ghost[];
  // gameplay
  score: number;
  lives: number;
  level: number;
  speed: number; // multiplier on tick rate, 1 + 0.05*(level-1)
  // power pellet chain
  ghostChainEatenInPower: number;
  ghostsEatenThisGame: number;
  // run timers (game-internal "now" in ms)
  nowMs: number;
  modeStartedMs: number;
  currentScheduledMode: "scatter" | "chase";
  scheduleIndex: number; // index into mode schedule
  scaredEndMs: number; // 0 if not scared
  // milestone bookkeeping
  powerPelletsEaten: number;
  jointsEatenCumulative: number; // session-only counter; store layer can extend
  fourChainStartedMs: number; // when current ghost-chain began
  diedThisLevel: boolean;
  diedEver: boolean;
  copNearLastSeenMs: number; // last time cop was within "near" distance
  // game flags
  gameOver: boolean;
  won: boolean;
}

export interface MilestoneEmit {
  type: string;
  /** optional payload */
  payload?: Record<string, unknown>;
}

export interface StepResult {
  /** milestones that fired this step (caller decides what to do) */
  milestones: string[];
  /** true if the player died this step */
  died: boolean;
  /** true if a level was cleared this step */
  levelCleared: boolean;
}
