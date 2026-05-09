import { describe, it, expect } from "vitest";
import { CAPTIONS } from "./captions";
import type { GameId, UnlockTier } from "../niv-types";

describe("CAPTIONS corpus", () => {
  it("has at least 100 entries", () => {
    expect(CAPTIONS.length).toBeGreaterThanOrEqual(100);
  });

  it("has at least 5 entries per game", () => {
    const games = new Set<GameId>(CAPTIONS.map((c) => c.game));
    games.forEach((g) => {
      const n = CAPTIONS.filter((c) => c.game === g).length;
      expect(n, `game ${g} caption count`).toBeGreaterThanOrEqual(5);
    });
  });

  it("uses all four tiers", () => {
    const tiers = new Set<UnlockTier>(CAPTIONS.map((c) => c.tier));
    (["bronze", "silver", "gold", "platinum"] as const).forEach((t) =>
      expect(tiers.has(t)).toBe(true)
    );
  });

  it("has unique milestones", () => {
    const ms = CAPTIONS.map((c) => c.milestone);
    expect(new Set(ms).size).toBe(ms.length);
  });
});
