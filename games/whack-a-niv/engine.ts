import type { NivAsset } from "@/lib/niv-types";
import {
  HEAD_TTL_MAX,
  HEAD_TTL_MIN,
  HOLE_COUNT,
  PRECRIME_WINDOW_MS,
  ROUND_MS,
  SPAWN_P_END,
  SPAWN_P_START,
  THOUGHT_BUBBLES,
  type Hole,
  type WhackResult,
  type WhackState,
} from "./types";

export type RNG = () => number; // [0,1)

function freshHoles(): Hole[] {
  return Array.from({ length: HOLE_COUNT }, (_, id) => ({
    id,
    occupied: false,
  }));
}

export function createInitialState(now: number): WhackState {
  return {
    status: "idle",
    holes: freshHoles(),
    score: 0,
    hits: 0,
    misses: 0,
    combo: 0,
    maxCombo: 0,
    missStreak: 0,
    maxMissStreak: 0,
    startedAt: now,
    deadline: now + ROUND_MS,
    lastMissAt: 0,
    perfect5sFired: false,
    lastWhackWasHit: false,
    precrimeFired: false,
  };
}

export function startGame(now: number): WhackState {
  return {
    ...createInitialState(now),
    status: "playing",
  };
}

/** Pure tick: despawns expired heads and (with probability) spawns one new head. */
export function step(
  state: WhackState,
  now: number,
  rng: RNG,
  pickAsset: () => NivAsset
): WhackState {
  if (state.status !== "playing") return state;

  // End of round
  if (now >= state.deadline) {
    return { ...state, status: "over" };
  }

  // Despawn expired heads (treat unwhacked despawns the same way the player
  // sees them — they go away. We don't count them as misses.)
  let holes = state.holes.map((h) => {
    if (h.occupied && h.expiresAt !== undefined && now >= h.expiresAt) {
      return { id: h.id, occupied: false } as Hole;
    }
    return h;
  });

  // Ramped spawn probability: starts low, ends high over ROUND_MS.
  const elapsed = state.startedAt ? Math.max(0, now - state.startedAt) : 0;
  const t = Math.min(1, elapsed / ROUND_MS);
  const p = SPAWN_P_START + (SPAWN_P_END - SPAWN_P_START) * t;

  // Try to spawn at most one head per tick.
  if (rng() < p) {
    const empties: number[] = [];
    for (const h of holes) if (!h.occupied) empties.push(h.id);
    if (empties.length > 0) {
      const pickIdx = Math.floor(rng() * empties.length);
      const target = empties[Math.min(pickIdx, empties.length - 1)];
      const ttl =
        HEAD_TTL_MIN + Math.floor(rng() * (HEAD_TTL_MAX - HEAD_TTL_MIN + 1));
      const bubbleIdx = Math.floor(rng() * THOUGHT_BUBBLES.length);
      const newAsset = pickAsset();
      holes = holes.map((h) =>
        h.id === target
          ? {
              id: h.id,
              occupied: true,
              spawnedAt: now,
              expiresAt: now + ttl,
              thoughtBubble:
                THOUGHT_BUBBLES[Math.min(bubbleIdx, THOUGHT_BUBBLES.length - 1)],
              asset: newAsset,
            }
          : h
      );
    }
  }

  return { ...state, holes };
}

/** Pure: register a whack on hole index `holeIdx` at time `now`. */
export function whack(
  state: WhackState,
  holeIdx: number,
  now: number
): { state: WhackState; result: WhackResult } {
  if (state.status !== "playing") {
    return { state, result: { hit: false, precrime: false } };
  }
  const target = state.holes.find((h) => h.id === holeIdx);
  if (!target) {
    return { state, result: { hit: false, precrime: false } };
  }

  if (target.occupied) {
    const newCombo = state.combo + 1;
    const score = state.score + 10 * newCombo;
    const precrime =
      target.spawnedAt !== undefined &&
      now - target.spawnedAt <= PRECRIME_WINDOW_MS;

    const holes = state.holes.map((h) =>
      h.id === holeIdx ? { id: h.id, occupied: false } : h
    );

    let perfect5sFired = state.perfect5sFired;
    if (
      !perfect5sFired &&
      state.lastMissAt > 0 &&
      now - state.lastMissAt >= 5_000
    ) {
      perfect5sFired = true;
    }

    return {
      state: {
        ...state,
        holes,
        score,
        hits: state.hits + 1,
        combo: newCombo,
        maxCombo: Math.max(state.maxCombo, newCombo),
        missStreak: 0,
        lastWhackWasHit: true,
        perfect5sFired,
        precrimeFired: state.precrimeFired || precrime,
      },
      result: { hit: true, precrime },
    };
  }

  // Miss: empty hole tap
  const newMissStreak = state.missStreak + 1;
  return {
    state: {
      ...state,
      misses: state.misses + 1,
      combo: 0,
      missStreak: newMissStreak,
      maxMissStreak: Math.max(state.maxMissStreak, newMissStreak),
      lastMissAt: now,
      lastWhackWasHit: false,
    },
    result: { hit: false, precrime: false },
  };
}

/** Convenience: standard Math.random RNG. */
export const defaultRng: RNG = () => Math.random();
