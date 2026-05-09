# Nivtendo — Scaling & Fixes Plan (v2 after review)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Tasks 1-2 are sequential (bug fix + shared helper). Tasks 3-7 are independent and dispatch as parallel subagents. Tasks 8-9 are sequential (verify + deploy).

**Goal:** Make Nivtendo readable on mobile — bigger Niv faces, bigger memes, bigger bricks, smoother controls — without changing game topology that already works. Fix the game-breaking Memory bug. Rotate Niv faces in games where the same face shows over and over.

**Architecture insight (from reviewer + user feedback):** Don't redraw maze layouts by hand — keep the canonical Google-doodle / classic-arcade geometries (Pac-Man 28×31, Snake 15×17) since those topologies are tested by millions of players and our engines already implement their rules correctly. The actual fix is **CSS-scaled canvases + bigger sprites**: render the canvas at its logical pixel size and apply `width: 95vmin` / `max-width` etc. so it visually fills mobile viewports. Niv's face becomes 2-3× bigger without one line of game-logic change. References: Google Pac-Man Doodle (2010), Google Snake (2019 anniversary).

**Tech Stack:** Same as before. No new deps.

**Spec:** `docs/superpowers/specs/2026-05-09-nivtendo-design.md`. **Site:** https://niv-mini-games.vercel.app. **Repo:** https://github.com/OrelKo1/niv-mini-games.

---

## Conventions

- **Working dir:** `/Users/orelkozachi/Desktop/OREL/code_projects/claude_active_projects/niv_mini_games`
- **Commit author:** `git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "..."`
- **Test runner:** `pnpm test`, `pnpm typecheck`, `pnpm build`.
- **Don't break:** `lib/niv-types.ts`, store schema, achievement engine, video splash, UnlockToast. Don't refactor maze geometry. Don't change engine signatures unless a task explicitly says to.
- **TDD scope:** apply to deterministic logic. Visual scaling verified in browser.

---

## What review found (and how this v2 addresses it)

| Reviewer blocker | Fix in v2 |
|---|---|
| New 17×19 Pac maze had dead ghost-house topology | **Don't rewrite the maze.** Keep canonical 28×31. Scale visually via CSS only. |
| New maze tunnel collided with ghost spawn row | Same — irrelevant once we keep the canonical layout. |
| Pac-Niv `engine.test.ts` "ghosts move" assertion would fail | No test changes needed. |
| Whack signature change breaks 5 existing test call sites | Plan now patches all 5 sites explicitly. |
| Pac-Niv `cell` state had stale-closure issue | Avoided entirely — `CELL` stays a constant; the `<canvas>` is CSS-scaled. |
| Brick side-panel breaks `<TouchPad>` pan math | Drop side panel. Fix `onPan` to use canvas `getBoundingClientRect()`. Bigger labels + fewer cols. |
| Lobby + trophy room readability not addressed | New Phase 7.5 bumps base font size + touch target sizes. |
| Brick paddle face hardcoded to single asset | Wire paddle to face-pool too. |

---

## File Structure

| Path | What changes |
|---|---|
| `app/niv-memory/page.tsx` | Bug fix in resolve effect |
| `lib/niv/face-pool.ts` (new) | Rotating Niv-face helper |
| `lib/niv/face-pool.test.ts` (new) | Helper unit tests |
| `games/pac-niv/Renderer.tsx` | CSS-scaled canvas + bigger Niv sprite |
| `games/snake-niv/types.ts` | `GRID = 15` (Google Snake doodle uses 15×17) |
| `games/snake-niv/Renderer.tsx` | CSS-scaled canvas + visible D-pad |
| `games/snake-niv/engine.test.ts` | Adjust if any test asserts spawn-position equals old `(10, 10)` |
| `components/arcade/DPad.tsx` (new) | Reusable on-screen D-pad |
| `games/whack-a-niv/types.ts` | `SPAWN_P_START` / `SPAWN_P_END` constants |
| `games/whack-a-niv/engine.ts` | Ramped spawn-probability + `pickAsset` parameter |
| `games/whack-a-niv/engine.test.ts` | All `step()` callers patched |
| `app/whack-a-niv/page.tsx` | Pass `pickFaceForGame` as `pickAsset` |
| `games/niv-tac-toe/Board.tsx` | Accepts `faceUrl` prop |
| `app/niv-tac-toe/page.tsx` | Re-pick face on game start / restart |
| `games/brick-niv/engine.ts` | `BRICK_COLS = 5` (was 8) |
| `games/brick-niv/Renderer.tsx` | Bigger label font; rotating paddle face |
| `app/brick-niv/page.tsx` | `onPan` uses canvas rect; remove side-panel idea |
| `app/page.tsx` | Bigger title, bigger menu tiles |
| `app/trophies/page.tsx` | Bigger cards, bigger captions |
| `components/arcade/GameFrame.tsx` | Header text-size bump |

---

## Phase 1 — Memory bug (CRITICAL, do first)

### Task 1.1: Fix `niv-memory` stuck-after-first-match

**Files:**
- Modify: `app/niv-memory/page.tsx:172-204`

The current resolve effect's match-with-caption branch returns early before scheduling resolve. After a match, `firstSelection`/`secondSelection` stay set forever and `bothSelected(state)` keeps blocking new flips.

- [ ] **Step 1:** Read `app/niv-memory/page.tsx` lines 172-210.

- [ ] **Step 2:** Replace the resolve `useEffect` body (between `if (!bothSelected(state)) return;` and the closing `}, [state, slugToCaption]);`) with this:

```tsx
    const first = state.cards.find((c) => c.id === state.firstSelection);
    const second = state.cards.find((c) => c.id === state.secondSelection);
    const isMatch = first && second && first.slug === second.slug;
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

- [ ] **Step 3:** Smoke test:

```bash
pnpm dev
```
Visit `/niv-memory` (mobile devtools 390×844). Start EASY. Match two cards. Verify banner shows + cards stay matched + you can flip the next card immediately. Kill server.

- [ ] **Step 4:** Commit

```bash
git add app/niv-memory/page.tsx
git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "fix(niv-memory): unblock board after match — schedule resolve alongside caption banner"
```

---

## Phase 2 — Shared face-pool helper

### Task 2.1: `lib/niv/face-pool.ts`

**Files:**
- Create: `lib/niv/face-pool.ts`
- Create: `lib/niv/face-pool.test.ts`

- [ ] **Step 1:** Test first — `lib/niv/face-pool.test.ts`:

```ts
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
    expect(pickFace(() => 0).slug).toBe("a");
  });
  it("pickFace picks deterministically from rng", () => {
    expect(pickFace(() => 0.99).slug).toBe("c");
  });
  it("pickFaces returns N unique assets", () => {
    const arr = pickFaces(2, () => 0.5);
    expect(arr.length).toBe(2);
    expect(new Set(arr.map((a) => a.slug)).size).toBe(2);
  });
  it("pickFaceForGame prefers game-tagged assets, falls back when none exist", () => {
    expect(pickFaceForGame("whack-a-niv", () => 0).slug).toBe("b");
    expect(pickFaceForGame("brick-niv", () => 0).slug).toBe("a");
  });
});
```

- [ ] **Step 2:** Run — fails.

```bash
pnpm test lib/niv/face-pool.test.ts
```

- [ ] **Step 3:** Implement — `lib/niv/face-pool.ts`:

```ts
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

- [ ] **Step 4:** Run again — passes.

```bash
pnpm test lib/niv/face-pool.test.ts
```

- [ ] **Step 5:** Commit

```bash
git add lib/niv
git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "feat(lib): rotating niv face-pool helper"
```

---

## Phase 3 — Pac-Niv: CSS-scale the canonical 28×31 canvas

### Task 3.1: Make canvas fill the viewport via CSS

**Files:**
- Modify: `games/pac-niv/Renderer.tsx`

**Strategy:** keep `CELL = 14` (logical pixels) and the canonical 28×31 maze unchanged — that's the Google Pac-Man Doodle layout, fully tested. Add a CSS-scaled wrapper so the visual size on mobile is `min(95vw, 78vh)` regardless of internal pixel count.

- [ ] **Step 1:** Read `games/pac-niv/Renderer.tsx` and find the `<canvas>` element + its parent `<div>`.

- [ ] **Step 2:** Replace the canvas's container with a CSS-scaled wrapper. The internal `<canvas width={MAZE_W*CELL} height={MAZE_H*CELL}>` keeps its logical pixel dimensions; the wrapper applies CSS sizing:

```tsx
<div className="flex-1 flex items-center justify-center p-2">
  <div
    className="relative"
    style={{
      width: "min(95vw, 78dvh)",
      aspectRatio: `${MAZE_W} / ${MAZE_H}`,
    }}
  >
    <canvas
      ref={canvasRef}
      width={MAZE_W * CELL}
      height={MAZE_H * CELL}
      className="w-full h-full image-pixelated"
      style={{ imageRendering: "pixelated" }}
    />
    {/* TouchPad overlay (existing) — no changes */}
  </div>
</div>
```

(`MAZE_W=28`, `MAZE_H=31`. `aspectRatio` is the CSS ratio so the box stays the right shape on every viewport.)

- [ ] **Step 3:** Bump the Niv player sprite to 1.4× cell size for visibility. Find the line where the head is drawn (likely `ctx.drawImage(headImg, ...)`). Replace its size args:

```ts
const SPRITE_OVER = 1.4;
const sw = CELL * SPRITE_OVER;
const sh = CELL * SPRITE_OVER;
ctx.drawImage(
  headImg,
  px - (sw - CELL) / 2,
  py - (sh - CELL) / 2,
  sw,
  sh
);
```

- [ ] **Step 4:** Bump pellet + power-pellet sizes a bit (existing values like `1.5` radius become `2`, power radius from `3` to `4.5`). They're tiny on the canonical maze — values double-checked in browser.

- [ ] **Step 5:** Smoke test

```bash
pnpm dev
```
Visit `/pac-niv` (390×844 devtools): maze fills near-full width, Niv face on player clearly visible (>1cm physical), pellets visible, ghosts visible.

- [ ] **Step 6:** Type-check + tests

```bash
pnpm typecheck && pnpm test games/pac-niv
```

- [ ] **Step 7:** Commit

```bash
git add games/pac-niv
git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "feat(pac-niv): css-scaled canvas + 1.4x sprite overlay (canonical maze unchanged)"
```

---

## Phase 4 — Snake-Niv: shrink to Google-Snake-doodle 15×17 + visible D-pad

### Task 4.1: Reduce grid to 15

**Files:**
- Modify: `games/snake-niv/types.ts`
- Possibly modify: `games/snake-niv/engine.test.ts` (only if a test asserts a hard-coded spawn position outside the imported `GRID_SIZE` constant)

Google Snake's anniversary doodle uses a 15×17 grid. We use a square 15×15 for portrait simplicity.

- [ ] **Step 1:** In `games/snake-niv/types.ts`, change:

```ts
export const GRID_SIZE = 15;
```

(Was 20.)

- [ ] **Step 2:** Run tests — most should still pass since they import `GRID_SIZE` rather than hard-coding 20.

```bash
pnpm test games/snake-niv
```

- [ ] **Step 3:** If a test fails because the snake's initial spawn at `(7,7)` collides with a deterministic seed-spawned food, OR a test asserts `(10, 10)` literal coords, **read the failing test**, identify the literal, and either:
  - replace the literal with `Math.floor(GRID_SIZE / 2)`-style derived values, or
  - re-seed the test rng so food spawns elsewhere.

  Example: if `engine.test.ts` line N reads `expect(state.snake[0]).toEqual({ x: 10, y: 10 })`, change to:
  ```ts
  const cx = Math.floor(GRID_SIZE / 2);
  expect(state.snake[0]).toEqual({ x: cx, y: cx });
  ```

- [ ] **Step 4:** Don't commit yet — Task 4.2 also touches the renderer.

### Task 4.2: CSS-scale renderer + visible D-pad

**Files:**
- Create: `components/arcade/DPad.tsx`
- Modify: `games/snake-niv/Renderer.tsx`

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
  const Btn = ({ dir, char, cls }: { dir: Dir; char: string; cls: string }) => (
    <button
      type="button"
      aria-label={dir}
      onPointerDown={(e) => {
        e.preventDefault();
        onDir(dir);
      }}
      className={clsx(
        "absolute w-16 h-16 border-2 border-arcade-fg/60 bg-arcade-black/70",
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
    <div className={clsx("relative w-48 h-48 mx-auto select-none touch-none", className)}>
      <Btn dir="up" char="▲" cls="left-1/2 -translate-x-1/2 top-0" />
      <Btn dir="down" char="▼" cls="left-1/2 -translate-x-1/2 bottom-0" />
      <Btn dir="left" char="◄" cls="left-0 top-1/2 -translate-y-1/2" />
      <Btn dir="right" char="►" cls="right-0 top-1/2 -translate-y-1/2" />
    </div>
  );
}
```

- [ ] **Step 2:** In `games/snake-niv/Renderer.tsx`, find the outer container `<div>` that holds the canvas. The current TouchPad-overlay layout uses `relative w-[min(100vmin,560px)]` (or similar) as the inner wrap. Restructure so:

  - Outer container is `flex flex-col items-center justify-around py-2 gap-3 h-full`
  - Inside: `<div>` wrap with the canvas + TouchPad (absolute fill of THAT wrap, not the page)
  - Below the wrap: `<DPad onDir={handleDir} />` where `handleDir` is the same callback the TouchPad swipe uses (extract it to a `const handleDir = (d: Dir) => setPendingDir(d)` if not already named)

```tsx
import { DPad } from "@/components/arcade/DPad";
// inside Renderer:
const handleDir = useCallback((d: Dir) => {
  // call the existing pending-dir setter
  applyInputRef.current(d);
}, []);

return (
  <div className="flex-1 flex flex-col items-center justify-around py-3 gap-2 w-full">
    <div
      className="relative"
      style={{
        width: "min(92vw, 60dvh)",
        aspectRatio: "1 / 1",
      }}
    >
      <canvas
        ref={canvasRef}
        width={GRID_SIZE * CELL}
        height={GRID_SIZE * CELL}
        className="w-full h-full image-pixelated"
        style={{ imageRendering: "pixelated" }}
      />
      <TouchPad onSwipe={handleDir} />
    </div>
    <DPad onDir={handleDir} />
  </div>
);
```

(If the existing renderer uses a refactored `applyInput` already exposed as a callback, reuse it. The point: same handler for swipe and D-pad.)

- [ ] **Step 3:** Smoke test

```bash
pnpm dev
```
On `/snake-niv` (390×844): canvas fills ~92vw, Niv head clearly visible (~24px CSS), D-pad below is tappable and changes direction. Swipes still work too.

- [ ] **Step 4:** Type-check + tests

```bash
pnpm typecheck && pnpm test games/snake-niv
```

- [ ] **Step 5:** Commit

```bash
git add games/snake-niv components/arcade/DPad.tsx
git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "feat(snake-niv): 15x15 grid (google-snake doodle), css-scaled canvas, on-screen d-pad"
```

---

## Phase 5 — Whack-a-Niv: rotating faces + ramped spawn

### Task 5.1: Slower start ramp

**Files:**
- Modify: `games/whack-a-niv/types.ts`
- Modify: `games/whack-a-niv/engine.ts`
- Modify: `games/whack-a-niv/engine.test.ts` (5 call sites)

- [ ] **Step 1:** In `games/whack-a-niv/types.ts`, replace `SPAWN_P_PER_TICK = 0.04` with:

```ts
export const SPAWN_P_START = 0.012;
export const SPAWN_P_END = 0.045;
// Old constant retired; tests should use SPAWN_P_END directly if they need a max.
```

(Remove the `SPAWN_P_PER_TICK` export entirely — the engine and tests will be patched in this task.)

- [ ] **Step 2:** In `games/whack-a-niv/engine.ts`, change the import line and the spawn-decision line:

```ts
// remove: import { ..., SPAWN_P_PER_TICK, ... } from "./types";
// add:    import { ..., SPAWN_P_START, SPAWN_P_END, ROUND_MS, ... } from "./types";

// inside step(state, now, rng, ...):
const elapsed = state.startedAt ? Math.max(0, now - state.startedAt) : 0;
const t = Math.min(1, elapsed / ROUND_MS);
const p = SPAWN_P_START + (SPAWN_P_END - SPAWN_P_START) * t;
if (rng() < p) {
  // existing spawn block
}
```

(Confirm `ROUND_MS` is already exported from `types.ts`; if not, add `export const ROUND_MS = 30000;` there.)

- [ ] **Step 3:** **Update test call sites.** `games/whack-a-niv/engine.test.ts` calls `step(s, ..., rng)` in multiple places. Plus Task 5.2 will add a 4th param. For now, just remove any direct reference to `SPAWN_P_PER_TICK` in the tests if present, and adapt assertions that depend on a constant 0.04 probability:

```bash
grep -n "SPAWN_P_PER_TICK" games/whack-a-niv/engine.test.ts
```

If the grep returns hits, replace with `SPAWN_P_END`. If a test asserted "with rng()=0 a spawn happens" — that still holds (any value < `p` triggers a spawn, and `p >= SPAWN_P_START > 0`).

- [ ] **Step 4:** Run

```bash
pnpm test games/whack-a-niv
```

If green, hold; Task 5.2 reuses these files.

### Task 5.2: `pickAsset` parameter for per-spawn rotation

**Files:**
- Modify: `games/whack-a-niv/engine.ts` (signature + spawn site)
- Modify: `games/whack-a-niv/engine.test.ts` (every `step()` call)
- Modify: `app/whack-a-niv/page.tsx` (pass `pickAsset`)
- Modify: `games/whack-a-niv/Holes.tsx` (verify it uses `hole.asset.paths.avatar128`)

- [ ] **Step 1:** Change the `step` signature in `engine.ts`:

```ts
import type { NivAsset } from "@/lib/niv-types";
// existing param list: (state, now, rng)
// new:
export function step(
  state: WhackState,
  now: number,
  rng: () => number,
  pickAsset: () => NivAsset
): WhackState {
  // ... existing despawn logic ...
  // at the spawn site:
  const newAsset = pickAsset();
  // assign newAsset to the new hole's `asset` field
}
```

- [ ] **Step 2:** Patch every call site in `engine.test.ts`. Find them:

```bash
grep -n "step(" games/whack-a-niv/engine.test.ts
```

For each `step(s, now, rng)`, change to `step(s, now, rng, fakePick)` where:

```ts
const fakeAsset = {
  slug: "test",
  caption: "",
  tier: "bronze" as const,
  game: "whack-a-niv" as const,
  milestone: "",
  paths: { avatar64: "", avatar128: "", avatar256: "", portrait720: "" },
};
const fakePick = () => fakeAsset;
```

Add the `fakeAsset` + `fakePick` declarations once at the top of the test file or per-`describe` as needed.

- [ ] **Step 3:** In `app/whack-a-niv/page.tsx`, import face-pool and pass it in:

```tsx
import { pickFaceForGame } from "@/lib/niv/face-pool";
// inside the component (top-level so it's stable):
const pickAsset = useCallback(() => pickFaceForGame("whack-a-niv"), []);
// at the loop step call:
nextState = step(state, now, Math.random, pickAsset);
```

(If the loop currently picks one asset at game start, **remove that selection** — it's now per-spawn inside the engine.)

- [ ] **Step 4:** In `games/whack-a-niv/Holes.tsx`, verify each rendered head uses the per-hole `hole.asset?.paths.avatar128` (not a single image prop). If it currently takes an `asset` or `face` prop from the page, remove that prop and read from `hole`.

- [ ] **Step 5:** Smoke test on `/whack-a-niv` — different Niv faces appear in different holes through the round; few back-to-back duplicates.

- [ ] **Step 6:** Type + tests

```bash
pnpm typecheck && pnpm test games/whack-a-niv
```

- [ ] **Step 7:** Commit

```bash
git add games/whack-a-niv app/whack-a-niv
git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "feat(whack-a-niv): rotating niv faces per spawn + ramped spawn rate"
```

---

## Phase 6 — Niv-Tac-Toe: rotating Niv face per game

### Task 6.1: Per-game face

**Files:**
- Modify: `games/niv-tac-toe/Board.tsx`
- Modify: `app/niv-tac-toe/page.tsx`

- [ ] **Step 1:** Read `games/niv-tac-toe/Board.tsx` to find where 'X' cells render (likely an `<Image>` or static path). Add a `faceUrl: string` prop:

```tsx
type BoardProps = {
  // ... existing fields ...
  faceUrl: string;
};
export function Board({ /* existing */, faceUrl, /* ... */ }: BoardProps) {
  // wherever 'X' was rendered with a static avatar, use faceUrl:
  // {cell === 'X' && <Image src={faceUrl} alt="X" width={64} height={64} className="image-pixelated" />}
}
```

If the board file currently has a hardcoded `pickNivAvatar()` helper or fixed path, remove it and accept the prop instead.

- [ ] **Step 2:** In `app/niv-tac-toe/page.tsx`:

```tsx
import { pickFaceForGame } from "@/lib/niv/face-pool";
// inside component:
const [faceUrl, setFaceUrl] = useState<string>(
  () => pickFaceForGame("niv-tac-toe").paths.avatar128
);

const newFace = useCallback(() => {
  setFaceUrl(pickFaceForGame("niv-tac-toe").paths.avatar128);
}, []);

// call newFace() inside:
//  - the existing onRestart handler
//  - the difficulty toggle handler
// pass to Board: <Board faceUrl={faceUrl} ... />
```

- [ ] **Step 3:** Smoke test on `/niv-tac-toe`: fresh Niv face on first load; different face after restart; different face after difficulty change.

- [ ] **Step 4:** Type + tests

```bash
pnpm typecheck && pnpm test games/niv-tac-toe
```

- [ ] **Step 5:** Commit

```bash
git add games/niv-tac-toe app/niv-tac-toe
git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "feat(niv-tac-toe): rotate niv face per game"
```

---

## Phase 7 — Brick-Niv: fewer wider bricks, bigger labels, paddle face rotation

### Task 7.1: Reshape grid + bigger labels + correct pan math

**Files:**
- Modify: `games/brick-niv/engine.ts`
- Modify: `games/brick-niv/Renderer.tsx`
- Modify: `app/brick-niv/page.tsx`

- [ ] **Step 1:** In `games/brick-niv/engine.ts`, find the brick-init block. Change the column count:

```ts
const BRICK_COLS = 5;
const BRICK_ROWS = 5;
```

(If the existing constants are named differently — `cols`, `numCols`, etc. — find them with grep and adjust.)

- [ ] **Step 2:** In `games/brick-niv/Renderer.tsx`, find the brick label `ctx.fillText` call. Replace its font with one proportional to brick width:

```ts
const labelFont = Math.max(11, Math.floor(brick.w * 0.18));
ctx.font = `${labelFont}px "Press Start 2P", monospace`;
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillStyle = "#fff";
ctx.fillText(brick.label, brick.x + brick.w / 2, brick.y + brick.h / 2);
```

(Fewer cols → bigger `brick.w` → bigger font automatically. Keep the existing background fill for the brick itself unchanged.)

- [ ] **Step 3:** Replace the hardcoded paddle face. Find `Renderer.tsx:46`-ish, the `/niv/cb2aea18265e/avatar-128.webp` literal. Hoist face selection up to the page:

  - Remove the hardcoded `IMAGE_SRC` from `Renderer.tsx`.
  - Add a `faceUrl: string` prop.
  - In `app/brick-niv/page.tsx`:

    ```tsx
    import { pickFaceForGame } from "@/lib/niv/face-pool";
    const [faceUrl, setFaceUrl] = useState(
      () => pickFaceForGame("brick-niv").paths.avatar128
    );
    // pass to <Renderer faceUrl={faceUrl} />
    // re-pick inside the existing onNewGame / restart handler:
    setFaceUrl(pickFaceForGame("brick-niv").paths.avatar128);
    ```

- [ ] **Step 4:** **Fix `onPan` math** in `app/brick-niv/page.tsx`. The current handler likely converts `clientX` against the parent-frame's bounding rect, not the canvas's. Locate the `onPan` callback (passed to `<TouchPad>`). It should:

  ```tsx
  const onPan = useCallback((x: number, _y: number, _rect: DOMRect) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const localX = ((x - r.left) / r.width) * FIELD_W;
    setPaddleX(Math.max(0, Math.min(FIELD_W, localX)));
  }, []);
  ```

  Where `canvasRef` is forwarded from `<Renderer ref={canvasRef} />` (use `forwardRef` if needed) or shared via a context — whichever is least invasive. If forward-ref is heavy, use a shared ref via prop:

  ```tsx
  const canvasRef = useRef<HTMLCanvasElement>(null);
  <Renderer canvasRef={canvasRef} faceUrl={faceUrl} ... />
  ```

  And in Renderer:

  ```tsx
  export function Renderer({ canvasRef, faceUrl, ... }: { canvasRef: RefObject<HTMLCanvasElement | null>; faceUrl: string; ... }) {
    // use canvasRef in place of any internal ref
  }
  ```

  (Adjust to whatever pattern Renderer already uses — minimal-churn refactor.)

- [ ] **Step 5:** Smoke test on `/brick-niv` (390×844): brick labels readable (≥11px), bricks wider, paddle moves correctly when dragging anywhere across the canvas, paddle face is a Niv face.

- [ ] **Step 6:** Type + tests

```bash
pnpm typecheck && pnpm test games/brick-niv
```

- [ ] **Step 7:** Commit

```bash
git add games/brick-niv app/brick-niv
git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "feat(brick-niv): 5x5 brick grid, bigger labels, rotating paddle face, canvas-relative pan"
```

---

## Phase 7.5 — Lobby & trophy room readability

### Task 7.5.1: Bigger lobby + trophies + frame headers

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/trophies/page.tsx`
- Modify: `components/arcade/GameFrame.tsx`

- [ ] **Step 1:** In `app/page.tsx`, find the menu tile `<Link>` and bump:
  - `text-[11px]` → `text-sm` (14px) on the title
  - `text-[9px]` → `text-xs` (12px) on the tagline
  - `p-3` → `p-4`
  - Mascot image: `width={96} height={96}` → `width={128} height={128}`
  - Title `text-2xl sm:text-3xl` → `text-3xl sm:text-4xl`
  - "PRESS START" font from `text-[10px]` → `text-xs`

  Concretely (excerpt):

  ```tsx
  <Link
    href={g.href}
    className="block border-2 border-arcade-fg/40 hover:border-arcade-yellow active:border-arcade-yellow active:bg-arcade-yellow/10 p-4 transition-colors h-full"
  >
    <div className={`text-sm ${g.accent}`}>{g.title}</div>
    <div className="text-xs text-arcade-fg/70 mt-1 leading-snug">{g.tagline}</div>
  </Link>
  ```

- [ ] **Step 2:** In `app/trophies/page.tsx`, bump:
  - Card grid from `grid-cols-3 sm:grid-cols-4` → `grid-cols-2 sm:grid-cols-3` (fewer per row → each card bigger)
  - Card image `width={72} height={72}` → `width={104} height={104}`
  - Card tier label `text-[7px]` → `text-[9px]`
  - Header h1 `text-[12px]` → `text-sm`
  - Filter chip `text-[8px]` → `text-[10px]`

- [ ] **Step 3:** In `components/arcade/GameFrame.tsx`, bump:
  - HOME link `text-[9px]` → `text-[11px]`
  - Title h1 `text-[11px]` → `text-sm` (14px)
  - Score block `text-[9px]` → `text-[11px]`

- [ ] **Step 4:** Smoke test

```bash
pnpm dev
```
Visit `/`, `/trophies`, and any game route at 390×844 — text should be visibly larger, menu tiles taller.

- [ ] **Step 5:** Type + build

```bash
pnpm typecheck && pnpm build
```

- [ ] **Step 6:** Commit

```bash
git add app/page.tsx app/trophies/page.tsx components/arcade/GameFrame.tsx
git -c user.name='Orel Kozachi' -c user.email='orelgalaxy@gmail.com' commit -m "feat(ui): bigger lobby tiles, trophy cards, and game frame headers"
```

---

## Phase 8 — Verify

### Task 8.1: Full pipeline

- [ ] **Step 1:**

```bash
pnpm typecheck && pnpm test && pnpm build
```

All green. If a game fails build because a parallel subagent left a regression, fix in the smallest possible patch and commit `fix:`.

- [ ] **Step 2:** Smoke test all 6 games + lobby + trophies + settings locally

```bash
pnpm dev
```

For each route: loads, no console errors, mobile layout fills viewport, Niv visible.

---

## Phase 9 — Deploy

### Task 9.1: Push + redeploy + smoke

- [ ] **Step 1:**

```bash
git push origin main
```

- [ ] **Step 2:**

```bash
vercel --prod
```

- [ ] **Step 3:** Curl-check all routes

```bash
for p in / /snake-niv /pac-niv /niv-memory /niv-tac-toe /brick-niv /whack-a-niv /trophies /settings; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://niv-mini-games.vercel.app$p")
  echo "$code  $p"
done
```

All 200. Report URL.

---

## Self-Review (v2)

**1. Spec coverage:** Each user complaint is addressed:
- "screen is too big" / "things small generally" → Phase 7.5 (lobby + trophies + frame)
- "Pac-Niv too small" → Phase 3 (CSS-scale + 1.4× sprite)
- "Snake controls hard" → Phase 4.2 (DPad)
- "Snake too small" → Phase 4 (15×15 + CSS scale)
- "Whack: rotating pictures + slower start" → Phase 5
- "Memory stuck after first match" → Phase 1
- "Tic-Tac-Toe rotating pictures" → Phase 6
- "Brick board too thin / labels small" → Phase 7

**2. Reviewer blockers:** All addressed (see "What review found" table at top).

**3. No placeholders:** Every code-changing step has the actual code. No TBDs.

**4. Type/name consistency:** `pickFaceForGame`, `SPAWN_P_START`/`SPAWN_P_END`/`ROUND_MS`, `GRID_SIZE = 15`, `BRICK_COLS = 5`, `DPad`, `faceUrl` — defined once, referenced same-name everywhere.

**5. Don't-break inventory:** Manifest types untouched. Store untouched. Achievements untouched. Veo + nanobanana outputs untouched. Engine signatures only changed in Whack (with all callers patched).

**6. Risks:**
- CSS `aspectRatio` browser support: Safari 15+, fine for our target.
- DPad `onPointerDown` on small buttons: 64px square is well above the 44pt iOS minimum.
- Whack `pickAsset` could pick the same face two spawns in a row by chance (~1% with 100 assets) — acceptable.
- Brick `canvasRef` plumbing: if `Renderer` is currently using its own internal ref, switching to a passed-in ref needs care — use prop pattern, not `forwardRef`, to keep churn low.
- Snake `GRID_SIZE` change might re-route a deterministic-RNG test if any hardcoded a 20-grid spawn position. Plan explicitly addresses this in Task 4.1 Step 3.
