import { describe, it, expect } from "vitest";
import { createInitialState, startGame, step, whack } from "./engine";
import { HOLE_COUNT, ROUND_MS, type WhackState } from "./types";

function rngSeq(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

function withPlaying(now = 0): WhackState {
  return startGame(now);
}

describe("whack-a-niv engine", () => {
  it("tick spawns at most one head and despawns expired heads", () => {
    // RNG seq: first call < SPAWN_P (0.04) so we attempt spawn,
    // second call picks hole 0, third call picks ttl, fourth picks bubble.
    let s = withPlaying(0);
    const rng = rngSeq([0.001, 0, 0, 0]);
    s = step(s, 16, rng);
    const occupied = s.holes.filter((h) => h.occupied);
    expect(occupied.length).toBe(1);
    const head = occupied[0];
    expect(head.expiresAt).toBeGreaterThan(16);
    expect(head.thoughtBubble).toBeTruthy();

    // Now advance past the expiry; rng forces no new spawn (>0.04).
    const expireTime = head.expiresAt! + 1;
    const rng2 = rngSeq([0.99]);
    s = step(s, expireTime, rng2);
    expect(s.holes.every((h) => !h.occupied)).toBe(true);
  });

  it("whack on active hole increments score, hits, combo", () => {
    let s = withPlaying(0);
    // Seed a head in hole 3 manually (engine is pure; this is the cleanest probe).
    s = {
      ...s,
      holes: s.holes.map((h) =>
        h.id === 3
          ? {
              id: 3,
              occupied: true,
              spawnedAt: 0,
              expiresAt: 1000,
              thoughtBubble: "ow",
            }
          : h
      ),
    };

    const r1 = whack(s, 3, 50);
    expect(r1.result.hit).toBe(true);
    expect(r1.state.hits).toBe(1);
    expect(r1.state.combo).toBe(1);
    expect(r1.state.score).toBe(10); // 10 * combo (1)
    expect(r1.state.holes[3].occupied).toBe(false);

    // Stack another head and confirm combo increments score multiplier.
    let s2: WhackState = {
      ...r1.state,
      holes: r1.state.holes.map((h) =>
        h.id === 5
          ? {
              id: 5,
              occupied: true,
              spawnedAt: 60,
              expiresAt: 1060,
              thoughtBubble: "k",
            }
          : h
      ),
    };
    const r2 = whack(s2, 5, 80);
    expect(r2.result.hit).toBe(true);
    expect(r2.state.combo).toBe(2);
    expect(r2.state.hits).toBe(2);
    // Score gained on this whack = 10 * 2 = 20, total = 30.
    expect(r2.state.score).toBe(30);
  });

  it("whack on empty hole resets combo and increments misses", () => {
    let s = withPlaying(0);
    // Build up a combo first via a synthetic head + hit.
    s = {
      ...s,
      holes: s.holes.map((h) =>
        h.id === 2
          ? { id: 2, occupied: true, spawnedAt: 0, expiresAt: 1000 }
          : h
      ),
    };
    const hit = whack(s, 2, 10);
    expect(hit.state.combo).toBe(1);

    // Now whack an empty hole.
    const miss = whack(hit.state, 7, 50);
    expect(miss.result.hit).toBe(false);
    expect(miss.state.combo).toBe(0);
    expect(miss.state.misses).toBe(1);
    expect(miss.state.missStreak).toBe(1);
    expect(miss.state.lastMissAt).toBe(50);
    expect(miss.state.lastWhackWasHit).toBe(false);
  });

  it("status flips to over when now >= deadline", () => {
    let s = withPlaying(0);
    expect(s.status).toBe("playing");
    expect(s.deadline).toBe(ROUND_MS);

    // Just before deadline -> still playing.
    const rng = rngSeq([0.99]);
    s = step(s, ROUND_MS - 1, rng);
    expect(s.status).toBe("playing");

    // At deadline -> over.
    s = step(s, ROUND_MS, rng);
    expect(s.status).toBe("over");

    // Subsequent steps are no-ops.
    const before = s;
    s = step(s, ROUND_MS + 5_000, rng);
    expect(s).toEqual(before);
  });

  it("createInitialState produces 9 empty holes and idle status", () => {
    const s = createInitialState(0);
    expect(s.holes.length).toBe(HOLE_COUNT);
    expect(s.holes.every((h) => !h.occupied)).toBe(true);
    expect(s.status).toBe("idle");
  });
});
