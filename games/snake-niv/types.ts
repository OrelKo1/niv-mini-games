export const GRID_SIZE = 15;

export type Dir = "up" | "down" | "left" | "right";
export type Status = "playing" | "dead";
export type FoodType = "joint" | "falafel" | "hummus" | "golden";

export interface Cell {
  x: number;
  y: number;
}

export interface Food extends Cell {
  type: FoodType;
}

export interface DeathCause {
  reason: "wall" | "self";
  lengthAtDeath: number;
}

export interface SnakeState {
  snake: Cell[]; // index 0 = head
  dir: Dir;
  pendingDir: Dir;
  food: Food;
  score: number;
  status: Status;
  tickCount: number;
  /** running totals to drive milestones */
  jointsEaten: number;
  falafelsEaten: number;
  hummusEaten: number;
  goldenEaten: number;
  /** ring-buffer of joint-eat timestamps (ms) — for snake:burst:10in30 */
  recentJointTimes: number[];
  /** populated when status === 'dead' */
  death?: DeathCause;
  /** set when food is eaten on the latest step (for renderer-side achievement triggers) */
  ateThisTick?: FoodType | null;
}

export interface RNG {
  next: () => number; // [0,1)
}

export const FOOD_POINTS: Record<FoodType, number> = {
  joint: 10,
  falafel: 20,
  hummus: 50,
  golden: 500,
};
