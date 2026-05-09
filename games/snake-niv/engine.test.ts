import { describe, it, expect } from "vitest";
import {
  createInitialState,
  step,
  applyInput,
  tickRate,
  makeRng,
} from "./engine";
import { GRID_SIZE } from "./types";
import type { SnakeState, Food } from "./types";

// Helper: force-place food at a known cell to make tests deterministic
function placeFood(state: SnakeState, food: Food): SnakeState {
  return { ...state, food };
}

describe("snake-niv engine", () => {
  it("step moves snake one cell in dir", () => {
    const rng = makeRng(1);
    let s = createInitialState(rng);
    // head starts somewhere; after one step in dir it should advance one cell
    const headBefore = { ...s.snake[0] };
    s = step(s, rng, 0);
    const headAfter = s.snake[0];
    // exactly one of dx/dy is +/-1
    const dx = headAfter.x - headBefore.x;
    const dy = headAfter.y - headBefore.y;
    expect(Math.abs(dx) + Math.abs(dy)).toBe(1);
  });

  it("eating food grows snake by 1 and increases score", () => {
    const rng = makeRng(2);
    let s = createInitialState(rng);
    // Move state so that the cell directly in dir from head is the food.
    const head = s.snake[0];
    let nx = head.x;
    let ny = head.y;
    if (s.dir === "right") nx = head.x + 1;
    else if (s.dir === "left") nx = head.x - 1;
    else if (s.dir === "down") ny = head.y + 1;
    else ny = head.y - 1;
    s = placeFood(s, { x: nx, y: ny, type: "joint" });
    const lenBefore = s.snake.length;
    const scoreBefore = s.score;
    s = step(s, rng, 0);
    expect(s.snake.length).toBe(lenBefore + 1);
    expect(s.score).toBe(scoreBefore + 10);
    expect(s.status).toBe("playing");
  });

  it("head into wall sets status=dead", () => {
    const rng = makeRng(3);
    // place a snake at the right edge moving right
    let s: SnakeState = {
      snake: [{ x: GRID_SIZE - 1, y: 5 }],
      dir: "right",
      pendingDir: "right",
      food: { x: 0, y: 0, type: "joint" },
      score: 0,
      status: "playing",
      tickCount: 0,
      jointsEaten: 0,
      falafelsEaten: 0,
      hummusEaten: 0,
      goldenEaten: 0,
      recentJointTimes: [],
    };
    s = step(s, rng, 0);
    expect(s.status).toBe("dead");
    expect(s.death?.reason).toBe("wall");
  });

  it("head into body sets status=dead", () => {
    const rng = makeRng(4);
    // 5-segment snake. head=(5,5); body wraps: (4,5),(4,6),(5,6),(6,6).
    // dir=down -> head moves to (5,6), which is a non-tail body cell. The tail
    // at (6,6) leaves but (5,6) remains — true self-collision.
    let s: SnakeState = {
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 4, y: 6 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
      ],
      dir: "down",
      pendingDir: "down",
      food: { x: 0, y: 0, type: "joint" },
      score: 0,
      status: "playing",
      tickCount: 0,
      jointsEaten: 0,
      falafelsEaten: 0,
      hummusEaten: 0,
      goldenEaten: 0,
      recentJointTimes: [],
    };
    s = step(s, rng, 0);
    expect(s.status).toBe("dead");
    expect(s.death?.reason).toBe("self");
  });

  it("pendingDir applied next tick, 180-degree reverse rejected", () => {
    const rng = makeRng(5);
    let s = createInitialState(rng);
    // Force a known dir
    s = { ...s, dir: "right", pendingDir: "right" };
    // applyInput rejects 180
    s = applyInput(s, "left");
    expect(s.pendingDir).toBe("right");
    // applyInput accepts perpendicular
    s = applyInput(s, "up");
    expect(s.pendingDir).toBe("up");
    // step picks up pendingDir
    const pending = s.pendingDir;
    s = step(s, rng, 0);
    expect(s.dir).toBe(pending);
  });

  it("golden food gives 500 points", () => {
    const rng = makeRng(6);
    let s = createInitialState(rng);
    const head = s.snake[0];
    let nx = head.x;
    let ny = head.y;
    if (s.dir === "right") nx = head.x + 1;
    else if (s.dir === "left") nx = head.x - 1;
    else if (s.dir === "down") ny = head.y + 1;
    else ny = head.y - 1;
    s = placeFood(s, { x: nx, y: ny, type: "golden" });
    const before = s.score;
    s = step(s, rng, 0);
    expect(s.score).toBe(before + 500);
    expect(s.goldenEaten).toBe(1);
  });

  it("tickRate scales with score and caps at 16", () => {
    expect(tickRate(0)).toBe(8);
    expect(tickRate(100)).toBe(8.5);
    expect(tickRate(1000)).toBe(13);
    expect(tickRate(100000)).toBe(16);
  });
});
