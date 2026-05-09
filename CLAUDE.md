# Nivtendo — Project Instructions

A mobile-first retro arcade web app of cornerstone mini-games hijacked by a recurring character: Niv. Deployed to Vercel.

## Phase

v1 build — going from 0 to deployed. Spec approved 2026-05-09.

## File Map

| Path | What's there |
|---|---|
| `docs/superpowers/specs/` | Approved design specs |
| `tasks/todo.md` | Current implementation plan + progress |
| `tasks/lessons.md` | Correction patterns (digest into project rules when stable) |
| `app/` | Next.js App Router pages (lobby + one route per game) |
| `games/` | Game logic (one folder per game) |
| `components/arcade/` | Shared arcade shell (frames, HUD, touchpad) |
| `lib/store/` | Zustand stores + persistence |
| `lib/achievements/` | Unlock rules + caption corpus |
| `lib/niv-manifest.ts` | Generated image manifest (do not hand-edit) |
| `public/niv/` | Generated sprite/portrait assets (committed) |
| `niv_media/` | **Source photos — gitignored, never commit** |
| `scripts/prep-assets.ts` | niv_media → public/niv pipeline |
| `scripts/gen-stylized.ts` | Gemini nanobanana stylized variants |

## Rules Specific to This Project

- **Never commit `niv_media/`** — privacy. Only `public/niv/` (processed) goes in git.
- **Never commit `.env*`** — `GEMINI_API_KEY` lives in `.env.local` and Vercel env vars only.
- Game logic must be pure/testable. No DOM access inside game step functions; only the renderer touches canvas.
- React renders MUST NOT happen inside game animation loops. Use refs + `requestAnimationFrame`.
- Mobile-first: every game playable in portrait with thumb-only controls before keyboard fallback is added.
- Use the `Skill` tool for `superpowers:*` skills (writing-plans, subagent-driven-development, etc.) at the right phase boundaries.

## Inheritance

Inherits all rules from `/Users/orelkozachi/Desktop/OREL/code_projects/CLAUDE.md`. Project rules above extend or override where stated.
