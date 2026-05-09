import { describe, it, expect } from "vitest";
import { start, flip, resolve, makeRng } from "./engine";

const SLUGS = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
];

describe("niv-memory engine", () => {
  it("flipping a card sets flipped=true", () => {
    const rng = makeRng(1);
    let s = start("easy", SLUGS, rng);
    const target = s.cards[0].id;
    s = flip(s, target);
    const card = s.cards.find((c) => c.id === target)!;
    expect(card.flipped).toBe(true);
    expect(s.firstSelection).toBe(target);
  });

  it("matching pairs sets matched=true and clears selections", () => {
    const rng = makeRng(2);
    let s = start("easy", SLUGS, rng);
    // find two cards with same slug
    const firstCard = s.cards[0];
    const matchCard = s.cards.find(
      (c) => c.id !== firstCard.id && c.slug === firstCard.slug
    )!;
    s = flip(s, firstCard.id);
    s = flip(s, matchCard.id);
    s = resolve(s);
    expect(s.cards.find((c) => c.id === firstCard.id)!.matched).toBe(true);
    expect(s.cards.find((c) => c.id === matchCard.id)!.matched).toBe(true);
    expect(s.firstSelection).toBeUndefined();
    expect(s.secondSelection).toBeUndefined();
  });

  it("mismatching pairs leaves them flipped pending resolve", () => {
    const rng = makeRng(3);
    let s = start("easy", SLUGS, rng);
    const firstCard = s.cards[0];
    const mismatchCard = s.cards.find((c) => c.slug !== firstCard.slug)!;
    s = flip(s, firstCard.id);
    s = flip(s, mismatchCard.id);
    // before resolve: both flipped
    expect(s.cards.find((c) => c.id === firstCard.id)!.flipped).toBe(true);
    expect(s.cards.find((c) => c.id === mismatchCard.id)!.flipped).toBe(true);
    expect(s.firstSelection).toBe(firstCard.id);
    expect(s.secondSelection).toBe(mismatchCard.id);
    // after resolve: unflipped
    s = resolve(s);
    expect(s.cards.find((c) => c.id === firstCard.id)!.flipped).toBe(false);
    expect(s.cards.find((c) => c.id === mismatchCard.id)!.flipped).toBe(false);
    expect(s.mismatches).toBe(1);
    expect(s.firstSelection).toBeUndefined();
    expect(s.secondSelection).toBeUndefined();
  });

  it("streak increments on match, resets on mismatch", () => {
    const rng = makeRng(4);
    let s = start("easy", SLUGS, rng);
    // first match
    const a = s.cards[0];
    const aMatch = s.cards.find((c) => c.id !== a.id && c.slug === a.slug)!;
    s = flip(s, a.id);
    s = flip(s, aMatch.id);
    s = resolve(s);
    expect(s.streak).toBe(1);
    // second match
    const b = s.cards.find((c) => !c.matched)!;
    const bMatch = s.cards.find((c) => c.id !== b.id && c.slug === b.slug)!;
    s = flip(s, b.id);
    s = flip(s, bMatch.id);
    s = resolve(s);
    expect(s.streak).toBe(2);
    // mismatch
    const c1 = s.cards.find((c) => !c.matched)!;
    const c2 = s.cards.find((c) => !c.matched && c.slug !== c1.slug)!;
    s = flip(s, c1.id);
    s = flip(s, c2.id);
    s = resolve(s);
    expect(s.streak).toBe(0);
  });

  it("won when all matched", () => {
    const rng = makeRng(5);
    let s = start("easy", SLUGS, rng);
    // brute force match every pair
    while (s.status !== "won") {
      const open = s.cards.filter((c) => !c.matched);
      const a = open[0];
      const aMatch = open.find((c) => c.id !== a.id && c.slug === a.slug)!;
      s = flip(s, a.id);
      s = flip(s, aMatch.id);
      s = resolve(s);
    }
    expect(s.status).toBe("won");
    expect(s.finishedAt).toBeGreaterThan(0);
    expect(s.cards.every((c) => c.matched)).toBe(true);
  });

  it("easy gives 6 pairs, medium 8, hard 15", () => {
    const rng = makeRng(6);
    expect(start("easy", SLUGS, rng).cards.length).toBe(12);
    expect(start("medium", SLUGS, rng).cards.length).toBe(16);
    expect(start("hard", SLUGS, rng).cards.length).toBe(30);
  });
});
