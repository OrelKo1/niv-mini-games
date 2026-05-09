export const FIELD_W = 360;
export const FIELD_H = 540;

export const PADDLE_Y = 510;
export const PADDLE_BASE_W = 64;
export const PADDLE_H = 10;

export const BALL_R = 4;
export const BALL_BASE_SPEED = 0.18; // px/ms

export const BRICK_ROWS = 5;
export const BRICK_COLS = 8;
export const BRICK_W = 40;
export const BRICK_H = 16;
export const BRICK_TOP_PAD = 50;
export const BRICK_LEFT_PAD = 20;
export const BRICK_GAP = 4;

export const POWERUP_DROP_VY = 0.08; // px/ms
export const POWERUP_SIZE = 12;
export const POWERUP_DURATION_MS = 10_000;

export const SCORE_PER_BREAK = 10;

export const BRICK_LABELS = [
  "Pay rent",
  "Reply to mom",
  "Gym",
  "Taxes",
  "Therapy",
  "Diet",
  "Sleep",
  "Job",
  "Email",
  "Mom",
] as const;

export const ADULTING_LABELS = ["Pay rent", "Reply to mom", "Gym", "Taxes"] as const;

export type BrickLabel = (typeof BRICK_LABELS)[number];

export type PowerUpKind = "multi-ball" | "wide-paddle" | "slow-ball" | "joint";

export type Status = "idle" | "playing" | "gameover" | "cleared";

export interface Paddle {
  x: number; // center x
  y: number;
  width: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Brick {
  x: number; // top-left
  y: number;
  w: number;
  h: number;
  label: string;
  hp: number;
  maxHp: number;
  dropsPowerUp: boolean;
}

export interface PowerUpDrop {
  x: number;
  y: number;
  vy: number;
  kind: PowerUpKind;
}

export interface BrickEvents {
  brokenBricks: { label: string; powerUp: PowerUpKind | null }[];
  collectedPowerUps: PowerUpKind[];
  ballsLostThisStep: number;
}

export interface BrickState {
  paddle: Paddle;
  balls: Ball[];
  bricks: Brick[];
  powerUps: PowerUpDrop[];
  score: number;
  lives: number;
  level: number;
  status: Status;
  /** ms accumulated while ≥2 balls are in play */
  multiBallActiveMs: number;
  /** active power-up timers */
  effects: {
    widePaddleMs: number;
    slowBallMs: number;
  };
  /** events emitted on the latest step (consumed by the React layer) */
  events: BrickEvents;
  /** ms since current round/level started */
  roundElapsedMs: number;
  /** brick break timestamps (ms relative to round start), used for combo detection */
  recentBreakTimes: number[];
  /** adulting labels smashed this game */
  adultingSmashed: string[];
  /** field dimensions */
  fieldW: number;
  fieldH: number;
}
