# Nivtendo — Scaling & Fixes Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Game tasks (3-7) are independent and dispatched as parallel subagents. Tasks 1-2 run first (bug fix + shared infra). Tasks 8-9 run last (verify + deploy).

**Goal:** Make Nivtendo's UI mobile-first in spirit, not just in width — bigger Niv faces, bigger memes, bigger bricks, smoother controls. Fix the game-breaking Memory bug. Rotate Niv faces in games where the same face shows over and over.

**Architecture:** Each fix is scoped to one game (or a tiny shared helper). All renderers move from fixed cell sizes to viewport-fit canvases. We shrink the play-grids (Pac-Niv 28×31 → 17×19; Snake-Niv 20×20 → 12×12) so each cell — and thus each Niv head — is dramatically larger. We add an on-screen D-pad for Snake. We slow Whack-a-Niv's start and rotate Niv faces per spawn. We rotate Niv faces per game in Tic-Tac-Toe. We re-shape Brick-Niv to leave room for a Niv portrait beside the play area and bump label font size. The Memory bug (effect returns early on match-with-caption, never schedules resolve) is a one-line fix.

**Tech Stack:** Same as before — Next.js 16, TS, Tailwind, Canvas 2D, Zustand. No new deps.

**Spec:** `docs/superpowers/specs/2026-05-09-nivtendo-design.md`. **Site:** https://niv-mini-games.vercel.app. **Repo:** https://github.com/OrelKo1/niv-mini-games.

---

## Conventions

- **Working dir:** `/Users/orelkozachi/Desktop/OREL/code_projects/claude_active_projects/niv_mini_games`
- **Commit style:** Conventional Commits (`fix(snake-niv):`, `feat(pac-niv):`, etc.)
- **Test runner:** `pnpm test` (vitest), `pnpm typecheck`, `pnpm build`.
- **Author:** `git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "..."`
- **Don't break:** Manifest types in `lib/niv-types.ts`, store schema (`lib/store/use-niv-store.ts`), achievement engine, video splash, UnlockToast, GameFrame. Update them only if essential — never break their public API.
- **TDD:** Apply to deterministic engine logic. Renderer changes get verified in browser via `pnpm dev` + manual smoke.

---

## File Structure

| Path | What changes |
|---|---|
| `app/niv-memory/page.tsx` | One-line fix in resolve effect |
| `lib/niv/face-pool.ts` (new) | Shared helper to pick rotating Niv faces from the manifest |
| `games/pac-niv/maze.ts` | Replace 28×31 layout with new compact 17×19 layout |
| `games/pac-niv/Renderer.tsx` | Viewport-fit canvas, larger cells; render Niv head bigger |
| `games/pac-niv/engine.ts` | Adjust `MAZE_W`/`MAZE_H` references and ghost spawn coords if hard-coded |
| `games/pac-niv/engine.test.ts` | Update tests that hard-code old maze positions |
| `games/snake-niv/types.ts` | Reduce `GRID` from 20 to 12 |
| `games/snake-niv/Renderer.tsx` | Viewport-fit canvas + visible on-screen D-pad |
| `games/whack-a-niv/types.ts` | Reduce initial spawn probability + add ramp constant |
| `games/whack-a-niv/engine.ts` | Use ramped probability based on time-elapsed; pick random face per spawn |
| `games/whack-a-niv/Holes.tsx` | Render the per-hole asset (already passed in) — verify reads `hole.asset` |
| `app/whack-a-niv/page.tsx` | Pick a fresh asset for each spawn |
| `games/niv-tac-toe/Board.tsx` | Use a per-game Niv face (passed as prop) |
| `app/niv-tac-toe/page.tsx` | Re-pick the face on every fresh game |
| `games/brick-niv/engine.ts` | Reduce columns from 8 → 5; widen bricks |
| `games/brick-niv/Renderer.tsx` | Bigger label font, wider cells, side-panel Niv portrait |
| `app/brick-niv/page.tsx` | Layout adjustment if needed |

---

## Phase 0 — Pre-flight (reverse-engineer current state)

### Task 0.1: Inventory current sizing constants

**Files:** none (read-only)

- [ ] **Step 1:** Confirm current values

Run:
```bash
grep -n "CELL\|GRID\|MAZE_\|SPAWN_P\|FONT" \
  games/pac-niv/Renderer.tsx \
  games/pac-niv/maze.ts \
  games/snake-niv/types.ts \
  games/snake-niv/Renderer.tsx \
  games/whack-a-niv/types.ts \
  games/whack-a-niv/engine.ts \
  games/brick-niv/Renderer.tsx
```

Expected (known): Pac-Niv `CELL = 14`, maze 28×31. Whack `SPAWN_P_PER_TICK = 0.04`. Snake `GRID = 20` (verify). Brick label font ≤8px (verify).

- [ ] **Step 2:** Note values in your scratch space — informs Phase 2-7 changes.

---

## Phase 1 — Memory bug (CRITICAL, do first)

### Task 1.1: Fix `niv-memory` stuck-after-first-match

**Files:**
- Modify: `app/niv-memory/page.tsx:184-192` (the `if (isMatch && first)` block in the resolve `useEffect`)

The current branch sets a banner timeout and `return () => clearTimeout(t);` — exiting the effect BEFORE the resolve `setTimeout` is scheduled. So after the first match, `state.firstSelection`/`secondSelection` stay set, `bothSelected(state)` keeps returning true, and `onFlip` is blocked forever.

- [ ] **Step 1:** Open `app/niv-memory/page.tsx`, locate the effect at line 172.

- [ ] **Step 2:** Replace this block:

```tsx
    // If it's a match: short pause, then resolve
    // If mismatch: longer pause to let player see the cards
    const delay = isMatch ? 400 : REVEAL_MS;

    // show caption banner if the matched card has one
    if (isMatch && first) {
      const cap = slugToCaption.get(first.slug);
      if (cap) {
        setBanner(cap);
        const t = setTimeout(() => setBanner(null), 1500);
        // we cleanup on next effect run
        return () => clearTimeout(t);
      }
    }

    const t = setTimeout(() => {
      setState((prev) => {
        if (!prev) return prev;
        if (!bothSelected(prev)) return prev;
        const wasFirstMatch = prev.streak === 0; // tracking only — fired below
        void wasFirstMatch;
        return resolve(prev);
      });
    }, delay);
    return () => clearTimeout(t);
```

with this — banner and resolve coexist:

```tsx
    const delay = isMatch ? 400 : REVEAL_MS;

    let bannerTimer: ReturnType<typeof setTimeout> | undefined;
    if (isMatch && first) {
      const cap = slugToCaption.get(first.slug);
      if (cap) {
        setBanner(cap);
        bannerTimer = setTimeout(() => setBanner(null), 1500);
      }
    }

    const resolveTimer = setTimeout(() => {
      setState((prev) => {
        if (!prev) return prev;
        if (!bothSelected(prev)) return prev;
        return resolve(prev);
      });
    }, delay);

    return () => {
      clearTimeout(resolveTimer);
      if (bannerTimer) clearTimeout(bannerTimer);
    };
```

- [ ] **Step 3:** Smoke-test in browser

```bash
pnpm dev
```
Open http://localhost:3000/niv-memory in mobile devtools (390×844). Start an EASY board. Match two cards. Verify:
- Banner shows the caption
- Cards stay matched (visual: opacity/grayscale or matched style)
- You can flip the next card immediately

Kill server.

- [ ] **Step 4:** Commit

```bash
git add app/niv-memory/page.tsx
git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "fix(niv-memory): unblock board after match — schedule resolve alongside caption banner"
```

---

## Phase 2 — Shared helper

### Task 2.1: `lib/niv/face-pool.ts` — rotating Niv face helper

**Files:**
- Create: `lib/niv/face-pool.ts`
- Create: `lib/niv/face-pool.test.ts`

A small, testable utility used by Whack-a-Niv, Tic-Tac-Niv, and (optionally) other games for rotating Niv faces.

- [ ] **Step 1:** Test first

```ts
// lib/niv/face-pool.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../niv-manifest", () => ({
  NIV_MANIFEST: {
    version: 1 as const,
    generatedAt: "",
    assets: [
      { slug: "a", caption: "", tier: "bronze", game: "snake-niv", milestone: "m1", paths: { avatar64: "/a64", avatar128: "/a128", avatar256: "/a256", portrait720: "/a720" } },
      { slug: "b", caption: "", tier: "silver", game: "whack-a-niv", milestone: "m2", paths: { avatar64: "/b64", avatar128: "/b128", avatar256: "/b256", portrait720: "/b720" } },
      { slug: "c", caption: "", tier: "gold", game: "niv-tac-toe", milestone: "m3", paths: { avatar64: "/c64", avatar128: "/c128", avatar256: "/c256", portrait720: "/c720" } },
    ],
  },
}));

import { pickFace, pickFaces, pickFaceForGame } from "./face-pool";

describe("face-pool", () => {
  it("pickFace returns one asset using the rng", () => {
    const f = pickFace(() => 0);
    expect(f.slug).toBe("a");
  });
  it("pickFace picks deterministically from rng", () => {
    const f = pickFace(() => 0.99);
    expect(f.slug).toBe("c");
  });
  it("pickFaces returns N unique assets", () => {
    const arr = pickFaces(2, () => 0.5);
    expect(arr.length).toBe(2);
    expect(new Set(arr.map((a) => a.slug)).size).toBe(2);
  });
  it("pickFaceForGame prefers game-tagged assets, falls back when none exist", () => {
    expect(pickFaceForGame("whack-a-niv", () => 0).slug).toBe("b");
    expect(pickFaceForGame("brick-niv", () => 0).slug).toBe("a"); // no brick assets in mock — falls back
  });
});
```

- [ ] **Step 2:** Run — fails (module missing).

```bash
pnpm test lib/niv/face-pool.test.ts
```

- [ ] **Step 3:** Implement

```ts
// lib/niv/face-pool.ts
import { NIV_MANIFEST } from "../niv-manifest";
import type { GameId, NivAsset } from "../niv-types";

const ASSETS = NIV_MANIFEST.assets as NivAsset[];

export function pickFace(rng: () => number = Math.random): NivAsset {
  const idx = Math.floor(rng() * ASSETS.length);
  return ASSETS[Math.min(idx, ASSETS.length - 1)];
}

export function pickFaces(n: number, rng: () => number = Math.random): NivAsset[] {
  const pool = [...ASSETS];
  const out: NivAsset[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0]);
  }
  return out;
}

export function pickFaceForGame(game: GameId, rng: () => number = Math.random): NivAsset {
  const tagged = ASSETS.filter((a) => a.game === game);
  const pool = tagged.length > 0 ? tagged : ASSETS;
  const idx = Math.floor(rng() * pool.length);
  return pool[Math.min(idx, pool.length - 1)];
}
```

- [ ] **Step 4:** Tests pass.

```bash
pnpm test lib/niv/face-pool.test.ts
```

- [ ] **Step 5:** Commit

```bash
git add lib/niv/face-pool.ts lib/niv/face-pool.test.ts
git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "feat(lib): rotating niv face-pool helper"
```

---

## Phase 3 — Pac-Niv: smaller maze, bigger sprites

### Task 3.1: Replace 28×31 maze with compact 17×19

**Files:**
- Modify: `games/pac-niv/maze.ts` (full rewrite)
- Possibly modify: `games/pac-niv/engine.ts` if it hard-codes dimensions or specific coordinates outside MAZE_W/MAZE_H.
- Possibly modify: `games/pac-niv/engine.test.ts` if a test references hard-coded coordinates.

**Why:** 28×31 cells × 14px = 392px wide. On a 390px portrait viewport that's barely playable. With a 17×19 maze and viewport-fit cell sizing, each Niv head doubles in size.

- [ ] **Step 1:** Read current `engine.ts` to find any hard-coded coordinates that depend on the old layout (e.g. tunnel row constants, ghost-house positions). Note them.

```bash
grep -n "MAZE_W\|MAZE_H\|tunnel\|ghostHouse\|spawn" games/pac-niv/engine.ts
```

- [ ] **Step 2:** Rewrite `games/pac-niv/maze.ts` with this layout:

```ts
// Pac-Niv compact maze — 17 wide × 19 tall.
// Tighter than the classic Pac-Man footprint so on mobile each cell renders
// big enough to actually see Niv's face on the player sprite.
// Legend (unchanged):
//   #  wall
//   .  pellet
//   o  power pellet
//   ' ' empty (corridor without pellet, e.g. tunnels, ghost-house exit)
//   P  player spawn (single)
//   G  ghost spawn (in/near the ghost house)
//   -  ghost-house door

export const MAZE_W = 17;
export const MAZE_H = 19;

export const MAZE_LAYOUT: string[] = [
  "#################", //  0
  "#o.....#.#.....o#", //  1
  "#.###.##.##.###.#", //  2
  "#...............#", //  3
  "#.##.###.###.##.#", //  4
  "#....#.....#....#", //  5
  "####.#.###.#.####", //  6
  "   #.# #G# #.#   ", //  7
  "####.# #G# #.####", //  8
  ".......#G#.......", //  9  tunnel row
  "####.# ### #.####", // 10
  "   #.#     #.#   ", // 11
  "####.#.###.#.####", // 12
  "#......#P#......#", // 13
  "#.###.##.##.###.#", // 14
  "#.#.............#", // 15
  "#.#.##.###.##.#.#", // 16
  "#o....#...#....o#", // 17
  "#################", // 18
];
```

(Each row is exactly 17 chars including spaces; 19 rows.)

- [ ] **Step 3:** If `engine.ts` references coordinates outside `MAZE_W`/`MAZE_H` (e.g. a hard-coded tunnel row, a ghost-house exit point, or specific pellet counts), update them:

  - Tunnel row (player wraps left↔right): the new layout uses **row 9**.
  - Player spawn `P` is at **(13, 13)** (read from the layout: row 13, column 13). The engine's existing `parseMaze` should detect this from `'P'` automatically — no manual update needed if `parseMaze` is generic. Verify by reading `engine.ts` around the parsing call.
  - Ghost-house cells `G` exist at rows 7-9 inside the central box. If `engine.ts` exposes a `GHOST_HOUSE_EXIT_Y = 11` constant or similar from the old maze, change it to **row 8** (the row immediately above the ghost-house corridor in the new layout). If no such constant exists, skip.

- [ ] **Step 4:** Update tests in `games/pac-niv/engine.test.ts` if they hard-code coordinates. Read the test file:

```bash
grep -n "spawn\|MAZE_\|x:\s*[0-9]" games/pac-niv/engine.test.ts
```

For any test that asserts the player starts at a specific (x, y), update to use the new spawn coordinates derived from `parseMaze(MAZE_LAYOUT)` rather than hard-coded numbers — if the test uses a constant, replace with `parsed.playerSpawn.x` style lookups.

- [ ] **Step 5:** Run tests

```bash
pnpm test games/pac-niv
```

Fix until green. (If a test relies on the old maze having ≥240 pellets, adjust the assertion — count pellets in the new layout: each `.` is one pellet.)

- [ ] **Step 6:** Don't commit yet — Task 3.2 also touches Pac-Niv files.

### Task 3.2: Viewport-fit Pac-Niv renderer

**Files:**
- Modify: `games/pac-niv/Renderer.tsx`

- [ ] **Step 1:** Locate the line `const CELL = 14;` near the top.

- [ ] **Step 2:** Replace fixed `CELL` with a viewport-aware sizing block. Inside the canvas-init effect (or before the first render), compute:

```ts
// Replace `const CELL = 14;` and any direct uses of CELL.
// Within the component body (top of the function):
const containerRef = useRef<HTMLDivElement>(null);
const [cell, setCell] = useState(20);

useEffect(() => {
  const update = () => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // 96% of available width / height inside the play area
    const usableW = rect.width * 0.96;
    const usableH = rect.height * 0.96;
    const next = Math.max(
      14,
      Math.floor(Math.min(usableW / MAZE_W, usableH / MAZE_H))
    );
    setCell(next);
  };
  update();
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", update);
  return () => {
    window.removeEventListener("resize", update);
    window.removeEventListener("orientationchange", update);
  };
}, []);
```

Then replace every `CELL` reference with `cell`. Wrap the `<canvas>` in a `<div ref={containerRef} className="flex-1 flex items-center justify-center">`. Set canvas `width={MAZE_W * cell}` and `height={MAZE_H * cell}`. Re-render on `cell` change (already handled by React).

- [ ] **Step 3:** Bump the player sprite (Niv head) and ghost size — they should now scale with `cell` automatically, but ensure the `ctx.drawImage(image, x, y, cell, cell)` calls use `cell` not `CELL`. Eye-blob sizes for ghosts should be `Math.max(2, cell / 6)` instead of fixed pixel values.

- [ ] **Step 4:** Smoke test

```bash
pnpm dev
```
On http://localhost:3000/pac-niv in 390×844 devtools: maze fills width, Niv head is clearly visible (>20px), pellets are dots, ghosts have visible color.

- [ ] **Step 5:** Type-check + tests

```bash
pnpm typecheck && pnpm test games/pac-niv
```

- [ ] **Step 6:** Commit

```bash
git add games/pac-niv app/pac-niv
git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "feat(pac-niv): compact 17x19 maze + viewport-fit cells (bigger niv face)"
```

---

## Phase 4 — Snake-Niv: smaller grid, bigger sprite, on-screen D-pad

### Task 4.1: Reduce grid + viewport-fit canvas

**Files:**
- Modify: `games/snake-niv/types.ts`
- Modify: `games/snake-niv/Renderer.tsx`
- Possibly modify: `games/snake-niv/engine.ts` (only if grid is hardcoded outside types)

- [ ] **Step 1:** In `games/snake-niv/types.ts`, find the `GRID` constant. Lower it from 20 to 12:

```ts
export const GRID = 12;
```

- [ ] **Step 2:** In `Renderer.tsx`, replace the fixed cell-size with a viewport-aware computation analogous to Pac-Niv:

```ts
const containerRef = useRef<HTMLDivElement>(null);
const [cell, setCell] = useState(28);

useEffect(() => {
  const update = () => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Reserve ~140px for the bottom D-pad we add in Task 4.2
    const usableW = rect.width * 0.96;
    const usableH = (rect.height - 140) * 0.96;
    const next = Math.max(20, Math.floor(Math.min(usableW / GRID, usableH / GRID)));
    setCell(next);
  };
  update();
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", update);
  return () => {
    window.removeEventListener("resize", update);
    window.removeEventListener("orientationchange", update);
  };
}, []);
```

Replace fixed cell uses with `cell`. The Niv head sprite in `drawImage(headImg, headX, headY, cell, cell)` will automatically scale up.

- [ ] **Step 3:** Tests

```bash
pnpm test games/snake-niv
```

If any test hard-codes `GRID === 20` or expects 20×20 specifically, update it to use the imported `GRID` constant. Re-run.

- [ ] **Step 4:** Don't commit yet — Task 4.2 also touches the renderer.

### Task 4.2: Visible on-screen D-pad

**Files:**
- Modify: `games/snake-niv/Renderer.tsx`
- Or: extract a small `<DPad>` component to `components/arcade/DPad.tsx` (preferred — also useful for Pac-Niv later)

- [ ] **Step 1:** Create `components/arcade/DPad.tsx`:

```tsx
"use client";
import type { Dir } from "./TouchPad";
import { clsx } from "clsx";

export function DPad({
  onDir,
  className,
}: {
  onDir: (d: Dir) => void;
  className?: string;
}) {
  const Btn = ({
    dir,
    char,
    cls,
  }: {
    dir: Dir;
    char: string;
    cls: string;
  }) => (
    <button
      aria-label={dir}
      onPointerDown={(e) => {
        e.preventDefault();
        onDir(dir);
      }}
      className={clsx(
        "absolute w-16 h-16 border-2 border-arcade-fg/60 bg-arcade-black/60",
        "flex items-center justify-center text-arcade-yellow text-xl",
        "active:bg-arcade-yellow active:text-arcade-black active:border-arcade-yellow",
        "select-none touch-none",
        cls
      )}
    >
      {char}
    </button>
  );
  return (
    <div
      className={clsx(
        "relative w-48 h-48 mx-auto select-none touch-none",
        className
      )}
    >
      <Btn dir="up" char="▲" cls="left-1/2 -translate-x-1/2 top-0" />
      <Btn dir="down" char="▼" cls="left-1/2 -translate-x-1/2 bottom-0" />
      <Btn dir="left" char="◄" cls="left-0 top-1/2 -translate-y-1/2" />
      <Btn dir="right" char="►" cls="right-0 top-1/2 -translate-y-1/2" />
    </div>
  );
}
```

- [ ] **Step 2:** In `Renderer.tsx`, import `DPad` and render it under the canvas:

```tsx
import { DPad } from "@/components/arcade/DPad";
// ...
return (
  <div ref={containerRef} className="flex-1 flex flex-col items-center justify-between py-2">
    <canvas ... />
    <DPad
      onDir={(d) => {
        // Use the same input function the swipe handler uses.
        // Find the existing input handler (likely setPendingDir or similar) and call it.
        applyDirInput(d);
      }}
      className="mt-2"
    />
  </div>
);
```

Replace `applyDirInput` with whatever the existing dir-input handler is named. The swipe handler from `<TouchPad>` should keep working — D-pad is additive, not replacing. Both feed the same handler.

- [ ] **Step 3:** Smoke test

```bash
pnpm dev
```
On `/snake-niv` (390×844): Niv head visibly bigger than before, D-pad clearly tappable, both swipe AND D-pad work.

- [ ] **Step 4:** Commit

```bash
git add games/snake-niv components/arcade/DPad.tsx
git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "feat(snake-niv): 12x12 grid, viewport-fit canvas, on-screen d-pad controls"
```

---

## Phase 5 — Whack-a-Niv: rotating faces + ramped spawn pace

### Task 5.1: Slower start + ramp

**Files:**
- Modify: `games/whack-a-niv/types.ts`
- Modify: `games/whack-a-niv/engine.ts`
- Modify: `games/whack-a-niv/engine.test.ts` (if any test asserts specific spawn probability)

- [ ] **Step 1:** In `games/whack-a-niv/types.ts`, replace `SPAWN_P_PER_TICK = 0.04` with a ramped pair:

```ts
export const SPAWN_P_START = 0.012;
export const SPAWN_P_END = 0.045;
export const ROUND_MS = 30000;
```

(Remove the old `SPAWN_P_PER_TICK` constant if nothing else imports it; otherwise leave it as an alias `= SPAWN_P_END` for backwards compat in tests.)

- [ ] **Step 2:** In `games/whack-a-niv/engine.ts`, the `step` function reads spawn probability. Replace the constant lookup with a time-based ramp:

```ts
import { SPAWN_P_START, SPAWN_P_END, ROUND_MS } from "./types";
// inside step(now, rng):
const elapsed = state.startedAt ? now - state.startedAt : 0;
const t = Math.min(1, elapsed / ROUND_MS);
const p = SPAWN_P_START + (SPAWN_P_END - SPAWN_P_START) * t;
if (rng() < p) {
  // existing spawn logic
}
```

- [ ] **Step 3:** If `engine.test.ts` asserts `SPAWN_P_PER_TICK`, update tests to use the new range OR keep an alias and the old test passes:

```ts
// types.ts
export const SPAWN_P_PER_TICK = SPAWN_P_END; // legacy alias
```

(Choose the alias path — minimal churn.)

- [ ] **Step 4:** Tests pass

```bash
pnpm test games/whack-a-niv
```

- [ ] **Step 5:** Don't commit yet.

### Task 5.2: Different Niv face per spawn

**Files:**
- Modify: `app/whack-a-niv/page.tsx`
- Modify: `games/whack-a-niv/Holes.tsx` (verify it reads `hole.asset.paths.avatar128`)
- Use: `lib/niv/face-pool.ts` from Task 2.1

The spec already had per-hole `asset` in state, but the current implementation likely picks one face at game-start and reuses it. Change so each spawn picks a fresh face.

- [ ] **Step 1:** In `games/whack-a-niv/engine.ts`, in the `step` function where a new head is spawned: instead of cloning a single game-asset, accept a `pickAsset` argument:

```ts
// In the engine signature:
export function step(state: WhackState, now: number, rng: () => number, pickAsset: () => NivAsset): WhackState;
```

When spawning, set `hole.asset = pickAsset()`. Random thought-bubble selection unchanged.

- [ ] **Step 2:** Update tests — pass a stub `pickAsset` (e.g. `() => ({ slug: 'x', paths: { avatar64: '', avatar128: '', avatar256: '', portrait720: '' }, caption: '', tier: 'bronze', game: 'whack-a-niv', milestone: '' })`).

- [ ] **Step 3:** In `app/whack-a-niv/page.tsx`, replace the existing single-asset selection with a `pickAsset` passed to `step`:

```tsx
import { pickFaceForGame } from "@/lib/niv/face-pool";
// inside the component:
const pickAsset = useCallback(() => pickFaceForGame("whack-a-niv"), []);
// in the loop / step call:
nextState = step(state, now, Math.random, pickAsset);
```

- [ ] **Step 4:** `Holes.tsx` likely already reads `hole.asset?.paths.avatar128`. Verify; if it falls back to a single static prop, remove the prop and rely on `hole.asset`.

- [ ] **Step 5:** Smoke test on `/whack-a-niv` — different Niv faces appear in different holes, no two consecutive spawns share the same face often.

- [ ] **Step 6:** Commit

```bash
git add games/whack-a-niv app/whack-a-niv
git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "feat(whack-a-niv): rotating niv faces per spawn + ramped spawn rate"
```

---

## Phase 6 — Niv-Tac-Toe: rotating Niv face per game

### Task 6.1: Per-game Niv face on X cells

**Files:**
- Modify: `games/niv-tac-toe/Board.tsx`
- Modify: `app/niv-tac-toe/page.tsx`

Currently the board shows one fixed Niv head for X. Change so a fresh face is picked each new game (start + after restart).

- [ ] **Step 1:** Update `Board.tsx` to accept the avatar URL as a prop:

```tsx
// existing signature:
// export function Board({ board, ... }: BoardProps) { ... }

// change to:
export function Board({ board, faceUrl, ...rest }: BoardProps & { faceUrl: string }) {
  // Use faceUrl in the cell render where 'X' was previously rendered with a static image.
  // Example replacement inside the cell render:
  // {cell === 'X' && <Image src={faceUrl} alt="X" width={64} height={64} className="image-pixelated" />}
}
```

- [ ] **Step 2:** Update `app/niv-tac-toe/page.tsx`:

```tsx
import { pickFaceForGame } from "@/lib/niv/face-pool";
// inside the component:
const [faceUrl, setFaceUrl] = useState<string>(() => pickFaceForGame("niv-tac-toe").paths.avatar128);

const onRestart = useCallback(() => {
  setFaceUrl(pickFaceForGame("niv-tac-toe").paths.avatar128);
  // ...existing restart logic
}, []);

// pass to Board:
<Board faceUrl={faceUrl} ... />
```

Also re-pick on initial mount (the `useState` initializer above already does this) and on difficulty toggle (treat as a new game — call the same setFaceUrl in the difficulty-change handler).

- [ ] **Step 3:** Smoke test on `/niv-tac-toe`: fresh face on first load; different face after restart.

- [ ] **Step 4:** Commit

```bash
git add games/niv-tac-toe app/niv-tac-toe
git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "feat(niv-tac-toe): rotate niv face per game"
```

---

## Phase 7 — Brick-Niv: wider bricks, bigger labels, side portrait

### Task 7.1: Reshape grid + bigger labels + side panel

**Files:**
- Modify: `games/brick-niv/engine.ts` (column count)
- Modify: `games/brick-niv/Renderer.tsx` (font size + side panel)

- [ ] **Step 1:** Find the bricks-init helper in `engine.ts` (probably named `seedBricks`, `initBricks`, or in `start(level)`). Reduce columns from 8 to 5:

```ts
// inside the brick init:
const COLS = 5;
const ROWS = 5;
// brick width derived from playArea.width / COLS — propagate this through the layout.
```

If brick width is computed from world width (`worldW / COLS`), reducing COLS automatically widens bricks.

- [ ] **Step 2:** In `Renderer.tsx`, find the brick label drawing call. Likely:

```ts
ctx.font = "6px 'Press Start 2P'";
ctx.fillText(brick.label, ...);
```

Replace with a font size proportional to brick width. Compute once per render:

```ts
const labelFont = Math.max(10, Math.floor(brick.w * 0.18));
ctx.font = `${labelFont}px 'Press Start 2P'`;
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText(brick.label, brick.x + brick.w / 2, brick.y + brick.h / 2);
```

- [ ] **Step 3:** Add a side Niv portrait. The play area is currently full-width canvas. Easiest path: render a `<div>` flexbox in `app/brick-niv/page.tsx` that wraps Renderer + a sidebar with a single Niv image. On portrait viewport, place the image *above* the canvas (because horizontal space is tight); on wider viewports, place it beside.

Update `app/brick-niv/page.tsx`:

```tsx
import Image from "next/image";
import { pickFaceForGame } from "@/lib/niv/face-pool";
// inside component:
const [face] = useState(() => pickFaceForGame("brick-niv"));

return (
  <GameFrame title="BRICK-NIV" ...>
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-2">
      <div className="flex flex-col items-center gap-1 sm:order-2">
        <Image
          src={face.paths.avatar256}
          alt=""
          width={120}
          height={120}
          className="image-pixelated border-4 border-arcade-yellow"
          priority
        />
        <p className="text-[7px] text-arcade-yellow text-center max-w-[140px] leading-snug">
          NIV WATCHES
        </p>
      </div>
      <Renderer ... className="sm:order-1" />
    </div>
  </GameFrame>
);
```

(The order classes flip portrait→landscape: image above on mobile, image to right on tablet+.)

- [ ] **Step 4:** Tests + smoke

```bash
pnpm typecheck && pnpm test games/brick-niv
pnpm dev
```
On `/brick-niv`: brick labels readable (≥10px), bricks visibly wider, Niv portrait visible above the play area on mobile.

- [ ] **Step 5:** Commit

```bash
git add games/brick-niv app/brick-niv
git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "feat(brick-niv): wider bricks, bigger labels, side niv portrait"
```

---

## Phase 8 — Verify everything together

### Task 8.1: Full verification

**Files:** none

- [ ] **Step 1:** Run the full test + type + build pipeline

```bash
pnpm typecheck && pnpm test && pnpm build
```

Expected: all green. If a game fails build because a parallel subagent introduced a regression, read the error; fix in the smallest possible patch; commit a `fix:` commit.

- [ ] **Step 2:** Smoke test all 6 game routes locally:

```bash
pnpm dev
```

For each of `/snake-niv`, `/pac-niv`, `/niv-memory`, `/niv-tac-toe`, `/brick-niv`, `/whack-a-niv`:
- Loads without console errors
- Niv face visible at a reasonable size
- Game playable to a death/win/round-end
- High-score saves on reload

- [ ] **Step 3:** If any blocker found, fix inline and commit before deploying.

---

## Phase 9 — Deploy

### Task 9.1: Push + deploy

- [ ] **Step 1:** Push to GitHub

```bash
git push origin main
```

- [ ] **Step 2:** Deploy to Vercel production

```bash
vercel --prod
```

- [ ] **Step 3:** Smoke check the production URL

```bash
for p in / /snake-niv /pac-niv /niv-memory /niv-tac-toe /brick-niv /whack-a-niv; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://niv-mini-games.vercel.app$p")
  echo "$code  $p"
done
```

All should be 200. If any is not, investigate before reporting done.

- [ ] **Step 4:** Report the URL.

---

## Self-Review

**1. Spec coverage:** Each user complaint (memory bug, pac-niv scale, snake-niv scale + controls, whack rotation + speed, tac-toe rotation, brick width + labels) has a dedicated task. ✓

**2. Placeholder scan:** No "TBD"/"add appropriate ..."/"similar to Task N" patterns. Every code-changing step has a code block.

**3. Type consistency:**
- `pickFace` / `pickFaces` / `pickFaceForGame` — used consistently across Tasks 5, 6 (and available to 7 via `face-pool.ts`).
- `SPAWN_P_START` / `SPAWN_P_END` / `ROUND_MS` — defined once in Task 5.1, referenced in 5.1 only. Old `SPAWN_P_PER_TICK` aliased for legacy callers.
- `MAZE_W = 17`, `MAZE_H = 19` — defined Task 3.1, referenced Task 3.2.
- `GRID = 12` — defined Task 4.1, used in Task 4.1 only.
- `DPad` — defined Task 4.2, used Task 4.2 only.
- Renderer `cell` state — defined and consumed within the same task per game.

**4. Don't-break checklist:**
- Manifest types in `lib/niv-types.ts` — untouched. ✓
- Store schema — untouched. ✓
- Achievement engine + UnlockToast + GameFrame — untouched. ✓
- All milestones still fire (no engine logic removed, only sizing/inputs/spawn-pace changed). ✓
- Existing tests should still pass after constant updates; tests adjusted explicitly only when their assertions reference removed constants.

**5. Risks:**
- Pac-Niv maze rewrite is the highest-risk task — ghost AI behavior + pellet count assertions could regress. Mitigation: verify in browser that ghosts move + collide reasonably; if a test asserts a specific pellet count, update it to count `.` chars in the new layout.
- Snake D-pad: pointerdown handler on absolute-positioned buttons inside a `touch-action: none` parent. Mitigation: each button has its own `touch-none` and `e.preventDefault()`.
- Brick side panel: image above canvas on portrait could push canvas off-screen on small phones. Mitigation: image is 120px square — fits 390px viewport with room.
