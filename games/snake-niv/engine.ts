import {
  GRID_SIZE,
  FOOD_POINTS,
  type Cell,
  type Dir,
  type Food,
  type FoodType,
  type RNG,
  type SnakeState,
} from "./types";

// ---------- RNG (mulberry32 — deterministic + seedable) ----------
export function makeRng(seed: number): RNG {
  let a = seed >>> 0;
  return {
    next: () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

// ---------- Dir helpers ----------
const DELTA: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

function isReverse(a: Dir, b: Dir): boolean {
  return (
    (a === "up" && b === "down") ||
    (a === "down" && b === "up") ||
    (a === "left" && b === "right") ||
    (a === "right" && b === "left")
  );
}

// ---------- Tick rate ----------
export function tickRate(score: number): number {
  const r = 8 + Math.floor(score / 100) * 0.5;
  return Math.min(16, r);
}

// ---------- Food spawning ----------
function rollFoodType(rng: RNG): FoodType {
  const r = rng.next();
  if (r < 0.05) return "golden";
  // remaining 0.95 split: joint 60%, falafel 25%, hummus 15%
  const r2 = rng.next();
  if (r2 < 0.6) return "joint";
  if (r2 < 0.85) return "falafel";
  return "hummus";
}

function spawnFood(snake: Cell[], rng: RNG): Food {
  // try random cells until one is free; fall back to scan.
  const occupied = new Set(snake.map((c) => `${c.x},${c.y}`));
  for (let i = 0; i < 200; i++) {
    const x = Math.floor(rng.next() * GRID_SIZE);
    const y = Math.floor(rng.next() * GRID_SIZE);
    if (!occupied.has(`${x},${y}`)) {
      return { x, y, type: rollFoodType(rng) };
    }
  }
  // grid full-ish — find first free
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (!occupied.has(`${x},${y}`)) return { x, y, type: rollFoodType(rng) };
    }
  }
  return { x: 0, y: 0, type: "joint" };
}

// ---------- Initial state ----------
export function createInitialState(rng: RNG): SnakeState {
  const cx = Math.floor(GRID_SIZE / 2);
  const cy = Math.floor(GRID_SIZE / 2);
  // 3-cell snake heading right
  const snake: Cell[] = [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
  const food = spawnFood(snake, rng);
  return {
    snake,
    dir: "right",
    pendingDir: "right",
    food,
    score: 0,
    status: "playing",
    tickCount: 0,
    jointsEaten: 0,
    falafelsEaten: 0,
    hummusEaten: 0,
    goldenEaten: 0,
    recentJointTimes: [],
    ateThisTick: null,
  };
}

// ---------- Input ----------
export function applyInput(state: SnakeState, dir: Dir): SnakeState {
  if (state.status !== "playing") return state;
  if (isReverse(state.dir, dir)) return state;
  return { ...state, pendingDir: dir };
}

// ---------- Step ----------
export function step(state: SnakeState, rng: RNG, nowMs: number): SnakeState {
  if (state.status !== "playing") return state;

  // commit pendingDir if it isn't a 180.
  const dir = isReverse(state.dir, state.pendingDir)
    ? state.dir
    : state.pendingDir;

  const head = state.snake[0];
  const { dx, dy } = DELTA[dir];
  const newHead: Cell = { x: head.x + dx, y: head.y + dy };

  // Wall collision
  if (
    newHead.x < 0 ||
    newHead.x >= GRID_SIZE ||
    newHead.y < 0 ||
    newHead.y >= GRID_SIZE
  ) {
    return {
      ...state,
      dir,
      status: "dead",
      death: { reason: "wall", lengthAtDeath: state.snake.length },
      ateThisTick: null,
      tickCount: state.tickCount + 1,
    };
  }

  const willEat =
    newHead.x === state.food.x && newHead.y === state.food.y;

  // Build the new body.
  // If we eat, the tail does NOT move (snake grows by 1).
  // Otherwise tail is removed.
  const newBody: Cell[] = [newHead, ...state.snake];
  if (!willEat) newBody.pop();

  // Self-collision: head against any body cell of the *resulting* snake (excluding head index 0).
  // When not eating, the tail just left, so it's safe to occupy.
  for (let i = 1; i < newBody.length; i++) {
    if (newBody[i].x === newHead.x && newBody[i].y === newHead.y) {
      return {
        ...state,
        dir,
        snake: state.snake, // don't actually move into body — preserve original
        status: "dead",
        death: { reason: "self", lengthAtDeath: state.snake.length },
        ateThisTick: null,
        tickCount: state.tickCount + 1,
      };
    }
  }

  let score = state.score;
  let food = state.food;
  let jointsEaten = state.jointsEaten;
  let falafelsEaten = state.falafelsEaten;
  let hummusEaten = state.hummusEaten;
  let goldenEaten = state.goldenEaten;
  let recentJointTimes = state.recentJointTimes;
  let ateThisTick: FoodType | null = null;

  if (willEat) {
    const t = state.food.type;
    score += FOOD_POINTS[t];
    ateThisTick = t;
    if (t === "joint") jointsEaten += 1;
    else if (t === "falafel") falafelsEaten += 1;
    else if (t === "hummus") hummusEaten += 1;
    else if (t === "golden") goldenEaten += 1;

    if (t === "joint") {
      const cutoff = nowMs - 30_000;
      recentJointTimes = [...recentJointTimes.filter((tt) => tt >= cutoff), nowMs];
    }
    food = spawnFood(newBody, rng);
  }

  return {
    ...state,
    snake: newBody,
    dir,
    pendingDir: dir,
    food,
    score,
    tickCount: state.tickCount + 1,
    jointsEaten,
    falafelsEaten,
    hummusEaten,
    goldenEaten,
    recentJointTimes,
    ateThisTick,
  };
}
