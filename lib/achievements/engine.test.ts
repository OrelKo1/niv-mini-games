import { describe, it, expect, vi } from "vitest";

vi.mock("../niv-manifest", () => ({
  NIV_MANIFEST: {
    version: 1 as const,
    generatedAt: "",
    assets: [
      {
        slug: "a",
        caption: "x",
        tier: "bronze",
        game: "snake-niv",
        milestone: "snake:length:5",
        paths: {} as never,
      },
      {
        slug: "b",
        caption: "y",
        tier: "silver",
        game: "snake-niv",
        milestone: "snake:length:25",
        paths: {} as never,
      },
    ],
  },
}));

import { matchUnlocks } from "./engine";

describe("matchUnlocks", () => {
  it("returns empty when nothing matches", () => {
    expect(matchUnlocks({ milestone: "unrelated" }, [])).toEqual([]);
  });
  it("returns the slug for a matching milestone", () => {
    expect(matchUnlocks({ milestone: "snake:length:5" }, [])).toEqual(["a"]);
  });
  it("skips already-unlocked slugs", () => {
    expect(matchUnlocks({ milestone: "snake:length:5" }, ["a"])).toEqual([]);
  });
});
