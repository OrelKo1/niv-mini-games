import { describe, it, expect, vi } from "vitest";

vi.mock("../niv-manifest", () => ({
  NIV_MANIFEST: {
    version: 1 as const,
    generatedAt: "",
    assets: [
      {
        slug: "a",
        caption: "",
        tier: "bronze",
        game: "snake-niv",
        milestone: "m1",
        paths: { avatar64: "/a64", avatar128: "/a128", avatar256: "/a256", portrait720: "/a720" },
      },
      {
        slug: "b",
        caption: "",
        tier: "silver",
        game: "whack-a-niv",
        milestone: "m2",
        paths: { avatar64: "/b64", avatar128: "/b128", avatar256: "/b256", portrait720: "/b720" },
      },
      {
        slug: "c",
        caption: "",
        tier: "gold",
        game: "niv-tac-toe",
        milestone: "m3",
        paths: { avatar64: "/c64", avatar128: "/c128", avatar256: "/c256", portrait720: "/c720" },
      },
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
