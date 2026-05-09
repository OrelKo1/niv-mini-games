export const ROUND_MS = 60_000;
export const BASE_SPEED = 90; // meters/sec
export const NIV_BASE_SPEED = 92; // slightly faster baseline so he COULD win — if he didn't trip
export const PLAYER_JUMP_DUR = 600; // ms airborne
export const PLAYER_STUMBLE_DUR = 700; // ms slow after hit
export const NIV_TRIP_DUR_MS = 1500; // ms flat-on-floor
export const OBSTACLE_GAP_MIN = 110; // meters between obstacles
export const OBSTACLE_GAP_MAX = 220;
export const PHANTOM_TRIP_PROB = 0.0006; // per tick — Niv trips on nothing
export const NIV_AI_REACH_M = 70; // ahead distance at which Niv "decides" about an obstacle

export type ObstacleType = "cone" | "rock" | "joint" | "bottle" | "pin" | "trash";
export type Lane = "player" | "niv";

export interface Obstacle {
  id: number;
  lane: Lane;
  pos: number; // meters from start (absolute)
  type: ObstacleType;
}

export interface Runner {
  distance: number; // meters traveled
  jumpUntil: number; // ms timestamp; 0 if grounded
  tripUntil: number; // ms; 0 if not tripping
  stumbleUntil: number; // ms; 0 if not stumbling
  trips: number;
  stumbles: number;
  thoughtBubble?: { text: string; until: number };
}

export interface RunNivState {
  startedAt: number;
  now: number;
  status: "idle" | "playing" | "over";
  player: Runner;
  niv: Runner;
  obstacles: Obstacle[];
  spawnAhead: number; // furthest meter we've spawned obstacles up to
  nextObstacleId: number;
  rng: () => number;
  finishedReason?: "timeup" | "playerout";
  // milestone-tracking flags (avoid re-firing)
  flags: {
    headbuttFired: boolean;
    phantomFired: boolean;
    flawlessImpossible: boolean;
    nivchainCount: number;
    lastNivCollideAt: number;
  };
}

export const NIV_BUBBLES = [
  "MOM CALLED",
  "TIED MY SHOE",
  "FELT A VIBE",
  "FORGOT WHY",
  "PHILOSOPHICAL CRISIS",
  "WAIT WHAT",
  "WHO PUT THIS HERE",
  "OW",
  "OW MY EVERYTHING",
  "I MEANT TO DO THAT",
  "GRAVITY: 1 NIV: 0",
  "MY ANCESTORS WALKED",
  "MAYBE TOMORROW",
  "I SAW A DOG",
  "OK BUT WHY",
];
