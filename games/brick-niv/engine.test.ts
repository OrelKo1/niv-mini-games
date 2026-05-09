import { describe, it, expect } from "vitest";
import { start, step, applyPowerUp } from "./engine";
import { FIELD_W, FIELD_H, PADDLE_Y } from "./types";
import type { BrickState, Ball } from "./types";

function blank(level = 1): BrickState {
  return start(level);
}

describe("brick-niv engine", () => {
  it("ball reflects off walls (x flips when hitting left/right; y flips on top)", () => {
    const s = blank();
    // Place a single ball heading into the right wall
    const ball: Ball = { x: FIELD_W - 1, y: 200, vx: 0.2, vy: 0 };
    s.balls = [ball];
    s.bricks = []; // no bricks for this test
    step(s, 16);
    expect(s.balls[0].vx).toBeLessThan(0); // reflected to negative

    // Left wall
    const s2 = blank();
    s2.balls = [{ x: 0.5, y: 200, vx: -0.2, vy: 0 }];
    s2.bricks = [];
    step(s2, 16);
    expect(s2.balls[0].vx).toBeGreaterThan(0);

    // Top wall
    const s3 = blank();
    s3.balls = [{ x: 100, y: 0.5, vx: 0, vy: -0.2 }];
    s3.bricks = [];
    step(s3, 16);
    expect(s3.balls[0].vy).toBeGreaterThan(0);
  });

  it("ball breaking a brick reduces hp and removes when zero", () => {
    const s = blank();
    s.bricks = [
      {
        x: 100,
        y: 100,
        w: 40,
        h: 16,
        label: "Job",
        hp: 2,
        maxHp: 2,
        dropsPowerUp: false,
      },
    ];
    // Ball positioned just below brick moving up into it
    s.balls = [{ x: 120, y: 120, vx: 0, vy: -0.4 }];
    step(s, 16);
    // After collision with hp=2 brick, hp should be 1, not removed yet
    expect(s.bricks.length).toBe(1);
    expect(s.bricks[0].hp).toBe(1);

    // Hit it again with another upward ball — this break adds score
    s.balls = [{ x: 120, y: 120, vx: 0, vy: -0.4 }];
    step(s, 16);
    expect(s.bricks.length).toBe(0);
    expect(s.score).toBe(10);
  });

  it("ball below paddle.y decrements lives or removes ball appropriately", () => {
    const s = blank();
    // Two balls: one safely on screen, one below paddle
    s.balls = [
      { x: 100, y: 100, vx: 0.1, vy: 0.1 },
      { x: 200, y: PADDLE_Y + 60, vx: 0, vy: 0.1 },
    ];
    const livesBefore = s.lives;
    step(s, 16);
    expect(s.balls.length).toBe(1);
    // lives should NOT decrement because balls remain
    expect(s.lives).toBe(livesBefore);

    // Now drop the last ball
    s.balls = [{ x: 100, y: PADDLE_Y + 80, vx: 0, vy: 0.1 }];
    step(s, 16);
    expect(s.lives).toBe(livesBefore - 1);
    // ball respawned on paddle
    expect(s.balls.length).toBeGreaterThanOrEqual(1);
  });

  it("multi-ball spawns 2 extra balls", () => {
    const s = blank();
    s.balls = [{ x: 100, y: 100, vx: 0.1, vy: -0.1 }];
    applyPowerUp(s, "multi-ball");
    expect(s.balls.length).toBe(3);
  });

  it("clearing all bricks sets status='cleared'", () => {
    const s = blank();
    s.bricks = [
      {
        x: 100,
        y: 100,
        w: 40,
        h: 16,
        label: "Mom",
        hp: 1,
        maxHp: 1,
        dropsPowerUp: false,
      },
    ];
    s.balls = [{ x: 120, y: 120, vx: 0, vy: -0.4 }];
    step(s, 16);
    expect(s.bricks.length).toBe(0);
    expect(s.status).toBe("cleared");
    // Field bounds preserved
    expect(s.fieldW).toBe(FIELD_W);
    expect(s.fieldH).toBe(FIELD_H);
  });
});
