import { describe, it, expect } from "vitest";
import {
  createInitialState,
  startGame,
  step,
  jump,
  PLAYER_LANE,
  NIV_LANE,
} from "./engine";
import { ROUND_MS, BASE_SPEED, NIV_TRIP_DUR_MS } from "./types";

const seedRng = (seed = 0.4) => {
  let x = seed;
  return () => {
    x = (x * 16807 + 1) % 2147483647;
    return x / 2147483647;
  };
};

describe("run-niv engine", () => {
  it("createInitialState produces idle status with both runners at 0", () => {
    const s = createInitialState(seedRng());
    expect(s.status).toBe("idle");
    expect(s.player.distance).toBe(0);
    expect(s.niv.distance).toBe(0);
  });

  it("startGame flips status to playing and stamps startedAt", () => {
    const s0 = createInitialState(seedRng());
    const s1 = startGame(s0, 1000);
    expect(s1.status).toBe("playing");
    expect(s1.startedAt).toBe(1000);
  });

  it("step advances both runners by base speed when grounded", () => {
    let s = startGame(createInitialState(seedRng()), 0);
    s = step(s, 1000);
    // 1 second of travel — player baseline ~ 90m, niv ~ 92m (modulo trips)
    expect(s.player.distance).toBeGreaterThan(80);
    expect(s.player.distance).toBeLessThan(100);
  });

  it("jump sets jumpUntil and prevents collision with an obstacle in the air", () => {
    let s = startGame(createInitialState(seedRng()), 0);
    // Force an obstacle right ahead of the player
    s.obstacles.push({
      id: 999,
      lane: PLAYER_LANE,
      pos: s.player.distance + 4,
      type: "cone",
    });
    s = jump(s, 0);
    expect(s.player.jumpUntil).toBeGreaterThan(0);
    s = step(s, 50);
    s = step(s, 100);
    s = step(s, 150);
    // No stumble triggered while airborne
    expect(s.player.stumbleUntil).toBe(0);
  });

  it("player who hits obstacle without jumping enters stumble", () => {
    let s = startGame(createInitialState(seedRng()), 0);
    s.obstacles.push({
      id: 999,
      lane: PLAYER_LANE,
      pos: s.player.distance + 4,
      type: "rock",
    });
    s = step(s, 80); // advance enough to collide
    s = step(s, 160);
    expect(s.player.stumbles).toBeGreaterThan(0);
    expect(s.player.stumbleUntil).toBeGreaterThan(s.now - 50);
  });

  it("niv tripping freezes his distance for NIV_TRIP_DUR_MS", () => {
    let s = startGame(createInitialState(seedRng()), 0);
    // Force a niv trip
    s.niv.tripUntil = s.now + NIV_TRIP_DUR_MS;
    const distBefore = s.niv.distance;
    s = step(s, 800);
    expect(s.niv.distance).toBeCloseTo(distBefore, 0);
  });

  it("status flips to 'over' at ROUND_MS elapsed", () => {
    let s = startGame(createInitialState(seedRng()), 0);
    s = step(s, ROUND_MS - 100);
    expect(s.status).toBe("playing");
    s = step(s, ROUND_MS + 50);
    expect(s.status).toBe("over");
  });

  it("at full base speed for a full round, player can out-distance baseline", () => {
    let s = startGame(createInitialState(seedRng()), 0);
    // crank through the round
    for (let t = 100; t < ROUND_MS + 100; t += 100) {
      s = step(s, t);
    }
    // Player baseline 90 m/s for 60s = 5400m, modulo stumbles. Should clear 1000m easily.
    expect(s.player.distance).toBeGreaterThan(1000);
  });

  it("PLAYER_LANE and NIV_LANE are distinct", () => {
    expect(PLAYER_LANE).not.toEqual(NIV_LANE);
  });

  it("base speed constant is exposed", () => {
    expect(BASE_SPEED).toBeGreaterThan(0);
  });
});
