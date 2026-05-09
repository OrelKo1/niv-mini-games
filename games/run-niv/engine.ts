import {
  BASE_SPEED,
  NIV_BASE_SPEED,
  NIV_AI_REACH_M,
  NIV_BUBBLES,
  NIV_TRIP_DUR_MS,
  OBSTACLE_GAP_MAX,
  OBSTACLE_GAP_MIN,
  PHANTOM_TRIP_PROB,
  PLAYER_JUMP_DUR,
  PLAYER_STUMBLE_DUR,
  ROUND_MS,
  type Lane,
  type Obstacle,
  type ObstacleType,
  type RunNivState,
  type Runner,
} from "./types";

export const PLAYER_LANE: Lane = "player";
export const NIV_LANE: Lane = "niv";

const OBSTACLE_TYPES: ObstacleType[] = [
  "cone",
  "rock",
  "joint",
  "bottle",
  "pin",
  "trash",
];

const COLLISION_RADIUS_M = 6;

const blank = (): Runner => ({
  distance: 0,
  jumpUntil: 0,
  tripUntil: 0,
  stumbleUntil: 0,
  trips: 0,
  stumbles: 0,
});

export function createInitialState(rng: () => number = Math.random): RunNivState {
  return {
    startedAt: 0,
    now: 0,
    status: "idle",
    player: blank(),
    niv: blank(),
    obstacles: [],
    spawnAhead: 80,
    nextObstacleId: 1,
    rng,
    flags: {
      headbuttFired: false,
      phantomFired: false,
      flawlessImpossible: false,
      nivchainCount: 0,
      lastNivCollideAt: -1e9,
    },
  };
}

export function startGame(state: RunNivState, now: number): RunNivState {
  return {
    ...createInitialState(state.rng),
    startedAt: now,
    now,
    status: "playing",
  };
}

export function jump(state: RunNivState, now: number): RunNivState {
  if (state.status !== "playing") return state;
  if (state.player.tripUntil > now || state.player.stumbleUntil > now) return state;
  if (state.player.jumpUntil > now) return state; // already in air
  return {
    ...state,
    player: { ...state.player, jumpUntil: now + PLAYER_JUMP_DUR },
  };
}

function spawnObstaclesIfNeeded(state: RunNivState, ahead: number) {
  const target = ahead + 600;
  while (state.spawnAhead < target) {
    const gap =
      OBSTACLE_GAP_MIN +
      state.rng() * (OBSTACLE_GAP_MAX - OBSTACLE_GAP_MIN);
    state.spawnAhead += gap;
    const lane: Lane = state.rng() < 0.5 ? PLAYER_LANE : NIV_LANE;
    const type =
      OBSTACLE_TYPES[Math.floor(state.rng() * OBSTACLE_TYPES.length)];
    state.obstacles.push({
      id: state.nextObstacleId++,
      lane,
      pos: state.spawnAhead,
      type,
    });
  }
}

function nextObstacleAhead(
  state: RunNivState,
  lane: Lane,
  fromMeters: number
): Obstacle | undefined {
  let best: Obstacle | undefined;
  for (const o of state.obstacles) {
    if (o.lane !== lane) continue;
    if (o.pos < fromMeters) continue;
    if (!best || o.pos < best.pos) best = o;
  }
  return best;
}

function pruneObstacles(state: RunNivState, behind: number) {
  state.obstacles = state.obstacles.filter((o) => o.pos > behind - 30);
}

export interface StepResult {
  state: RunNivState;
  events: Array<
    | { kind: "player-stumble" }
    | { kind: "niv-trip"; reason: "obstacle" | "phantom" }
    | { kind: "obstacle-passed"; lane: Lane; type: ObstacleType }
    | { kind: "round-end" }
  >;
}

export function step(state: RunNivState, now: number): RunNivState {
  return stepWithEvents(state, now).state;
}

export function stepWithEvents(state: RunNivState, now: number): StepResult {
  const events: StepResult["events"] = [];
  if (state.status !== "playing") return { state, events };

  const dt = Math.max(0, now - state.now);
  const dtSec = dt / 1000;

  // Speed factors
  const playerActive =
    state.player.tripUntil <= now && state.player.stumbleUntil <= now;
  const playerSpeed = playerActive ? BASE_SPEED : BASE_SPEED * 0.35;

  const nivActive = state.niv.tripUntil <= now;
  const nivSpeed = nivActive ? NIV_BASE_SPEED : 0;

  const newPlayerDist = state.player.distance + playerSpeed * dtSec;
  const newNivDist = state.niv.distance + nivSpeed * dtSec;

  const newPlayer: Runner = { ...state.player, distance: newPlayerDist };
  const newNiv: Runner = { ...state.niv, distance: newNivDist };

  // Maintain obstacle stream
  const farthest = Math.max(newPlayerDist, newNivDist);
  const next: RunNivState = {
    ...state,
    now,
    player: newPlayer,
    niv: newNiv,
  };
  spawnObstaclesIfNeeded(next, farthest);

  // Player collision check (lane-specific)
  for (const o of next.obstacles) {
    if (o.lane !== PLAYER_LANE) continue;
    const reached = state.player.distance < o.pos && newPlayerDist >= o.pos;
    if (!reached) continue;
    const airborne = newPlayer.jumpUntil > now;
    if (airborne) {
      events.push({ kind: "obstacle-passed", lane: PLAYER_LANE, type: o.type });
      continue;
    }
    newPlayer.stumbles += 1;
    newPlayer.stumbleUntil = now + PLAYER_STUMBLE_DUR;
    events.push({ kind: "player-stumble" });
  }

  // Niv AI: decide on obstacles ahead
  if (nivActive) {
    const upcoming = nextObstacleAhead(next, NIV_LANE, newNivDist - 1);
    if (upcoming && upcoming.pos - newNivDist < NIV_AI_REACH_M) {
      const distToObstacle = upcoming.pos - newNivDist;
      const reached = distToObstacle <= 2;
      if (reached) {
        // 30% he times the jump (skip), 70% he eats it
        const r = state.rng();
        if (r < 0.3) {
          events.push({ kind: "obstacle-passed", lane: NIV_LANE, type: upcoming.type });
          // remove it so we don't re-fire
          next.obstacles = next.obstacles.filter((x) => x.id !== upcoming.id);
        } else {
          newNiv.tripUntil = now + NIV_TRIP_DUR_MS;
          newNiv.trips += 1;
          newNiv.thoughtBubble = {
            text: NIV_BUBBLES[Math.floor(state.rng() * NIV_BUBBLES.length)],
            until: now + NIV_TRIP_DUR_MS,
          };
          events.push({ kind: "niv-trip", reason: "obstacle" });
          next.obstacles = next.obstacles.filter((x) => x.id !== upcoming.id);
        }
      }
    }

    // Phantom trip — Niv falls on nothing
    if (state.rng() < PHANTOM_TRIP_PROB * Math.max(1, dt / 16)) {
      newNiv.tripUntil = now + NIV_TRIP_DUR_MS;
      newNiv.trips += 1;
      newNiv.thoughtBubble = {
        text: NIV_BUBBLES[Math.floor(state.rng() * NIV_BUBBLES.length)],
        until: now + NIV_TRIP_DUR_MS,
      };
      events.push({ kind: "niv-trip", reason: "phantom" });
    }
  }

  pruneObstacles(next, Math.min(newPlayerDist, newNivDist));

  // Round end
  if (now - next.startedAt >= ROUND_MS) {
    next.status = "over";
    next.finishedReason = "timeup";
    events.push({ kind: "round-end" });
  }

  return { state: next, events };
}
