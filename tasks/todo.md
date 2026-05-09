# Nivtendo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Tier A games (Phase 3) are independent and dispatched as parallel subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a mobile-first arcade web app of cornerstone mini-games hijacked by Niv (face sprites, joint pellets, roast captions), deployed live on Vercel.

**Architecture:** Next.js 16 App Router + TypeScript. One route per game. Action games render to Canvas 2D; turn-based games are DOM/CSS. Shared Zustand store persists scores + unlocks to localStorage. Build-time Node script processes `niv_media/` → committed sprite/portrait assets in `public/niv/`. Optional Gemini nanobanana stylized variants for platinum unlocks.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Zustand, howler.js, Vitest + Testing Library, sharp + @vladmandic/face-api (asset pipeline), Gemini API (image gen), Vercel.

**Spec:** `docs/superpowers/specs/2026-05-09-nivtendo-design.md`

---

## Conventions Across All Tasks

- **Commit style:** Conventional Commits. `feat:`, `fix:`, `chore:`, `test:`, `refactor:`, `style:`, `docs:`. Each task ends with a commit.
- **Test runner:** `pnpm vitest run path/to/test` for one-shot; `pnpm vitest` for watch.
- **Type-check:** `pnpm tsc --noEmit` after non-trivial changes.
- **Lint:** `pnpm lint` (Next's built-in eslint).
- **Branch:** all work on `main` (single-developer project, frequent commits).
- **Working dir:** `/Users/orelkozachi/Desktop/OREL/code_projects/claude_active_projects/niv_mini_games`
- **TDD scope:** apply TDD to *deterministic* logic (snake step, ghost AI tables, minimax, achievement-rule matcher, asset-manifest builder). Rendering layers and visual polish do NOT need pre-written tests — verify in the browser.
- **No comments unless WHY is non-obvious** (per parent CLAUDE.md).

---

## Phase 0 — Toolchain & Scaffold

### Task 0.1: Verify toolchain

**Files:** none

- [ ] **Step 1:** Verify Node ≥ 20 and pnpm available

```bash
node --version && pnpm --version
```
Expected: node v20+ (or 22+); pnpm 9+. If pnpm missing: `corepack enable && corepack prepare pnpm@latest --activate`.

- [ ] **Step 2:** Verify gh and vercel CLIs

```bash
gh --version && vercel --version
```
Expected: both report versions. If missing: `brew install gh vercel-cli`.

- [ ] **Step 3:** Verify gh auth + vercel auth

```bash
gh auth status && vercel whoami
```
If either fails, stop and prompt user to log in (`gh auth login`, `vercel login`).

### Task 0.2: Initialize Next.js app in-place

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `postcss.config.mjs`, `tailwind.config.ts`, `eslint.config.mjs`

- [ ] **Step 1:** Scaffold via create-next-app into a temp dir, then move files

```bash
cd /tmp && pnpm create next-app@latest nivtendo-tmp --ts --tailwind --eslint --app --src-dir false --import-alias "@/*" --turbopack --use-pnpm --no-git
```
This avoids the interactive wizard and writes a clean baseline.

- [ ] **Step 2:** Move scaffold into project (excluding things we control)

```bash
cd /Users/orelkozachi/Desktop/OREL/code_projects/claude_active_projects/niv_mini_games
rsync -a --exclude='.git' --exclude='.gitignore' --exclude='README.md' /tmp/nivtendo-tmp/ ./
rm -rf /tmp/nivtendo-tmp
```

- [ ] **Step 3:** Install + boot once

```bash
pnpm install && pnpm dev
```
Expected: dev server up on http://localhost:3000 with Next default page. Kill it.

- [ ] **Step 4:** Commit

```bash
git add -A && git commit -m "chore: scaffold next.js app with tailwind + ts"
```

### Task 0.3: Add core deps and dev deps

**Files:** `package.json`

- [ ] **Step 1:** Install runtime deps

```bash
pnpm add zustand howler clsx tailwind-merge
pnpm add -D @types/howler vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom sharp
```

- [ ] **Step 2:** Install asset-pipeline deps

```bash
pnpm add -D tsx @vladmandic/face-api @tensorflow/tfjs-node canvas
```

(Note: `@vladmandic/face-api` needs `@tensorflow/tfjs-node` + `canvas` to run face detection in Node.)

- [ ] **Step 3:** Commit

```bash
git add package.json pnpm-lock.yaml && git commit -m "chore: add runtime + asset pipeline deps"
```

### Task 0.4: Configure Vitest

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`

- [ ] **Step 1:** `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 2:** `vitest.setup.ts`

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3:** Add scripts to `package.json`

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "prep:assets": "tsx scripts/prep-assets.ts",
    "prep:stylized": "tsx scripts/gen-stylized.ts"
  }
}
```

- [ ] **Step 4:** Smoke test — write a trivial passing test

Create `lib/__smoke__.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
describe('smoke', () => { it('runs', () => { expect(2 + 2).toBe(4); }); });
```

Run: `pnpm test`
Expected: 1 passed.

- [ ] **Step 5:** Delete the smoke test and commit

```bash
rm lib/__smoke__.test.ts
git add -A && git commit -m "chore: configure vitest"
```

### Task 0.5: Retro theme tokens + global styles

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`, `tailwind.config.ts`

- [ ] **Step 1:** Add Press Start 2P via next/font in `app/layout.tsx`

```tsx
import { Press_Start_2P } from 'next/font/google';
import './globals.css';

const pixel = Press_Start_2P({ subsets: ['latin'], weight: '400', variable: '--font-pixel' });

export const metadata = {
  title: 'Nivtendo',
  description: 'A mobile arcade hijacked by Niv.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover' as const,
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={pixel.variable}>
      <body className="bg-arcade-black text-arcade-fg font-pixel min-h-dvh antialiased">
        <div className="crt-overlay min-h-dvh">{children}</div>
      </body>
    </html>
  );
}
```

- [ ] **Step 2:** `app/globals.css` — palette + scanlines

```css
@import "tailwindcss";

:root {
  --color-arcade-black: #0a0a0a;
  --color-arcade-fg: #f4f4f4;
  --color-arcade-red: #e63946;
  --color-arcade-yellow: #ffd166;
  --color-arcade-green: #06d6a0;
  --color-arcade-blue: #118ab2;
  --color-arcade-purple: #8338ec;
}

@theme inline {
  --color-arcade-black: var(--color-arcade-black);
  --color-arcade-fg: var(--color-arcade-fg);
  --color-arcade-red: var(--color-arcade-red);
  --color-arcade-yellow: var(--color-arcade-yellow);
  --color-arcade-green: var(--color-arcade-green);
  --color-arcade-blue: var(--color-arcade-blue);
  --color-arcade-purple: var(--color-arcade-purple);
  --font-pixel: var(--font-pixel);
}

html, body { overscroll-behavior: none; }
body { -webkit-tap-highlight-color: transparent; }

.crt-overlay {
  position: relative;
}
.crt-overlay::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(0,0,0,0.18) 0px,
    rgba(0,0,0,0.18) 1px,
    transparent 1px,
    transparent 3px
  );
  z-index: 50;
  mix-blend-mode: multiply;
}

.no-scroll { touch-action: none; overscroll-behavior: contain; }
```

- [ ] **Step 3:** Verify in browser

```bash
pnpm dev
```
Open http://localhost:3000. Expected: pixel font, scanline overlay, dark background. Kill server.

- [ ] **Step 4:** Commit

```bash
git add -A && git commit -m "feat: retro theme tokens + crt overlay"
```

---

## Phase 1 — Asset Pipeline

### Task 1.1: Asset pipeline contract + manifest types

**Files:**
- Create: `lib/niv-types.ts`

- [ ] **Step 1:** Define types

```ts
export type UnlockTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type GameId =
  | 'pac-niv' | 'snake-niv' | 'niv-memory'
  | 'niv-tac-toe' | 'brick-niv' | 'whack-a-niv';

export interface NivAsset {
  slug: string;
  caption: string;
  tier: UnlockTier;
  game: GameId;
  milestone: string;
  paths: {
    avatar64: string;
    avatar128: string;
    avatar256: string;
    portrait720: string;
    stylized?: Partial<Record<'pixel' | 'renaissance' | 'anime' | 'mona', string>>;
  };
}

export interface NivManifest {
  version: 1;
  generatedAt: string;
  assets: NivAsset[];
}
```

- [ ] **Step 2:** Commit

```bash
git add lib/niv-types.ts && git commit -m "feat: niv manifest types"
```

### Task 1.2: Caption corpus

**Files:**
- Create: `lib/achievements/captions.ts`

- [ ] **Step 1:** Author 100 English roast captions, structured for milestone assignment

```ts
import type { GameId, UnlockTier } from '../niv-types';

export interface CaptionEntry {
  caption: string;
  tier: UnlockTier;
  game: GameId;
  milestone: string;
}

export const CAPTIONS: CaptionEntry[] = [
  // Pac-Niv (~20)
  { caption: "Niv eats his first joint. The bar is on the floor.", tier: 'bronze', game: 'pac-niv', milestone: 'pacniv:score:100' },
  { caption: "Three ghosts dodged. Ex still not blocked.", tier: 'bronze', game: 'pac-niv', milestone: 'pacniv:ghosts:3' },
  { caption: "First level cleared. Niv calls his mom to brag.", tier: 'silver', game: 'pac-niv', milestone: 'pacniv:level:1' },
  { caption: "Power pellet abuse. The bong has entered the chat.", tier: 'silver', game: 'pac-niv', milestone: 'pacniv:powerups:5' },
  { caption: "Score 5000. That's roughly 5000 calories of munchies.", tier: 'gold', game: 'pac-niv', milestone: 'pacniv:score:5000' },
  { caption: "All ghosts eaten in one power pellet. Mom is proud-ish.", tier: 'gold', game: 'pac-niv', milestone: 'pacniv:fourchain' },
  { caption: "10000 score. Niv is now legally a ghost himself.", tier: 'platinum', game: 'pac-niv', milestone: 'pacniv:score:10000' },
  { caption: "Cop ghost dodged for 60 seconds. Civic disobedience unlocked.", tier: 'silver', game: 'pac-niv', milestone: 'pacniv:cop:60s' },
  { caption: "Landlord eaten. Eviction notice rescinded.", tier: 'silver', game: 'pac-niv', milestone: 'pacniv:landlord:eaten' },
  { caption: "Ate a joint while three ghosts watched. Bold.", tier: 'bronze', game: 'pac-niv', milestone: 'pacniv:joint:underpressure' },
  { caption: "1000 joints consumed. Insurance has questions.", tier: 'gold', game: 'pac-niv', milestone: 'pacniv:joints:1000' },
  { caption: "Niv survives 5 minutes. His lungs do not.", tier: 'silver', game: 'pac-niv', milestone: 'pacniv:time:300s' },
  { caption: "Perfect first life. Niv is briefly competent.", tier: 'gold', game: 'pac-niv', milestone: 'pacniv:nodeath:level1' },
  { caption: "Death by Mom. The original Pac-Man boss.", tier: 'bronze', game: 'pac-niv', milestone: 'pacniv:death:mom' },
  { caption: "Death by Ex. Some things never change.", tier: 'bronze', game: 'pac-niv', milestone: 'pacniv:death:ex' },
  { caption: "Pac-Niv: Director's Cut. Score 7500.", tier: 'gold', game: 'pac-niv', milestone: 'pacniv:score:7500' },
  { caption: "100 power pellets. Niv smells like a hotbox.", tier: 'platinum', game: 'pac-niv', milestone: 'pacniv:powerups:100' },
  { caption: "Lost on the first ghost. Tutorial speedrun.", tier: 'bronze', game: 'pac-niv', milestone: 'pacniv:death:firstghost' },
  { caption: "Ghosts caught in a four-pack. Speedwagon unlocked.", tier: 'platinum', game: 'pac-niv', milestone: 'pacniv:fourchain:fast' },
  { caption: "Pac-Niv Marathon: 15 minutes alive.", tier: 'platinum', game: 'pac-niv', milestone: 'pacniv:time:900s' },

  // Snake-Niv (~18)
  { caption: "Niv eats one joint and considers himself a snake.", tier: 'bronze', game: 'snake-niv', milestone: 'snake:length:5' },
  { caption: "Length 10. Niv has a personality now.", tier: 'bronze', game: 'snake-niv', milestone: 'snake:length:10' },
  { caption: "Length 25. The snake is beginning to ask questions.", tier: 'silver', game: 'snake-niv', milestone: 'snake:length:25' },
  { caption: "Length 50. Niv refuses corporate jobs on principle.", tier: 'silver', game: 'snake-niv', milestone: 'snake:length:50' },
  { caption: "Length 100. Niv becomes the snake. The snake becomes Niv.", tier: 'gold', game: 'snake-niv', milestone: 'snake:length:100' },
  { caption: "Length 200. Niv has transcended digestion.", tier: 'platinum', game: 'snake-niv', milestone: 'snake:length:200' },
  { caption: "First falafel. Authentic.", tier: 'bronze', game: 'snake-niv', milestone: 'snake:falafel:1' },
  { caption: "Hummus tub annihilated. Hummus tub respected.", tier: 'silver', game: 'snake-niv', milestone: 'snake:hummus:1' },
  { caption: "Self-bite at length 7. Niv discovers irony.", tier: 'bronze', game: 'snake-niv', milestone: 'snake:selfbite' },
  { caption: "Wall hit at length 3. Niv was busy texting.", tier: 'bronze', game: 'snake-niv', milestone: 'snake:wall:short' },
  { caption: "Score 500. Niv reads the rules of the game.", tier: 'silver', game: 'snake-niv', milestone: 'snake:score:500' },
  { caption: "Score 1500. Niv is winning at something.", tier: 'gold', game: 'snake-niv', milestone: 'snake:score:1500' },
  { caption: "Score 3000. Snake-Niv: Endgame.", tier: 'platinum', game: 'snake-niv', milestone: 'snake:score:3000' },
  { caption: "10 joints in 30 seconds. Niv has speedrun standards.", tier: 'gold', game: 'snake-niv', milestone: 'snake:burst:10in30' },
  { caption: "Survived 3 minutes. Niv missed three calls.", tier: 'silver', game: 'snake-niv', milestone: 'snake:time:180s' },
  { caption: "No-falafel run, length 30. Niv hates Yotam.", tier: 'gold', game: 'snake-niv', milestone: 'snake:nofalafel:30' },
  { caption: "All-falafel run, length 30. Niv loves Yotam.", tier: 'gold', game: 'snake-niv', milestone: 'snake:allfalafel:30' },
  { caption: "First death. Welcome to Snake-Niv.", tier: 'bronze', game: 'snake-niv', milestone: 'snake:firstdeath' },

  // Niv-Memory (~18)
  { caption: "First match. Niv pretends he wasn't lucky.", tier: 'bronze', game: 'niv-memory', milestone: 'memory:match:1' },
  { caption: "5 matches. Niv claims he has photographic memory.", tier: 'bronze', game: 'niv-memory', milestone: 'memory:match:5' },
  { caption: "Easy board cleared. Niv has finished kindergarten.", tier: 'bronze', game: 'niv-memory', milestone: 'memory:clear:easy' },
  { caption: "Medium board cleared. Niv has finished middle school.", tier: 'silver', game: 'niv-memory', milestone: 'memory:clear:medium' },
  { caption: "Hard board cleared. Niv has finished therapy.", tier: 'gold', game: 'niv-memory', milestone: 'memory:clear:hard' },
  { caption: "Hard board, sub-2-min. Niv was definitely cheating.", tier: 'platinum', game: 'niv-memory', milestone: 'memory:clear:hard:120s' },
  { caption: "10 mismatches in a row. Niv is going through it.", tier: 'bronze', game: 'niv-memory', milestone: 'memory:miss:10' },
  { caption: "Three matches in a row. Niv enters the zone.", tier: 'silver', game: 'niv-memory', milestone: 'memory:streak:3' },
  { caption: "Five matches in a row. Niv is broadcasting live.", tier: 'gold', game: 'niv-memory', milestone: 'memory:streak:5' },
  { caption: "Easy board, perfect game. Niv frames the receipt.", tier: 'gold', game: 'niv-memory', milestone: 'memory:perfect:easy' },
  { caption: "Medium board, perfect game. Niv calls his ex.", tier: 'gold', game: 'niv-memory', milestone: 'memory:perfect:medium' },
  { caption: "Hard board, perfect game. Niv ascends.", tier: 'platinum', game: 'niv-memory', milestone: 'memory:perfect:hard' },
  { caption: "Played 5 rounds. Niv has discovered repetition.", tier: 'silver', game: 'niv-memory', milestone: 'memory:rounds:5' },
  { caption: "Played 25 rounds. Niv lives here now.", tier: 'gold', game: 'niv-memory', milestone: 'memory:rounds:25' },
  { caption: "First mismatch. Niv blames the screen.", tier: 'bronze', game: 'niv-memory', milestone: 'memory:firstmiss' },
  { caption: "Cleared a board in 15 moves flat.", tier: 'silver', game: 'niv-memory', milestone: 'memory:moves:15' },
  { caption: "Cleared with the timer below 30s. Niv is a robot.", tier: 'platinum', game: 'niv-memory', milestone: 'memory:fast:30s' },
  { caption: "Quit mid-board. Niv had a thought.", tier: 'bronze', game: 'niv-memory', milestone: 'memory:quit' },

  // Niv-Tac-Toe (~12)
  { caption: "Beat Stoned Niv. Difficulty: was-already-asleep.", tier: 'bronze', game: 'niv-tac-toe', milestone: 'xo:win:stoned' },
  { caption: "Beat Sober Niv. Mathematically impossible. Show-off.", tier: 'platinum', game: 'niv-tac-toe', milestone: 'xo:win:sober' },
  { caption: "Drew Sober Niv. The honorable outcome.", tier: 'silver', game: 'niv-tac-toe', milestone: 'xo:draw:sober' },
  { caption: "Lost to Stoned Niv. Take the L. Reflect.", tier: 'bronze', game: 'niv-tac-toe', milestone: 'xo:loss:stoned' },
  { caption: "5 wins in a row vs Stoned Niv.", tier: 'silver', game: 'niv-tac-toe', milestone: 'xo:streak:stoned:5' },
  { caption: "10 wins in a row vs Stoned Niv. Niv is very proud.", tier: 'gold', game: 'niv-tac-toe', milestone: 'xo:streak:stoned:10' },
  { caption: "Won in 3 moves. Did Niv even try.", tier: 'silver', game: 'niv-tac-toe', milestone: 'xo:win:fast' },
  { caption: "Played 25 games. Niv has made friends with the AI.", tier: 'silver', game: 'niv-tac-toe', milestone: 'xo:played:25' },
  { caption: "Played 100 games. Therapy time.", tier: 'gold', game: 'niv-tac-toe', milestone: 'xo:played:100' },
  { caption: "First game. Welcome to Niv-Tac-Toe.", tier: 'bronze', game: 'niv-tac-toe', milestone: 'xo:firstgame' },
  { caption: "Drew 3 in a row. Niv suspects the AI is bored.", tier: 'silver', game: 'niv-tac-toe', milestone: 'xo:draw:streak:3' },
  { caption: "Win + draw + win pattern. Niv is unpredictable.", tier: 'gold', game: 'niv-tac-toe', milestone: 'xo:wdw' },

  // Brick-Niv (~16)
  { caption: "First brick destroyed. 'Pay rent' is now bricks.", tier: 'bronze', game: 'brick-niv', milestone: 'brick:break:1' },
  { caption: "First power-up. Niv has multi-balls now.", tier: 'silver', game: 'brick-niv', milestone: 'brick:powerup:1' },
  { caption: "Cleared first level. Niv resigns from his job.", tier: 'silver', game: 'brick-niv', milestone: 'brick:level:1' },
  { caption: "Score 1000. Niv is canceled.", tier: 'silver', game: 'brick-niv', milestone: 'brick:score:1000' },
  { caption: "Score 3000. Niv is feared in two cities.", tier: 'gold', game: 'brick-niv', milestone: 'brick:score:3000' },
  { caption: "Score 7500. Niv: master of irresponsibility.", tier: 'platinum', game: 'brick-niv', milestone: 'brick:score:7500' },
  { caption: "Lost ball in 4 seconds. Speedrun mode.", tier: 'bronze', game: 'brick-niv', milestone: 'brick:fastloss' },
  { caption: "10 bricks in 5 seconds. Combo unleashed.", tier: 'gold', game: 'brick-niv', milestone: 'brick:burst:10in5' },
  { caption: "Smashed 'Pay rent'. Niv has standards.", tier: 'silver', game: 'brick-niv', milestone: 'brick:rent' },
  { caption: "Smashed 'Reply to mom'. Niv has chosen violence.", tier: 'silver', game: 'brick-niv', milestone: 'brick:replymom' },
  { caption: "Smashed 'Gym'. Niv is who he is.", tier: 'silver', game: 'brick-niv', milestone: 'brick:gym' },
  { caption: "Smashed 'Taxes'. The IRS sends regards.", tier: 'gold', game: 'brick-niv', milestone: 'brick:taxes' },
  { caption: "All adulting bricks smashed in one game.", tier: 'platinum', game: 'brick-niv', milestone: 'brick:adultsweep' },
  { caption: "Multi-ball survived 30 seconds. Hand of god.", tier: 'gold', game: 'brick-niv', milestone: 'brick:multi:30s' },
  { caption: "Wide paddle + slow ball + multi-ball at once.", tier: 'platinum', game: 'brick-niv', milestone: 'brick:tristack' },
  { caption: "First game. Niv lost the ball before reading rules.", tier: 'bronze', game: 'brick-niv', milestone: 'brick:firstgame' },

  // Whack-a-Niv (~16)
  { caption: "First whack. Niv felt that.", tier: 'bronze', game: 'whack-a-niv', milestone: 'whack:hit:1' },
  { caption: "10 whacks. Niv enjoys this less than you do.", tier: 'bronze', game: 'whack-a-niv', milestone: 'whack:hit:10' },
  { caption: "25 whacks. Niv is filing a report.", tier: 'silver', game: 'whack-a-niv', milestone: 'whack:hit:25' },
  { caption: "50 whacks in 30s. Carpal tunnel: unlocked.", tier: 'gold', game: 'whack-a-niv', milestone: 'whack:hit:50' },
  { caption: "75 whacks. Niv is calling his lawyer.", tier: 'platinum', game: 'whack-a-niv', milestone: 'whack:hit:75' },
  { caption: "Missed first whack. Niv laughs.", tier: 'bronze', game: 'whack-a-niv', milestone: 'whack:firstmiss' },
  { caption: "5 misses in a row. Niv is invincible today.", tier: 'bronze', game: 'whack-a-niv', milestone: 'whack:miss:5' },
  { caption: "Combo x5. Niv flinches.", tier: 'silver', game: 'whack-a-niv', milestone: 'whack:combo:5' },
  { caption: "Combo x10. Niv blocks your number.", tier: 'gold', game: 'whack-a-niv', milestone: 'whack:combo:10' },
  { caption: "Combo x20. Niv has summoned the IDF.", tier: 'platinum', game: 'whack-a-niv', milestone: 'whack:combo:20' },
  { caption: "0 whacks in 30s. Niv wins by attendance.", tier: 'bronze', game: 'whack-a-niv', milestone: 'whack:zerogame' },
  { caption: "First perfect 5s window.", tier: 'silver', game: 'whack-a-niv', milestone: 'whack:perfect5s' },
  { caption: "Hit a Niv that didn't fully emerge. Pre-crime.", tier: 'gold', game: 'whack-a-niv', milestone: 'whack:precrime' },
  { caption: "Played 10 rounds. Niv has filed restraining order.", tier: 'silver', game: 'whack-a-niv', milestone: 'whack:rounds:10' },
  { caption: "Played 50 rounds. Niv has retreated to the desert.", tier: 'gold', game: 'whack-a-niv', milestone: 'whack:rounds:50' },
  { caption: "Final hit was a clean slap on Niv's bald spot.", tier: 'platinum', game: 'whack-a-niv', milestone: 'whack:finalhit' },
];
```

(That's 100 captions, distributed across all six games.)

- [ ] **Step 2:** Test count

Create `lib/achievements/captions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CAPTIONS } from './captions';

describe('CAPTIONS corpus', () => {
  it('has at least 100 entries', () => { expect(CAPTIONS.length).toBeGreaterThanOrEqual(100); });
  it('has at least 5 entries per game', () => {
    const games = new Set(CAPTIONS.map(c => c.game));
    games.forEach(g => {
      const n = CAPTIONS.filter(c => c.game === g).length;
      expect(n, `game ${g} caption count`).toBeGreaterThanOrEqual(5);
    });
  });
  it('uses all four tiers', () => {
    const tiers = new Set(CAPTIONS.map(c => c.tier));
    ['bronze', 'silver', 'gold', 'platinum'].forEach(t => expect(tiers.has(t as any)).toBe(true));
  });
  it('has unique milestones', () => {
    const ms = CAPTIONS.map(c => c.milestone);
    expect(new Set(ms).size).toBe(ms.length);
  });
});
```

- [ ] **Step 3:** Run tests

```bash
pnpm test lib/achievements/captions.test.ts
```
Expected: 4 passed.

- [ ] **Step 4:** Commit

```bash
git add lib/achievements && git commit -m "feat: 100-entry caption corpus across all games"
```

### Task 1.3: Asset prep script (sharp-based, no face-api initially)

**Files:**
- Create: `scripts/prep-assets.ts`

> **Decision:** ship a simpler face-api-free version first that center-crops to square. Face-detection is an optimization layer added in Task 1.4 if time permits. This unblocks games faster.

- [ ] **Step 1:** Write the script

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { CAPTIONS } from '../lib/achievements/captions';
import type { NivManifest, NivAsset } from '../lib/niv-types';

const SRC_DIR = path.resolve('niv_media');
const OUT_DIR = path.resolve('public/niv');
const MANIFEST_PATH = path.resolve('lib/niv-manifest.ts');

async function main() {
  const sources = (await fs.readdir(SRC_DIR))
    .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();

  if (sources.length === 0) {
    console.error(`No source images in ${SRC_DIR}`);
    process.exit(1);
  }

  if (sources.length < CAPTIONS.length) {
    console.warn(`Only ${sources.length} photos for ${CAPTIONS.length} captions. Some captions will share assets.`);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const assets: NivAsset[] = [];

  for (let i = 0; i < CAPTIONS.length; i++) {
    const caption = CAPTIONS[i];
    const srcFile = sources[i % sources.length];
    const srcPath = path.join(SRC_DIR, srcFile);
    const slug = createHash('sha1').update(`${caption.milestone}::${srcFile}`).digest('hex').slice(0, 12);
    const dirOut = path.join(OUT_DIR, slug);
    await fs.mkdir(dirOut, { recursive: true });

    const meta = await sharp(srcPath).metadata();
    const size = Math.min(meta.width ?? 1024, meta.height ?? 1024);
    // top-third center square — heuristic for face-on portraits
    const left = Math.max(0, Math.floor(((meta.width ?? size) - size) / 2));
    const top = Math.max(0, Math.floor(((meta.height ?? size) - size) / 4));

    const square = sharp(srcPath).extract({ left, top, width: size, height: size });
    await square.clone().resize(256, 256).toFormat('webp', { quality: 88 }).toFile(path.join(dirOut, 'avatar-256.webp'));
    await square.clone().resize(128, 128).toFormat('webp', { quality: 88 }).toFile(path.join(dirOut, 'avatar-128.webp'));
    await square.clone().resize(64, 64).toFormat('webp', { quality: 88 }).toFile(path.join(dirOut, 'avatar-64.webp'));

    await sharp(srcPath)
      .resize({ width: 720, height: 720, fit: 'inside' })
      .toFormat('webp', { quality: 80 })
      .toFile(path.join(dirOut, 'portrait-720.webp'));

    assets.push({
      slug,
      caption: caption.caption,
      tier: caption.tier,
      game: caption.game,
      milestone: caption.milestone,
      paths: {
        avatar64: `/niv/${slug}/avatar-64.webp`,
        avatar128: `/niv/${slug}/avatar-128.webp`,
        avatar256: `/niv/${slug}/avatar-256.webp`,
        portrait720: `/niv/${slug}/portrait-720.webp`,
      },
    });
  }

  const manifest: NivManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    assets,
  };

  const tsContent = `// AUTO-GENERATED by scripts/prep-assets.ts. Do not edit by hand.
import type { NivManifest } from './niv-types';
export const NIV_MANIFEST: NivManifest = ${JSON.stringify(manifest, null, 2)} as const;
`;
  await fs.writeFile(MANIFEST_PATH, tsContent, 'utf8');
  console.log(`Wrote ${assets.length} assets and manifest to ${MANIFEST_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2:** Run it

```bash
pnpm prep:assets
```
Expected: console output "Wrote 100 assets and manifest…"; `lib/niv-manifest.ts` exists; `public/niv/<slug>/avatar-*.webp` files exist.

- [ ] **Step 3:** Smoke check

```bash
ls public/niv | head -5 && wc -l lib/niv-manifest.ts
```
Expected: directories listed; manifest file > 500 lines.

- [ ] **Step 4:** Commit

```bash
git add scripts/prep-assets.ts public/niv lib/niv-manifest.ts
git commit -m "feat: asset pipeline + generated niv manifest"
```

### Task 1.4 (OPTIONAL): Face-detected crops

**Skip if Phase 1 is taking >2h.** This is a polish layer.

- [ ] Add `@vladmandic/face-api` integration to `prep-assets.ts`. Detect face bbox; replace heuristic top-third crop with face-centered square (with 25% padding around bbox). Fall back to heuristic if no face detected. Re-run pipeline. Commit as `refactor: face-detected crops in asset pipeline`.

### Task 1.5 (OPTIONAL): Gemini stylized variants

**Skip if Phase 1 is taking >3h total.** Decorative.

**Files:**
- Create: `scripts/gen-stylized.ts`

- [ ] **Step 1:** Write a script that:
  - Reads `lib/niv-manifest.ts`
  - Picks the 12 platinum-tier assets
  - For each, calls Gemini `gemini-2.5-flash-image-preview` (nanobanana) with prompts: `"pixel art 16-bit sprite of this man, transparent background, square crop"`, `"renaissance oil painting of this man, gilt frame"`, `"anime portrait of this man, vivid colors"`, `"this man as the Mona Lisa, exact same pose"`
  - Saves outputs to `public/niv/<slug>/stylized-<style>.webp`
  - Updates manifest with `paths.stylized.<style>` URLs
- [ ] **Step 2:** Run with `GEMINI_API_KEY` from env. Cache; do not re-call if outputs exist.
- [ ] **Step 3:** Commit as `feat: gemini stylized platinum variants`.

---

## Phase 2 — Shared Infrastructure

### Task 2.1: Persistent Zustand store

**Files:**
- Create: `lib/store/use-niv-store.ts`, `lib/store/use-niv-store.test.ts`

- [ ] **Step 1:** Write the test first

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useNivStore } from './use-niv-store';

beforeEach(() => {
  localStorage.clear();
  useNivStore.persist?.clearStorage?.();
  useNivStore.setState(useNivStore.getInitialState());
});

describe('useNivStore', () => {
  it('starts with empty unlocks and zero scores', () => {
    const s = useNivStore.getState();
    expect(s.unlocks).toEqual([]);
    expect(Object.keys(s.highScores)).toHaveLength(0);
  });

  it('records a high score only if higher', () => {
    const { recordScore } = useNivStore.getState();
    recordScore('snake-niv', 100);
    expect(useNivStore.getState().highScores['snake-niv']).toBe(100);
    recordScore('snake-niv', 50);
    expect(useNivStore.getState().highScores['snake-niv']).toBe(100);
    recordScore('snake-niv', 200);
    expect(useNivStore.getState().highScores['snake-niv']).toBe(200);
  });

  it('unlocks are idempotent', () => {
    const { unlock } = useNivStore.getState();
    unlock('abc');
    unlock('abc');
    expect(useNivStore.getState().unlocks).toEqual(['abc']);
  });
});
```

- [ ] **Step 2:** Run — should fail (module missing).

```bash
pnpm test lib/store/use-niv-store.test.ts
```

- [ ] **Step 3:** Implement

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GameId } from '../niv-types';

interface NivState {
  highScores: Partial<Record<GameId, number>>;
  unlocks: string[];
  settings: { sound: boolean; haptics: boolean; crt: boolean };
  recordScore: (game: GameId, score: number) => boolean;
  unlock: (slug: string) => boolean;
  toggleSetting: (key: keyof NivState['settings']) => void;
  reset: () => void;
}

const initial = {
  highScores: {} as Partial<Record<GameId, number>>,
  unlocks: [] as string[],
  settings: { sound: true, haptics: true, crt: true },
};

export const useNivStore = create<NivState>()(
  persist(
    (set, get) => ({
      ...initial,
      recordScore: (game, score) => {
        const cur = get().highScores[game] ?? 0;
        if (score <= cur) return false;
        set({ highScores: { ...get().highScores, [game]: score } });
        return true;
      },
      unlock: (slug) => {
        if (get().unlocks.includes(slug)) return false;
        set({ unlocks: [...get().unlocks, slug] });
        return true;
      },
      toggleSetting: (key) => set({ settings: { ...get().settings, [key]: !get().settings[key] } }),
      reset: () => set(initial),
    }),
    {
      name: 'nivtendo:v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ highScores: s.highScores, unlocks: s.unlocks, settings: s.settings }),
    }
  )
);
```

- [ ] **Step 4:** Tests pass.

```bash
pnpm test lib/store/use-niv-store.test.ts
```
Expected: 3 passed.

- [ ] **Step 5:** Commit

```bash
git add lib/store && git commit -m "feat: persistent niv store with score + unlock logic"
```

### Task 2.2: Achievement engine

**Files:**
- Create: `lib/achievements/engine.ts`, `lib/achievements/engine.test.ts`

The engine takes milestone IDs from games and returns the slugs of any newly unlocked manifest entries.

- [ ] **Step 1:** Test

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../niv-manifest', () => ({
  NIV_MANIFEST: {
    version: 1, generatedAt: '',
    assets: [
      { slug: 'a', caption: 'x', tier: 'bronze', game: 'snake-niv', milestone: 'snake:length:5', paths: {} as any },
      { slug: 'b', caption: 'y', tier: 'silver', game: 'snake-niv', milestone: 'snake:length:25', paths: {} as any },
    ],
  },
}));

import { matchUnlocks } from './engine';

describe('matchUnlocks', () => {
  it('returns empty when nothing matches', () => {
    expect(matchUnlocks({ milestone: 'unrelated' }, [])).toEqual([]);
  });
  it('returns the slug for a matching milestone', () => {
    expect(matchUnlocks({ milestone: 'snake:length:5' }, [])).toEqual(['a']);
  });
  it('skips already-unlocked slugs', () => {
    expect(matchUnlocks({ milestone: 'snake:length:5' }, ['a'])).toEqual([]);
  });
});
```

- [ ] **Step 2:** Implement `engine.ts`

```ts
import { NIV_MANIFEST } from '../niv-manifest';

export interface MilestoneEvent { milestone: string }

export function matchUnlocks(event: MilestoneEvent, alreadyUnlocked: string[]): string[] {
  const owned = new Set(alreadyUnlocked);
  return NIV_MANIFEST.assets
    .filter(a => a.milestone === event.milestone && !owned.has(a.slug))
    .map(a => a.slug);
}
```

- [ ] **Step 3:** Test passes.

```bash
pnpm test lib/achievements/engine.test.ts
```

- [ ] **Step 4:** Commit

```bash
git add lib/achievements/engine.ts lib/achievements/engine.test.ts
git commit -m "feat: achievement engine matches milestones to unlocks"
```

### Task 2.3: Achievement React hook + Toast

**Files:**
- Create: `lib/achievements/use-achievements.ts`, `components/arcade/UnlockToast.tsx`

- [ ] **Step 1:** `useAchievements` hook

```ts
'use client';
import { useCallback, useEffect, useState } from 'react';
import { useNivStore } from '@/lib/store/use-niv-store';
import { NIV_MANIFEST } from '@/lib/niv-manifest';
import { matchUnlocks } from './engine';
import type { NivAsset } from '@/lib/niv-types';

export function useAchievements() {
  const unlocks = useNivStore(s => s.unlocks);
  const unlock = useNivStore(s => s.unlock);
  const [pending, setPending] = useState<NivAsset[]>([]);

  const fire = useCallback((milestone: string) => {
    const slugs = matchUnlocks({ milestone }, unlocks);
    if (slugs.length === 0) return;
    const newAssets: NivAsset[] = [];
    for (const slug of slugs) {
      if (unlock(slug)) {
        const a = NIV_MANIFEST.assets.find(x => x.slug === slug);
        if (a) newAssets.push(a);
      }
    }
    if (newAssets.length) setPending(p => [...p, ...newAssets]);
  }, [unlock, unlocks]);

  const dismiss = useCallback(() => setPending(p => p.slice(1)), []);
  useEffect(() => {
    if (pending.length === 0) return;
    const t = setTimeout(dismiss, 4000);
    return () => clearTimeout(t);
  }, [pending, dismiss]);

  return { fire, currentToast: pending[0] ?? null, dismissToast: dismiss };
}
```

- [ ] **Step 2:** `UnlockToast.tsx`

```tsx
'use client';
import Image from 'next/image';
import type { NivAsset } from '@/lib/niv-types';
import { clsx } from 'clsx';

const TIER_BORDER: Record<NivAsset['tier'], string> = {
  bronze: 'border-amber-700',
  silver: 'border-slate-300',
  gold: 'border-arcade-yellow',
  platinum: 'border-arcade-purple',
};

export function UnlockToast({ asset, onDismiss }: { asset: NivAsset; onDismiss: () => void }) {
  return (
    <button
      onClick={onDismiss}
      className={clsx(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,360px)]',
        'bg-arcade-black/90 border-4 p-3 flex gap-3 items-center text-left animate-toast-in',
        TIER_BORDER[asset.tier],
      )}
    >
      <Image src={asset.paths.avatar128} alt="" width={64} height={64} className="shrink-0 image-pixelated" />
      <div className="flex flex-col text-[10px] leading-tight">
        <span className="text-arcade-yellow">UNLOCK • {asset.tier.toUpperCase()}</span>
        <span className="mt-1 text-white">{asset.caption}</span>
      </div>
    </button>
  );
}
```

- [ ] **Step 3:** Add `image-pixelated` util + toast keyframes to `globals.css`

```css
.image-pixelated { image-rendering: pixelated; }
@keyframes toast-in { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
.animate-toast-in { animation: toast-in 250ms ease-out; }
```

- [ ] **Step 4:** Commit

```bash
git add lib/achievements/use-achievements.ts components/arcade/UnlockToast.tsx app/globals.css
git commit -m "feat: achievement hook + unlock toast"
```

### Task 2.4: Audio manager (lazy howler)

**Files:**
- Create: `lib/audio/sfx.ts`, `public/sfx/.keep`

- [ ] **Step 1:** SFX manager that no-ops gracefully when files are missing

```ts
'use client';
import { Howl } from 'howler';

const cache = new Map<string, Howl>();

export function playSfx(name: string, opts: { volume?: number } = {}) {
  if (typeof window === 'undefined') return;
  let h = cache.get(name);
  if (!h) {
    h = new Howl({ src: [`/sfx/${name}.mp3`, `/sfx/${name}.ogg`], volume: opts.volume ?? 0.6, preload: true, onloaderror: () => {} });
    cache.set(name, h);
  }
  h.play();
}
```

- [ ] **Step 2:** Empty placeholder

```bash
mkdir -p public/sfx && touch public/sfx/.keep
```

(Real SFX added in polish phase if time. Manager works without files — won't error visibly, just plays nothing.)

- [ ] **Step 3:** Commit

```bash
git add lib/audio public/sfx/.keep
git commit -m "feat: lazy sfx manager"
```

### Task 2.5: GameFrame + TouchPad shell components

**Files:**
- Create: `components/arcade/GameFrame.tsx`, `components/arcade/TouchPad.tsx`, `components/arcade/ScoreHUD.tsx`

- [ ] **Step 1:** `GameFrame.tsx` — page wrapper for game routes

```tsx
'use client';
import Link from 'next/link';
import { useAchievements } from '@/lib/achievements/use-achievements';
import { UnlockToast } from './UnlockToast';
import type { ReactNode } from 'react';

export function GameFrame({
  title, score, highScore, children, footer,
}: { title: string; score?: number; highScore?: number; children: ReactNode; footer?: ReactNode }) {
  const { currentToast, dismissToast } = useAchievements();
  return (
    <div className="min-h-dvh flex flex-col no-scroll">
      <header className="flex items-center justify-between px-3 py-2 border-b-2 border-arcade-fg/40">
        <Link href="/" className="text-arcade-yellow text-[10px]">◄ HOME</Link>
        <h1 className="text-[12px]">{title}</h1>
        <div className="text-[10px] text-arcade-fg/70 tabular-nums w-16 text-right">
          {typeof score === 'number' && <div>{score}</div>}
          {typeof highScore === 'number' && <div className="text-arcade-yellow/70">HI {highScore}</div>}
        </div>
      </header>
      <main className="flex-1 flex items-stretch justify-center">{children}</main>
      {footer && <footer className="border-t-2 border-arcade-fg/40 p-2">{footer}</footer>}
      {currentToast && <UnlockToast asset={currentToast} onDismiss={dismissToast} />}
    </div>
  );
}
```

- [ ] **Step 2:** `TouchPad.tsx` — 4-direction swipe + tap detector

```tsx
'use client';
import { useEffect, useRef } from 'react';

export type Dir = 'up' | 'down' | 'left' | 'right';

export function TouchPad({
  onSwipe, onTap, children,
}: { onSwipe?: (d: Dir) => void; onTap?: () => void; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    let sx = 0, sy = 0, t = 0;
    const onStart = (e: PointerEvent) => { sx = e.clientX; sy = e.clientY; t = e.timeStamp; };
    const onEnd = (e: PointerEvent) => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      const dist = Math.hypot(dx, dy);
      const dt = e.timeStamp - t;
      if (dist < 16 && dt < 350) { onTap?.(); return; }
      if (dist < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) onSwipe?.(dx > 0 ? 'right' : 'left');
      else onSwipe?.(dy > 0 ? 'down' : 'up');
    };
    el.addEventListener('pointerdown', onStart);
    el.addEventListener('pointerup', onEnd);
    return () => { el.removeEventListener('pointerdown', onStart); el.removeEventListener('pointerup', onEnd); };
  }, [onSwipe, onTap]);

  return <div ref={ref} className="absolute inset-0 touch-none select-none">{children}</div>;
}
```

- [ ] **Step 3:** `ScoreHUD.tsx`

```tsx
export function ScoreHUD({ score, label = 'SCORE' }: { score: number; label?: string }) {
  return (
    <div className="text-[10px] tabular-nums">
      <span className="text-arcade-fg/60">{label} </span>
      <span className="text-arcade-yellow">{score}</span>
    </div>
  );
}
```

- [ ] **Step 4:** Commit

```bash
git add components/arcade
git commit -m "feat: game frame + touch pad + score hud"
```

### Task 2.6: Lobby home page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1:** Replace default page with lobby

```tsx
import Link from 'next/link';

const GAMES: { id: string; title: string; href: string; tagline: string }[] = [
  { id: 'pac-niv', title: 'PAC-NIV', href: '/pac-niv', tagline: 'Eat joints. Dodge ex.' },
  { id: 'snake-niv', title: 'SNAKE-NIV', href: '/snake-niv', tagline: 'Grow a Niv.' },
  { id: 'niv-memory', title: 'NIV-MEMORY', href: '/niv-memory', tagline: 'Match the bald.' },
  { id: 'niv-tac-toe', title: 'NIV-TAC-TOE', href: '/niv-tac-toe', tagline: 'X = Niv. O = joint.' },
  { id: 'brick-niv', title: 'BRICK-NIV', href: '/brick-niv', tagline: 'Smash adulting.' },
  { id: 'whack-a-niv', title: 'WHACK-A-NIV', href: '/whack-a-niv', tagline: 'Tap fast.' },
];

export default function Home() {
  return (
    <div className="min-h-dvh flex flex-col items-center px-4 py-6">
      <h1 className="text-arcade-red text-2xl tracking-widest mt-4">NIVTENDO</h1>
      <p className="text-[10px] text-arcade-fg/60 mt-2">PRESS START</p>
      <ul className="mt-6 w-full max-w-md grid grid-cols-2 gap-3">
        {GAMES.map(g => (
          <li key={g.id}>
            <Link href={g.href} className="block border-2 border-arcade-fg/40 hover:border-arcade-yellow active:border-arcade-yellow p-3 transition-colors">
              <div className="text-[11px] text-arcade-yellow">{g.title}</div>
              <div className="text-[9px] text-arcade-fg/70 mt-1 leading-snug">{g.tagline}</div>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/trophies" className="mt-6 text-[10px] text-arcade-purple">► TROPHY ROOM</Link>
    </div>
  );
}
```

- [ ] **Step 2:** Verify

```bash
pnpm dev
```
Open browser. Expected: NIVTENDO title, 6 game tiles, trophy link. Stop server.

- [ ] **Step 3:** Commit

```bash
git add app/page.tsx
git commit -m "feat: arcade lobby"
```

### Task 2.7: Game-loop helper

**Files:**
- Create: `lib/game/loop.ts`, `lib/game/loop.test.ts`

A small RAF loop that emits fixed-timestep ticks. Used by all canvas games.

- [ ] **Step 1:** Test

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeFixedStepLoop } from './loop';

describe('makeFixedStepLoop', () => {
  it('calls step the right number of times for elapsed', () => {
    const step = vi.fn();
    const loop = makeFixedStepLoop({ stepMs: 100, step });
    loop._tick(0);
    loop._tick(250); // 2 full steps
    expect(step).toHaveBeenCalledTimes(2);
    loop._tick(310); // 1 more
    expect(step).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2:** Implement

```ts
export interface LoopHandle {
  start: () => void;
  stop: () => void;
  _tick: (now: number) => void;
}

export function makeFixedStepLoop({ stepMs, step, render }: {
  stepMs: number;
  step: () => void;
  render?: () => void;
}): LoopHandle {
  let acc = 0; let last = 0; let raf = 0; let running = false;
  const tick = (now: number) => {
    if (last === 0) last = now;
    acc += now - last;
    last = now;
    while (acc >= stepMs) { step(); acc -= stepMs; }
    render?.();
    if (running) raf = requestAnimationFrame(tick);
  };
  return {
    start() { if (running) return; running = true; last = 0; acc = 0; raf = requestAnimationFrame(tick); },
    stop() { running = false; cancelAnimationFrame(raf); },
    _tick: tick,
  };
}
```

- [ ] **Step 3:** Tests pass.

- [ ] **Step 4:** Commit

```bash
git add lib/game
git commit -m "feat: fixed-timestep game loop helper"
```

---

## Phase 3 — Games (PARALLEL DISPATCH)

> **Orchestration:** Tasks 3.1, 3.2, 3.3, 3.4 are independent. Dispatch as 4 parallel subagents using superpowers:dispatching-parallel-agents. Each subagent gets the spec + the relevant task subsection + the contract below. Tier B (3.5, 3.6) goes after Tier A merges.

### Game Contract (every game route follows this)

```
- Route: app/<game-id>/page.tsx (uses 'use client', wraps GameFrame)
- Logic: games/<game-id>/{engine,types}.ts (pure, testable, no DOM/React)
- Renderer: games/<game-id>/Renderer.tsx (canvas/dom, uses lib/game/loop)
- Tests: games/<game-id>/engine.test.ts (TDD on deterministic logic)
- Achievements: call useAchievements().fire('<milestone-id>') on milestone events
- Score: call useNivStore.getState().recordScore('<game-id>', score) on game over
- Restart: every game has a clear restart button
- Mobile: game must be playable in portrait with thumb-only controls
```

### Task 3.1: Snake-Niv (assigned: Subagent A)

**Files:**
- Create: `app/snake-niv/page.tsx`, `games/snake-niv/{engine,types,Renderer}.ts(x)`, `games/snake-niv/engine.test.ts`

**Engine spec:**
- 20x20 grid (mobile responsive). Game state: snake (cell list), dir, pendingDir, food (`joint` | `falafel` | `hummus`), score, status (`playing` | `dead`), tickCount.
- Step: snake moves 1 cell in `dir` per tick. If head == food: grow + score (joint=10, falafel=20, hummus=50) + spawn next food. If head out of bounds OR head in body: status=dead.
- Speed: 8 ticks/sec at start, +0.5/sec per 100 score (cap 16).
- Milestones to fire: `snake:length:5`, `snake:length:10`, `snake:length:25`, `snake:length:50`, `snake:length:100`, `snake:length:200`, `snake:falafel:1`, `snake:hummus:1`, `snake:selfbite`, `snake:wall:short` (death at length<5), `snake:score:500`, `snake:score:1500`, `snake:score:3000`, `snake:burst:10in30`, `snake:time:180s`, `snake:nofalafel:30`, `snake:allfalafel:30`, `snake:firstdeath`.

**Required tests (write these BEFORE implementing):**

- [ ] `step moves snake one cell in dir`
- [ ] `eating food grows snake by 1 and increases score`
- [ ] `head into wall sets status=dead`
- [ ] `head into body sets status=dead and emits selfbite milestone`
- [ ] `pendingDir applied next tick, ignored if reverse of dir`

**Renderer:**
- Canvas with cell-grid rendering. Snake head = niv avatar (use `NIV_MANIFEST.assets[0].paths.avatar64`); snake body = solid green squares; food = joint emoji 🚬 (until sprites exist).
- TouchPad swipe → setPendingDir. Keyboard arrows on desktop.

**Acceptance:**
- [ ] Pass all tests in `engine.test.ts` (5+ cases).
- [ ] Browser-test: load `/snake-niv` on mobile viewport (Chrome devtools 390x844). Swipe to play. Die. See unlock toast for `snake:firstdeath`. High score persists across reload.
- [ ] Commit: `feat: snake-niv playable end-to-end`.

### Task 3.2: Pac-Niv (assigned: Subagent B)

**Files:**
- Create: `app/pac-niv/page.tsx`, `games/pac-niv/{engine,types,Renderer,maze}.ts(x)`, `games/pac-niv/engine.test.ts`

**Engine spec:**
- Single 28x31 maze (classic Pac-Man dimensions, simplified — provide a 28x31 char-array in `maze.ts`: `#` walls, `.` pellets, `o` power pellets, ` ` empty, `P` player spawn, `G` ghost house). Use the public-domain classic maze layout (well documented).
- 4 ghosts: Cop (Blinky/chase head), Ex (Pinky/ambush 4 ahead), Landlord (Inky/flank), Mom (Clyde/random within distance).
- Power-pellet duration: 8s; ghosts → "scared" (slow + edible, 200/400/800/1600 chain bonus).
- Pellets: 10 each. Power pellet: 50.
- Win: all pellets eaten (advance level, respawn pellets, +1 speed).
- Lose: 3 lives → game over.
- Milestones: see captions (pacniv:score:100/5000/7500/10000, pacniv:ghosts:3, pacniv:level:1, pacniv:powerups:5/100, pacniv:fourchain, pacniv:fourchain:fast (<3s), pacniv:cop:60s, pacniv:landlord:eaten, pacniv:joint:underpressure (eat pellet within 1 tile of any ghost), pacniv:joints:1000, pacniv:time:300s/900s, pacniv:nodeath:level1, pacniv:death:mom/ex/firstghost).

**Required tests:**

- [ ] `step advances player one cell in dir if not wall`
- [ ] `eating pellet increments score by 10 and removes pellet`
- [ ] `power pellet sets ghosts to scared for 8s`
- [ ] `eating scared ghost in chain doubles bonus`
- [ ] `clearing all pellets advances level and refills`

**Renderer:**
- Canvas, 16px cell size. Player sprite = niv avatar64 (NIV_MANIFEST first asset). Ghosts = colored squares with caption labels (cop=blue, ex=pink, landlord=cyan, mom=orange) until proper sprites. Pellets = small yellow joint icons (text "🚬" 8px until sprite). Power pellets = larger 🌿 icons.
- TouchPad swipes change pending dir.

**Acceptance:**
- [ ] All engine tests pass.
- [ ] Browser-test: `/pac-niv` plays a clear level on mobile viewport. Game-over → high score saved.
- [ ] Commit: `feat: pac-niv playable end-to-end`.

### Task 3.3: Niv-Memory (assigned: Subagent C)

**Files:**
- Create: `app/niv-memory/page.tsx`, `games/niv-memory/{engine,types,Board}.tsx`, `games/niv-memory/engine.test.ts`

**Engine spec:**
- Difficulty: easy (4×3, 6 pairs), medium (4×4, 8 pairs), hard (6×5, 15 pairs).
- Pairs sourced from `NIV_MANIFEST.assets`. Each card has a `slug`. Match = same slug.
- State: cards (with `flipped`, `matched`), firstSelection, secondSelection, moves, mismatches, streak, status, startedAt, finishedAt.
- Flow: tap → flip. If two flipped: match → both `matched=true`, streak++, fire `memory:streak:N`; mismatch → 700ms → both unflip, mismatches++, streak=0.
- Status flips to `won` when all matched.
- Milestones: see captions.

**Required tests:**

- [ ] `flipping a card sets flipped=true`
- [ ] `matching two cards sets both matched and clears selections`
- [ ] `mismatching two cards leaves them flipped pending unflip`
- [ ] `streak increments on match, resets on mismatch`
- [ ] `won when all matched`

**UI:**
- Grid of cards. Card back = NIVTENDO logo tile. Card front = niv avatar128 + slug-derived caption strip. Animate flip with CSS 3d transform.

**Acceptance:**
- [ ] Tests pass. Browser: easy board completes; medium completes; high score = best moves+time saved.
- [ ] Commit: `feat: niv-memory playable end-to-end`.

### Task 3.4: Niv-Tac-Toe (assigned: Subagent D)

**Files:**
- Create: `app/niv-tac-toe/page.tsx`, `games/niv-tac-toe/{engine,ai,Board}.ts(x)`, `games/niv-tac-toe/engine.test.ts`, `games/niv-tac-toe/ai.test.ts`

**Engine spec:**
- 3×3 board. Player is X (Niv head); AI is O (joint).
- Two AIs: `stoned` (random; if X about to win, blocks 50% of the time) and `sober` (minimax — unbeatable).
- Milestones: see captions.

**Required tests:**

- [ ] `winner detects 8 winning lines + draw`
- [ ] `sober AI never loses` (run 20 random games; expect AI losses === 0)
- [ ] `stoned AI loses sometimes` (run 50 games; expect at least 5 player wins)
- [ ] `move() rejects taken cells`

**UI:**
- 3×3 grid, big tap targets. Difficulty toggle. Banter line above board (rotates from a small array of stoner lines). Win/loss/draw screen with restart.

**Acceptance:**
- [ ] Tests pass.
- [ ] Commit: `feat: niv-tac-toe playable end-to-end`.

### Task 3.5: Brick-Niv (Tier B — assigned after A merges)

**Files:**
- Create: `app/brick-niv/page.tsx`, `games/brick-niv/{engine,types,Renderer}.ts(x)`, `games/brick-niv/engine.test.ts`

**Engine spec:**
- Paddle (bottom, drag-to-move with TouchPad), ball (vec position+velocity), bricks (rows × cols, each with `label` + `hp`).
- Brick labels rotate from `["Pay rent", "Reply to mom", "Gym", "Taxes", "Therapy", "Diet", "Sleep", "Job"]`.
- 30% of bricks drop a power-up on break (`multi-ball`, `wide-paddle`, `slow-ball`, `joint`-points).
- Lives: 3.
- Milestones: see captions.

**Required tests:**

- [ ] `ball reflects off walls`
- [ ] `ball breaking a brick reduces hp and removes when zero`
- [ ] `ball below paddle decrements lives`
- [ ] `multi-ball spawns extra ball`

**Acceptance:**
- [ ] Tests pass. Mobile playable. Commit: `feat: brick-niv playable end-to-end`.

### Task 3.6: Whack-a-Niv (Tier B)

**Files:**
- Create: `app/whack-a-niv/page.tsx`, `games/whack-a-niv/{engine,Holes}.tsx`, `games/whack-a-niv/engine.test.ts`

**Engine spec:**
- 9 holes (3×3). Random hole pops a Niv head every 600-1100ms with random thought-bubble text. Stays for 800ms unless tapped.
- 30s round.
- Milestones: see captions.

**Required tests:**

- [ ] `tick spawns at most one head and despawns expired heads`
- [ ] `tap on active head increments score and combo`
- [ ] `tap on empty hole resets combo`

**Acceptance:**
- [ ] Tests pass. Commit: `feat: whack-a-niv playable end-to-end`.

---

## Phase 4 — Trophy Room + Settings

### Task 4.1: Trophy room route

**Files:**
- Create: `app/trophies/page.tsx`

- [ ] **Step 1:** Implement

```tsx
'use client';
import Link from 'next/link';
import Image from 'next/image';
import { NIV_MANIFEST } from '@/lib/niv-manifest';
import { useNivStore } from '@/lib/store/use-niv-store';
import { clsx } from 'clsx';

const TIER_ORDER = ['platinum', 'gold', 'silver', 'bronze'] as const;
const TIER_BORDER = { bronze: 'border-amber-700', silver: 'border-slate-300', gold: 'border-arcade-yellow', platinum: 'border-arcade-purple' } as const;

export default function Trophies() {
  const unlocks = useNivStore(s => s.unlocks);
  const set = new Set(unlocks);
  const total = NIV_MANIFEST.assets.length;
  return (
    <div className="min-h-dvh px-4 py-6">
      <div className="flex justify-between items-center">
        <Link href="/" className="text-arcade-yellow text-[10px]">◄ HOME</Link>
        <h1 className="text-[12px]">TROPHIES</h1>
        <div className="text-[10px] tabular-nums">{set.size} / {total}</div>
      </div>
      <ul className="mt-6 grid grid-cols-3 gap-2">
        {[...NIV_MANIFEST.assets]
          .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
          .map(a => {
            const owned = set.has(a.slug);
            return (
              <li key={a.slug} className={clsx('relative border-2 p-2 aspect-square flex flex-col gap-1', TIER_BORDER[a.tier], !owned && 'opacity-30 grayscale')}>
                <Image src={a.paths.avatar128} alt="" width={96} height={96} className="image-pixelated mx-auto" />
                <div className="text-[7px] leading-tight line-clamp-3">{owned ? a.caption : '???'}</div>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2:** Browser check.

- [ ] **Step 3:** Commit

```bash
git add app/trophies && git commit -m "feat: trophy room"
```

### Task 4.2: Settings drawer

**Files:**
- Create: `app/settings/page.tsx`

- [ ] **Step 1:** Implement page with sound/haptics/crt toggles + reset button (confirms via `window.confirm`).
- [ ] **Step 2:** Link from lobby footer + each GameFrame.
- [ ] **Step 3:** Commit `feat: settings page with toggles + reset`.

---

## Phase 5 — Polish

### Task 5.1: Mobile UX pass

- [ ] **Step 1:** Real device check (iOS Safari + Android Chrome via real device or BrowserStack). All games playable, no scroll-on-swipe, safe-area respected.
- [ ] **Step 2:** Fix anything that's not portrait-correct.
- [ ] **Step 3:** Add `manifest.json` with arcade-red theme color.
- [ ] **Step 4:** Add favicon (pixel-art Niv head).
- [ ] **Step 5:** Commit `feat: mobile UX polish + manifest`.

### Task 5.2: Lighthouse pass

- [ ] **Step 1:** Run Lighthouse mobile on `/` and `/pac-niv`. Target: Perf ≥85, A11y ≥95.
- [ ] **Step 2:** Fix biggest wins (image sizes, no large JS in landing).
- [ ] **Step 3:** Commit if changes made: `perf: lighthouse fixes`.

### Task 5.3: README

**Files:** `README.md`

- [ ] **Step 1:** Write a README: what it is, how to run, env vars, asset pipeline, deploy. Mention the project is for Niv with his consent.
- [ ] **Step 2:** Commit `docs: project readme`.

---

## Phase 6 — Ship

### Task 6.1: Create GitHub repo + push

- [ ] **Step 1:** Create repo

```bash
gh repo create niv-mini-games --public --source=. --remote=origin --description "Nivtendo — mobile arcade hijacked by Niv"
```

- [ ] **Step 2:** Push

```bash
git push -u origin main
```

### Task 6.2: Deploy to Vercel

- [ ] **Step 1:** Link

```bash
vercel link --yes
```

- [ ] **Step 2:** Deploy preview

```bash
vercel
```
Capture preview URL.

- [ ] **Step 3:** Smoke test the preview URL on mobile + desktop.

- [ ] **Step 4:** Promote to production

```bash
vercel --prod
```

- [ ] **Step 5:** Send the production URL to user.

---

## Self-Review Checklist (run before execution)

- [x] Spec coverage: all 6 games tasked; asset pipeline tasked; achievements tasked; trophy room tasked; mobile + lighthouse tasked; deploy tasked
- [x] No "TBD" / placeholder steps in critical-path tasks (Phases 0–4, 6). Phase 1.4 + 1.5 + 5.1 polish steps are explicitly marked optional with abort conditions.
- [x] Type names consistent (GameId, NivAsset, UnlockTier used throughout)
- [x] Commit messages spelled out at task boundaries
- [x] All file paths absolute or workspace-relative
- [x] Parallelizable phase (3) clearly marked + per-game contracts identical
