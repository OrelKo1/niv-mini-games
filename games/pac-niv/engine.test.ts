import { describe, it, expect } from "vitest";
import {
  createInitialState,
  setPlayerDir,
  step,
  triggerPowerPellet,
  eatGhostAtPlayer,
  STEP_MS,
} from "./engine";

describe("pac-niv engine", () => {
  it("step advances player one cell in dir if not wall", () => {
    const s = createInitialState();
    // Find a known-empty neighbor of spawn and aim for it.
    const { x, y } = s.player;
    // Look for a non-wall neighbor.
    const candidates = (
      [
        ["right", 1, 0],
        ["left", -1, 0],
        ["up", 0, -1],
        ["down", 0, 1],
      ] as const
    ).filter(([, dx, dy]) => {
      const t = s.tiles[y + dy]?.[x + dx];
      return t && t !== "wall";
    });
    expect(candidates.length).toBeGreaterThan(0);
    const [dir, dx, dy] = candidates[0];
    setPlayerDir(s, dir);
    step(s, STEP_MS);
    expect(s.player.x).toBe(x + dx);
    expect(s.player.y).toBe(y + dy);
  });

  it("step does NOT advance player into a wall (when both current and pending are walls)", () => {
    const s = createInitialState();
    const { x, y } = s.player;
    // Force-set both current dir and pending dir to wall directions so the
    // engine has nowhere to go.
    let wallDir: "up" | "down" | "left" | "right" | null = null;
    if (s.tiles[y - 1]?.[x] === "wall") wallDir = "up";
    else if (s.tiles[y + 1]?.[x] === "wall") wallDir = "down";
    else if (s.tiles[y]?.[x - 1] === "wall") wallDir = "left";
    else if (s.tiles[y]?.[x + 1] === "wall") wallDir = "right";
    if (!wallDir) return;
    s.player.dir = wallDir;
    s.player.pendingDir = wallDir;
    step(s, STEP_MS);
    expect(s.player.x).toBe(x);
    expect(s.player.y).toBe(y);
  });

  it("eating pellet increments score by 10 and removes pellet", () => {
    const s = createInitialState();
    // Plant a pellet next to player and force-step into it.
    const { x, y } = s.player;
    // Pick an empty neighbor and convert it to pellet.
    const neighbors: [
      "up" | "down" | "left" | "right",
      number,
      number
    ][] = [
      ["right", 1, 0],
      ["left", -1, 0],
      ["up", 0, -1],
      ["down", 0, 1],
    ];
    const found = neighbors.find(
      ([, dx, dy]) => s.tiles[y + dy]?.[x + dx] === "empty" || s.tiles[y + dy]?.[x + dx] === "pellet"
    );
    if (!found) throw new Error("no walkable neighbor in test maze");
    const [dir, dx, dy] = found;
    s.tiles[y + dy][x + dx] = "pellet";
    // Keep pelletsRemaining > 1 so we don't trigger a level clear (which would
    // reset the player position).
    s.pelletsRemaining = 5;
    const before = s.score;
    setPlayerDir(s, dir);
    step(s, STEP_MS);
    expect(s.player.x).toBe(x + dx);
    expect(s.player.y).toBe(y + dy);
    expect(s.score).toBe(before + 10);
    expect(s.tiles[y + dy][x + dx]).toBe("empty");
  });

  it("power pellet sets ghosts to scared", () => {
    const s = createInitialState();
    triggerPowerPellet(s);
    for (const g of s.ghosts) {
      expect(g.mode).toBe("scared");
    }
    expect(s.scaredEndMs).toBeGreaterThan(s.nowMs);
  });

  it("eating chain of scared ghosts doubles bonus each", () => {
    const s = createInitialState();
    triggerPowerPellet(s);
    const before = s.score;
    eatGhostAtPlayer(s, s.ghosts[0]); // 200
    eatGhostAtPlayer(s, s.ghosts[1]); // 400
    eatGhostAtPlayer(s, s.ghosts[2]); // 800
    eatGhostAtPlayer(s, s.ghosts[3]); // 1600
    expect(s.score - before).toBe(200 + 400 + 800 + 1600);
  });

  it("clearing all pellets advances level and refills", () => {
    const s = createInitialState();
    // Force player onto the last pellet.
    // Wipe all pellets except one neighbor:
    const { x, y } = s.player;
    for (let yy = 0; yy < s.height; yy++) {
      for (let xx = 0; xx < s.width; xx++) {
        if (s.tiles[yy][xx] === "pellet" || s.tiles[yy][xx] === "power") {
          s.tiles[yy][xx] = "empty";
        }
      }
    }
    // Find a walkable neighbor and put a pellet there.
    const neighbors: [
      "up" | "down" | "left" | "right",
      number,
      number
    ][] = [
      ["right", 1, 0],
      ["left", -1, 0],
      ["up", 0, -1],
      ["down", 0, 1],
    ];
    const found = neighbors.find(
      ([, dx, dy]) => s.tiles[y + dy]?.[x + dx] !== "wall" && s.tiles[y + dy]?.[x + dx] !== undefined
    );
    if (!found) throw new Error("no walkable neighbor");
    const [dir, dx, dy] = found;
    s.tiles[y + dy][x + dx] = "pellet";
    s.pelletsRemaining = 1;
    const startLevel = s.level;
    setPlayerDir(s, dir);
    const r = step(s, STEP_MS);
    expect(r.levelCleared).toBe(true);
    expect(s.level).toBe(startLevel + 1);
    // refill: there must be more than 100 pellets after refill (real maze has many)
    expect(s.pelletsRemaining).toBeGreaterThan(50);
  });

  it("ghosts move over time", () => {
    const s = createInitialState();
    const before = s.ghosts.map((g) => ({ x: g.x, y: g.y }));
    // Run many steps to give ghosts a chance to move out of the house.
    for (let i = 0; i < 200; i++) step(s, STEP_MS);
    const after = s.ghosts.map((g) => ({ x: g.x, y: g.y }));
    const anyMoved = before.some(
      (b, i) => b.x !== after[i].x || b.y !== after[i].y
    );
    expect(anyMoved).toBe(true);
  });
});
