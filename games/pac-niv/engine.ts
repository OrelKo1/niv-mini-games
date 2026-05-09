import { parseMaze, MAZE_W, MAZE_H, type ParsedMaze, type TileKind } from "./maze";
import type { Dir, Ghost, GhostKind, PacNivState, StepResult } from "./types";

// Tile-based, fixed-step engine. Every STEP_MS the player tries to advance one
// cell in its current direction. Ghosts move at slightly slower / faster rates
// depending on mode. Animation between cells is the renderer's job.
export const STEP_MS = 140; // base player step (tunable)

const SCARED_DURATION_MS = 8000;
const POWER_PELLET_SCORE = 50;
const PELLET_SCORE = 10;
const GHOST_BASE_BONUS = 200;

// scatter/chase schedule (Pac-Man classic, simplified)
const MODE_SCHEDULE: Array<{ mode: "scatter" | "chase"; durationMs: number }> = [
  { mode: "scatter", durationMs: 7000 },
  { mode: "chase", durationMs: 20000 },
  { mode: "scatter", durationMs: 7000 },
  { mode: "chase", durationMs: 20000 },
  { mode: "scatter", durationMs: 5000 },
  { mode: "chase", durationMs: 20000 },
];

const HOME_CORNERS: Record<GhostKind, { x: number; y: number }> = {
  cop: { x: MAZE_W - 2, y: 1 }, // top-right
  ex: { x: 1, y: 1 }, // top-left
  landlord: { x: MAZE_W - 2, y: MAZE_H - 2 }, // bottom-right
  mom: { x: 1, y: MAZE_H - 2 }, // bottom-left
};

const GHOST_KINDS: GhostKind[] = ["cop", "ex", "landlord", "mom"];

const DIR_VECTORS: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function isWalkableForPlayer(t: TileKind | undefined): boolean {
  if (!t) return false;
  return t !== "wall" && t !== "door";
}

function isWalkableForGhost(t: TileKind | undefined): boolean {
  if (!t) return false;
  return t !== "wall"; // ghosts can go through doors
}

function wrapTunnel(x: number, y: number, w: number, _h: number): [number, number] {
  // Classic tunnel on row 14 (after parse). We allow any tile on the maze edge
  // to wrap horizontally. Otherwise clamp.
  if (x < 0) return [w - 1, y];
  if (x >= w) return [0, y];
  return [x, y];
}

function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function buildGhosts(parsed: ParsedMaze): Ghost[] {
  // Map first 4 ghost-house spawns to the 4 ghost kinds.
  const spawns = parsed.ghostSpawns.length >= 4
    ? parsed.ghostSpawns.slice(0, 4)
    : Array.from({ length: 4 }, (_, i) =>
        parsed.ghostSpawns[i % Math.max(1, parsed.ghostSpawns.length)] ?? {
          x: Math.floor(parsed.width / 2),
          y: Math.floor(parsed.height / 2),
        }
      );

  return GHOST_KINDS.map((kind, i) => {
    const sp = spawns[i];
    return {
      kind,
      x: sp.x,
      y: sp.y,
      dir: "up" as Dir,
      mode: "scatter" as const,
      scaredUntilMs: 0,
      homeCorner: HOME_CORNERS[kind],
      spawn: { x: sp.x, y: sp.y },
      everEaten: false,
    };
  });
}

export function createInitialState(): PacNivState {
  const parsed = parseMaze();
  const ghosts = buildGhosts(parsed);
  return {
    tiles: parsed.tiles,
    width: parsed.width,
    height: parsed.height,
    pelletsRemaining: parsed.pelletCount,
    player: {
      x: parsed.playerSpawn.x,
      y: parsed.playerSpawn.y,
      dir: "left",
      pendingDir: null,
    },
    spawn: { ...parsed.playerSpawn },
    ghosts,
    score: 0,
    lives: 3,
    level: 1,
    speed: 1,
    ghostChainEatenInPower: 0,
    ghostsEatenThisGame: 0,
    nowMs: 0,
    modeStartedMs: 0,
    currentScheduledMode: "scatter",
    scheduleIndex: 0,
    scaredEndMs: 0,
    powerPelletsEaten: 0,
    jointsEatenCumulative: 0,
    fourChainStartedMs: 0,
    diedThisLevel: false,
    diedEver: false,
    copNearLastSeenMs: 0,
    gameOver: false,
    won: false,
  };
}

export function setPlayerDir(s: PacNivState, dir: Dir): void {
  // If the player can immediately reverse, do so. Otherwise queue.
  const [dx, dy] = DIR_VECTORS[dir];
  const nx = s.player.x + dx;
  const ny = s.player.y + dy;
  const target = s.tiles[ny]?.[nx];
  if (isWalkableForPlayer(target)) {
    s.player.dir = dir;
    s.player.pendingDir = null;
  } else {
    s.player.pendingDir = dir;
  }
}

/** Test helper / power-up trigger. Marks all non-eaten ghosts scared. */
export function triggerPowerPellet(s: PacNivState): void {
  s.scaredEndMs = s.nowMs + SCARED_DURATION_MS;
  s.ghostChainEatenInPower = 0;
  s.fourChainStartedMs = s.nowMs;
  s.powerPelletsEaten++;
  for (const g of s.ghosts) {
    if (g.mode !== "eaten") {
      g.mode = "scared";
      g.scaredUntilMs = s.scaredEndMs;
      // reverse direction (classic behavior)
      g.dir = OPPOSITE[g.dir];
    }
  }
}

/** Test helper: pretend the player ate this ghost. Bonus doubles each chain. */
export function eatGhostAtPlayer(s: PacNivState, g: Ghost): number {
  if (g.mode !== "scared") return 0;
  const bonus = GHOST_BASE_BONUS * Math.pow(2, s.ghostChainEatenInPower);
  s.score += bonus;
  s.ghostChainEatenInPower++;
  s.ghostsEatenThisGame++;
  g.everEaten = true;
  g.mode = "eaten";
  // send back to spawn instantly (simplified: no eyes-return animation)
  g.x = g.spawn.x;
  g.y = g.spawn.y;
  return bonus;
}

function refillLevel(s: PacNivState): void {
  const parsed = parseMaze();
  s.tiles = parsed.tiles;
  s.pelletsRemaining = parsed.pelletCount;
  s.player.x = parsed.playerSpawn.x;
  s.player.y = parsed.playerSpawn.y;
  s.player.dir = "left";
  s.player.pendingDir = null;
  s.ghosts = buildGhosts(parsed);
  s.scaredEndMs = 0;
  s.ghostChainEatenInPower = 0;
  s.modeStartedMs = s.nowMs;
  s.scheduleIndex = 0;
  s.currentScheduledMode = "scatter";
}

function respawnAfterDeath(s: PacNivState): void {
  s.player.x = s.spawn.x;
  s.player.y = s.spawn.y;
  s.player.dir = "left";
  s.player.pendingDir = null;
  s.ghosts = buildGhosts({
    tiles: s.tiles,
    width: s.width,
    height: s.height,
    playerSpawn: s.spawn,
    ghostSpawns: s.ghosts.map((g) => g.spawn),
    pelletCount: s.pelletsRemaining,
  });
  s.scaredEndMs = 0;
  s.ghostChainEatenInPower = 0;
}

function tickScheduledMode(s: PacNivState): void {
  // Don't tick mode while scared (frozen), per classic behavior.
  if (s.scaredEndMs > s.nowMs) return;
  const cur = MODE_SCHEDULE[s.scheduleIndex];
  if (!cur) return; // stuck on last mode forever
  if (s.nowMs - s.modeStartedMs >= cur.durationMs) {
    s.scheduleIndex = Math.min(s.scheduleIndex + 1, MODE_SCHEDULE.length - 1);
    s.modeStartedMs = s.nowMs;
    s.currentScheduledMode = MODE_SCHEDULE[s.scheduleIndex].mode;
    // reverse all non-scared/non-eaten ghosts (classic)
    for (const g of s.ghosts) {
      if (g.mode === "scatter" || g.mode === "chase") {
        g.dir = OPPOSITE[g.dir];
        g.mode = s.currentScheduledMode;
      }
    }
  }
}

function ghostTarget(
  g: Ghost,
  s: PacNivState
): { x: number; y: number } {
  if (g.mode === "scatter") return g.homeCorner;
  if (g.mode === "scared") {
    // simple: random-ish — pick a corner far from the player
    return { x: g.homeCorner.x, y: g.homeCorner.y };
  }
  if (g.mode === "eaten") return g.spawn;
  // chase: each ghost has a different targeting rule
  const px = s.player.x;
  const py = s.player.y;
  const [pdx, pdy] = DIR_VECTORS[s.player.dir];
  switch (g.kind) {
    case "cop": // Blinky — head straight for Pac
      return { x: px, y: py };
    case "ex": // Pinky — 4 ahead of Pac
      return { x: px + pdx * 4, y: py + pdy * 4 };
    case "landlord": {
      // Inky-style flank: vector from cop, doubled, around 2 ahead of pac
      const cop = s.ghosts.find((gg) => gg.kind === "cop");
      const ax = px + pdx * 2;
      const ay = py + pdy * 2;
      if (!cop) return { x: ax, y: ay };
      return { x: ax + (ax - cop.x), y: ay + (ay - cop.y) };
    }
    case "mom": {
      // Clyde: chase if far, scatter to corner if close (within 8)
      const d = manhattan(g.x, g.y, px, py);
      if (d > 8) return { x: px, y: py };
      return g.homeCorner;
    }
  }
}

function chooseGhostDir(g: Ghost, s: PacNivState): Dir {
  // Pac-Man rule: at each tile, look at the 4 neighbors except the reverse of
  // current direction. Pick the one that minimizes distance to target. If the
  // ghost is scared, pick randomly among legal non-reverse moves.
  const target = ghostTarget(g, s);
  const opts: Dir[] = (Object.keys(DIR_VECTORS) as Dir[]).filter((d) => {
    if (d === OPPOSITE[g.dir]) return false;
    const [dx, dy] = DIR_VECTORS[d];
    const [nx, ny] = wrapTunnel(g.x + dx, g.y + dy, s.width, s.height);
    return isWalkableForGhost(s.tiles[ny]?.[nx]);
  });
  if (opts.length === 0) {
    // forced reverse
    return OPPOSITE[g.dir];
  }
  if (g.mode === "scared") {
    return opts[Math.floor(Math.random() * opts.length)];
  }
  let best = opts[0];
  let bestD = Infinity;
  for (const d of opts) {
    const [dx, dy] = DIR_VECTORS[d];
    const [nx, ny] = wrapTunnel(g.x + dx, g.y + dy, s.width, s.height);
    const dist = manhattan(nx, ny, target.x, target.y);
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

function moveGhostOneCell(g: Ghost, s: PacNivState): void {
  const dir = chooseGhostDir(g, s);
  g.dir = dir;
  const [dx, dy] = DIR_VECTORS[dir];
  const [nx, ny] = wrapTunnel(g.x + dx, g.y + dy, s.width, s.height);
  if (isWalkableForGhost(s.tiles[ny]?.[nx])) {
    g.x = nx;
    g.y = ny;
  }
  // If "eaten" ghost reaches spawn, revert to current scheduled mode.
  if (g.mode === "eaten" && g.x === g.spawn.x && g.y === g.spawn.y) {
    g.mode = s.currentScheduledMode;
  }
}

interface InternalStep {
  milestones: Set<string>;
  died: boolean;
  levelCleared: boolean;
}

function checkCollisions(s: PacNivState, out: InternalStep): void {
  for (const g of s.ghosts) {
    if (g.x !== s.player.x || g.y !== s.player.y) continue;
    if (g.mode === "scared") {
      const bonus = eatGhostAtPlayer(s, g);
      if (bonus > 0) {
        if (s.ghostsEatenThisGame >= 3) out.milestones.add("pacniv:ghosts:3");
        if (g.kind === "landlord") out.milestones.add("pacniv:landlord:eaten");
        if (s.ghostChainEatenInPower === 4) {
          out.milestones.add("pacniv:fourchain");
          if (s.nowMs - s.fourChainStartedMs <= 3000) {
            out.milestones.add("pacniv:fourchain:fast");
          }
        }
      }
    } else if (g.mode === "eaten") {
      // no-op
    } else {
      // player dies
      if (!s.diedEver) out.milestones.add("pacniv:death:firstghost");
      s.diedEver = true;
      s.diedThisLevel = true;
      s.lives--;
      out.died = true;
      if (s.lives <= 0) {
        s.gameOver = true;
      } else {
        respawnAfterDeath(s);
      }
      return;
    }
  }
}

/** Run one fixed-step tick. dtMs is added to game time. */
export function step(s: PacNivState, dtMs: number = STEP_MS): StepResult {
  if (s.gameOver) {
    return { milestones: [], died: false, levelCleared: false };
  }

  const out: InternalStep = {
    milestones: new Set(),
    died: false,
    levelCleared: false,
  };

  // advance time first
  s.nowMs += dtMs;

  // expire scared
  if (s.scaredEndMs > 0 && s.nowMs >= s.scaredEndMs) {
    s.scaredEndMs = 0;
    for (const g of s.ghosts) {
      if (g.mode === "scared") g.mode = s.currentScheduledMode;
    }
  }

  tickScheduledMode(s);

  // ── PLAYER MOVE ──
  // Try pending direction first (turn at intersection).
  if (s.player.pendingDir) {
    const [dx, dy] = DIR_VECTORS[s.player.pendingDir];
    const [nx, ny] = wrapTunnel(s.player.x + dx, s.player.y + dy, s.width, s.height);
    if (isWalkableForPlayer(s.tiles[ny]?.[nx])) {
      s.player.dir = s.player.pendingDir;
      s.player.pendingDir = null;
    }
  }
  {
    const [dx, dy] = DIR_VECTORS[s.player.dir];
    const [nx, ny] = wrapTunnel(s.player.x + dx, s.player.y + dy, s.width, s.height);
    if (isWalkableForPlayer(s.tiles[ny]?.[nx])) {
      s.player.x = nx;
      s.player.y = ny;
    }
  }

  // ── PELLET / POWER-PELLET COLLECTION ──
  const here = s.tiles[s.player.y]?.[s.player.x];
  if (here === "pellet") {
    s.tiles[s.player.y][s.player.x] = "empty";
    s.score += PELLET_SCORE;
    s.pelletsRemaining--;
    s.jointsEatenCumulative++;

    // joint:underpressure — eating with any non-scared ghost within 1 tile
    const underPressure = s.ghosts.some(
      (g) =>
        g.mode !== "scared" &&
        g.mode !== "eaten" &&
        manhattan(g.x, g.y, s.player.x, s.player.y) <= 1
    );
    if (underPressure) out.milestones.add("pacniv:joint:underpressure");

    if (s.jointsEatenCumulative >= 100) out.milestones.add("pacniv:joints:1000");
    // (we fire :1000 at 100 within a single run as documented simplification)
  } else if (here === "power") {
    s.tiles[s.player.y][s.player.x] = "empty";
    s.score += POWER_PELLET_SCORE;
    s.pelletsRemaining--;
    triggerPowerPellet(s);
    if (s.powerPelletsEaten >= 5) out.milestones.add("pacniv:powerups:5");
    if (s.powerPelletsEaten >= 100) out.milestones.add("pacniv:powerups:100");
  }

  // pre-collision check (player walked into ghost cell)
  checkCollisions(s, out);
  if (out.died) {
    return finalizeStep(s, out);
  }

  // ── GHOST MOVE ── (slightly slower than player when scared)
  for (const g of s.ghosts) {
    // scared ghosts move every other tick
    if (g.mode === "scared" && Math.floor(s.nowMs / dtMs) % 2 !== 0) continue;
    moveGhostOneCell(g, s);
  }

  // post-collision check (ghost moved onto player)
  checkCollisions(s, out);
  if (out.died) {
    return finalizeStep(s, out);
  }

  // ── COP NEAR / TIME-SURVIVED MILESTONES ──
  const cop = s.ghosts.find((g) => g.kind === "cop");
  if (cop && cop.mode !== "scared" && cop.mode !== "eaten") {
    if (manhattan(cop.x, cop.y, s.player.x, s.player.y) <= 4) {
      s.copNearLastSeenMs = s.nowMs;
    }
  } else {
    // treat scared/eaten cop as not-near
  }
  if (s.nowMs - s.copNearLastSeenMs >= 60_000) {
    out.milestones.add("pacniv:cop:60s");
    s.copNearLastSeenMs = s.nowMs; // don't keep firing
  }
  if (s.nowMs >= 300_000) out.milestones.add("pacniv:time:300s");
  if (s.nowMs >= 900_000) out.milestones.add("pacniv:time:900s");

  // ── SCORE MILESTONES ──
  if (s.score >= 100) out.milestones.add("pacniv:score:100");
  if (s.score >= 5000) out.milestones.add("pacniv:score:5000");
  if (s.score >= 7500) out.milestones.add("pacniv:score:7500");
  if (s.score >= 10000) out.milestones.add("pacniv:score:10000");

  // ── LEVEL CLEAR ──
  if (s.pelletsRemaining <= 0) {
    if (s.level === 1 && !s.diedThisLevel) {
      out.milestones.add("pacniv:nodeath:level1");
    }
    if (s.level === 1) out.milestones.add("pacniv:level:1");
    s.level += 1;
    s.speed = 1 + 0.05 * (s.level - 1);
    s.diedThisLevel = false;
    refillLevel(s);
    out.levelCleared = true;
  }

  return finalizeStep(s, out);
}

function finalizeStep(s: PacNivState, out: InternalStep): StepResult {
  // baseline guarantee: pacniv:score:100 fires the moment we cross 100
  if (s.score >= 100) out.milestones.add("pacniv:score:100");
  return {
    milestones: Array.from(out.milestones),
    died: out.died,
    levelCleared: out.levelCleared,
  };
}
