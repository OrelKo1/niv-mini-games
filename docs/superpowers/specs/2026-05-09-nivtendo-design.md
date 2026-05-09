# Nivtendo — Design Spec

**Date:** 2026-05-09
**Status:** Approved
**Owner:** Orel (for client: Niv)

---

## 1. Vision

Nivtendo is a mobile-first retro arcade web app that hijacks classic cornerstone games with a single recurring character: Niv. Niv's face is the protagonist sprite in every game; his photos are unlockable trophies; the humor is edgy / stoner-bro / roast-a-friend. The aesthetic is pixel art with CRT scanlines and chiptune sound, deployed as a single static-ish Next.js app on Vercel.

The product exists for two audiences: Niv's circle (in-jokes land hard) and casual web visitors (the games still slap as games even if you don't know Niv). Both must enjoy it.

## 2. Brand & Tone

- **Name:** Nivtendo (Nintendo riff)
- **Logotype:** retro pixel-block wordmark, red/yellow Nintendo-ish palette but irreverent
- **Tone:** edgy stoner-bro humor. Cannabis jokes, roast captions, mock-arcade ego. PG-13ish. Never mean-spirited about real people other than Niv (consenting subject).
- **Language:** English only

## 3. Games (v1 Scope)

Six games, ranked by build priority. **Tier A** ships hard. **Tier B** is stretch.

### Tier A (must ship)

1. **Pac-Niv** — Niv's face is Pac-Man. Pellets are cannabis joints; power pellets are bongs (slow time + edible-ghost mode). Ghosts are "buzzkills": Cop, Ex, Landlord, Mom — each with classic Pac-Man personality (Blinky/chase, Pinky/ambush, Inky/flank, Clyde/random). Classic 1-level maze; speeds up as score climbs.
2. **Snake-Niv** — Snake body is a chain of tiny Niv heads. Eats joints, falafel, hummus tubs (different point values). Wall + self-collision = "blacked out" screen w/ caption.
3. **Niv-Memory** — Match pairs of Niv photos. Three difficulties (4×3, 4×4, 6×5). Each first-flip of a unique pair reveals a roast caption banner. Timer + moves tracked.
4. **Niv-Tac-Toe** — X = Niv head sprite, O = joint icon. Two AI opponents: "Stoned Niv" (random + occasional block, easy) and "Sober Niv" (minimax, unbeatable). Banter strings between moves.

### Tier B (ship if time)

5. **Brick-Niv** (Block Breaker) — Paddle = elongated Niv-head sprite. Ball = his rolling eye. Bricks labeled with adulting tasks ("Pay rent", "Reply to mom", "Gym", "Taxes", "Therapy"). Some bricks drop joint power-ups (multi-ball, wide paddle, slow ball).
6. **Whack-a-Niv** — Niv heads pop out of holes with thought bubbles. Tap fast, score-attack 30s. Smallest scope, ship as palate cleanser.

## 4. Technical Architecture

### Stack
- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS + custom retro theme tokens (8-bit color palette, pixel font: "Press Start 2P" via next/font)
- **Rendering:** Canvas 2D for action games (Pac-Niv, Snake-Niv, Brick-Niv, Whack-a-Niv). DOM/CSS for Memory and Tic-Tac-Niv.
- **State:** Zustand for in-game state, persistent slice mirrored to localStorage for high scores + unlocks.
- **Audio:** howler.js or vanilla `Audio` for chiptune SFX (under 200KB total, lazy-loaded per game).
- **Build / Deploy:** Vercel. Static where possible; only the asset-prep script runs at build time.

### Repo Layout
```
niv_mini_games/
├── app/
│   ├── layout.tsx                     # arcade shell, CRT overlay
│   ├── page.tsx                       # lobby (game grid)
│   ├── pac-niv/page.tsx
│   ├── snake-niv/page.tsx
│   ├── niv-memory/page.tsx
│   ├── niv-tac-toe/page.tsx
│   ├── brick-niv/page.tsx
│   ├── whack-a-niv/page.tsx
│   └── trophies/page.tsx              # unlocks gallery
├── components/
│   ├── arcade/                        # GameFrame, ScoreHUD, TouchPad, etc.
│   └── ui/                            # shadcn primitives
├── games/                             # game logic (one folder per game)
│   ├── pac-niv/{engine,sprites,levels}.ts
│   ├── snake-niv/...
│   └── ...
├── lib/
│   ├── store/                         # Zustand stores
│   ├── audio/                         # SFX manager
│   ├── achievements/                  # unlock rules + caption corpus
│   └── niv-manifest.ts                # generated: image manifest
├── public/
│   └── niv/                           # generated sprites (committed)
├── scripts/
│   ├── prep-assets.ts                 # niv_media → public/niv
│   └── gen-stylized.ts                # Gemini nanobanana variants
├── niv_media/                         # SOURCE PHOTOS — gitignored
├── docs/superpowers/specs/            # this file
└── tasks/                             # todo.md, lessons.md
```

### Asset Pipeline

A Node script (`scripts/prep-assets.ts`) runs once locally (or on demand) to transform `niv_media/` into web-ready sprites:

1. Read every `*.jpeg` in `niv_media/`.
2. For each: detect face bbox. Use `@vladmandic/face-api` (lightweight, runs locally) — fall back to manual centered crop if no face detected.
3. Generate variants per source:
   - **avatar-256.png** — square face crop, 256×256
   - **avatar-128.png** — 128×128
   - **avatar-64.png** — 64×64 (sprite-sized)
   - **portrait-720.webp** — full-photo, max 720px on long axis (for trophy room)
4. Write all outputs to `public/niv/{slug}/...`, where slug is a stable hash of the filename.
5. Emit `lib/niv-manifest.ts` mapping slug → caption tier + asset paths + assigned game milestone.
6. Cache: skip processing any source whose hash already has outputs.

The Gemini stylization step (`scripts/gen-stylized.ts`) is separate, opt-in:
- For ~12 hand-picked source photos, generate 4 stylized variants each (pixel-art / Renaissance / anime / Mona-Niv) via Gemini nanobanana
- Outputs go to `public/niv/{slug}/stylized-{style}.webp`
- Used as platinum-tier unlocks
- API key from `GEMINI_API_KEY` env var, **never committed**, **never sent to client**

The Veo splash video is explicitly out of scope for v1 — too much risk for too little payoff.

### State & Persistence

A single Zustand store (`useNivStore`) holds:
- `highScores: Record<GameId, number>`
- `unlocks: Set<UnlockId>`
- `settings: { sound, haptics, crtOverlay }`
- `lastPlayed: GameId | null`

Persisted slice mirrored to localStorage with a schema version. Migration on schema bump.

No accounts, no backend, no leaderboards in v1. Reset button in settings.

### Achievement System

Each game emits `score:update` and `event:milestone` events. The achievement engine:
1. Watches game events
2. Compares against `lib/achievements/rules.ts`
3. Unlocks the next available card from the Niv manifest (~100 entries)
4. Triggers a toast + adds to `unlocks` set + persists

Tiers (cosmetic gradient on the trophy card):
- **Bronze** — early/easy milestones
- **Silver** — mid-game
- **Gold** — mastery (hard milestones)
- **Platinum** — Gemini-stylized variants, rarest

Each unlock card displays: photo + caption + tier + which game/milestone. Trophy room shows all (locked = silhouette).

### Mobile UX

- Portrait-locked viewport on game pages (`viewport-fit=cover`, safe-area insets respected)
- `touch-action: none` on canvas to disable scroll-on-swipe
- Universal `<TouchPad>` overlay component: swipe-to-direction for Snake/Pac, drag-paddle for Brick, tap for everything else
- Haptics via `navigator.vibrate` on supported devices, gated behind setting
- Desktop keyboard fallback: WASD/Arrow keys auto-detected
- Lighthouse mobile target: Performance ≥90, Accessibility ≥95

## 5. Data Flow

```
[niv_media/]                                          [Gemini API]
    │                                                       │
    ▼                                                       ▼
prep-assets.ts ────────► public/niv/      gen-stylized.ts ─►(same)
    │                       │
    └───────► niv-manifest.ts ──┐
                                ▼
                        achievements/rules.ts
                                │
                                ▼
   Game ──score/event──► useNivStore ──unlock──► <TrophyToast/>
                                │                     │
                                ▼                     ▼
                       localStorage          /trophies route
```

## 6. Error Handling

- **Asset pipeline failures:** log + skip individual photo; never break the whole build. Manifest entries are skipped if assets are missing.
- **Gemini failures:** non-blocking; platinum tier just stays smaller. Retry with backoff once, then skip.
- **localStorage errors / quota exceeded:** in-memory fallback; a settings toggle wipes storage if corrupted.
- **Missing sprite at runtime:** fall back to a default Niv silhouette; never crash a game.
- **Game crashes:** error boundary per game route, "Niv broke this one" screen with restart button.

## 7. Testing Strategy

- **Unit** (Vitest): pure game logic (Snake step function, Pac-Niv ghost AI scatter/chase tables, Tic-Tac-Niv minimax) — these are deterministic and worth testing.
- **Component** (Vitest + Testing Library): trophy unlock flow, score persistence, settings toggles.
- **Manual E2E checklist:** each game played to game-over on real iOS Safari + Android Chrome before final deploy. UI changes are not "done" until verified in browser per CLAUDE.md global rules.
- **No Cypress/Playwright in v1** — scope creep.

## 8. Out of Scope (v1)

- User accounts, OAuth, online leaderboards
- Multiplayer
- Veo splash video
- Multi-language (locked English-only)
- PWA install / offline mode
- Mobile app (web only)
- Custom domain (use `*.vercel.app`)

## 9. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Pixel-art-from-photo looks bad | High | Use Gemini stylization for hero/platinum assets; raw photos used only for trophy cards (not sprite-art) |
| Pac-Man ghost AI is hard | Medium | Implement classic personalities directly from the well-documented original Pac-Man spec; ship one level only |
| Gemini quota / cost runaway | Low | Generate ~48 images total, one-time, cache to disk, never regen on rebuild |
| Touch controls feel laggy | Medium | Test early on real device; use `requestAnimationFrame` + `pointer events`; no React renders inside game loops |
| Spec ships, captions don't | Medium | Caption corpus is task #5, blocks final deploy |
| Niv photos exposing private info | Low | Source dir gitignored; only processed face crops + portraits committed |

## 10. Success Criteria

A v1 ship is "done" when:
1. All Tier A games (4) are playable to completion on iOS Safari and Android Chrome
2. Each game has at least 5 unlockable Niv trophies
3. Trophy room shows progress
4. App is deployed at a live `*.vercel.app` URL
5. Lighthouse mobile Performance ≥85 (relax from 90 if needed for sprite weight)
6. The link sent to Orel works end-to-end without manual setup

## 11. Open Questions (none blocking)

None at spec time. Captions, stylized art selections, and minor visual choices are within the implementer's autonomy per Orel's mandate.
