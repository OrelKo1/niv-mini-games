import {
  BOARD_BY_DIFFICULTY,
  type Difficulty,
  type MemoryCard,
  type MemoryState,
  type RNG,
} from "./types";

/** Mulberry32 RNG — deterministic for tests. */
export function makeRng(seed: number): RNG {
  let t = seed >>> 0;
  return {
    next: () => {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = t;
      r = Math.imul(r ^ (r >>> 15), r | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    },
  };
}

function shuffle<T>(arr: T[], rng: RNG): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Start a new game. `slugPool` is the pool of unique asset slugs to draw
 * pairs from. Caller is responsible for supplying enough unique slugs
 * (manifest assets, optionally supplemented from other games' tiers).
 */
export function start(
  difficulty: Difficulty,
  slugPool: string[],
  rng: RNG = makeRng(Date.now() & 0xffffffff),
  now: number = Date.now()
): MemoryState {
  const { pairs } = BOARD_BY_DIFFICULTY[difficulty];
  const unique = Array.from(new Set(slugPool));
  if (unique.length < pairs) {
    // Pad with synthetic slugs to keep engine total — UI should avoid this case.
    while (unique.length < pairs) unique.push(`fallback-${unique.length}`);
  }
  const chosen = shuffle(unique, rng).slice(0, pairs);
  const deck: MemoryCard[] = [];
  let id = 0;
  for (const slug of chosen) {
    deck.push({ id: id++, slug, flipped: false, matched: false });
    deck.push({ id: id++, slug, flipped: false, matched: false });
  }
  const cards = shuffle(deck, rng);
  return {
    difficulty,
    cards,
    moves: 0,
    mismatches: 0,
    streak: 0,
    status: "playing",
    startedAt: now,
  };
}

/**
 * Flip a card. No-op when:
 *  - status is won
 *  - card is matched or already flipped
 *  - both selections are already taken (caller must resolve() first)
 */
export function flip(state: MemoryState, id: number): MemoryState {
  if (state.status !== "playing") return state;
  if (state.firstSelection !== undefined && state.secondSelection !== undefined)
    return state;
  const target = state.cards.find((c) => c.id === id);
  if (!target) return state;
  if (target.matched || target.flipped) return state;

  const cards = state.cards.map((c) =>
    c.id === id ? { ...c, flipped: true } : c
  );

  if (state.firstSelection === undefined) {
    return { ...state, cards, firstSelection: id };
  }
  // setting second selection counts as a "move"
  return {
    ...state,
    cards,
    secondSelection: id,
    moves: state.moves + 1,
  };
}

/**
 * Resolve the current pair (must be called after both selections set).
 * - On match: both stay flipped + matched, streak++.
 * - On mismatch: both unflip, mismatches++, streak=0.
 * Sets status=won if every card is matched after resolution.
 */
export function resolve(
  state: MemoryState,
  now: number = Date.now()
): MemoryState {
  if (
    state.firstSelection === undefined ||
    state.secondSelection === undefined
  )
    return state;
  const first = state.cards.find((c) => c.id === state.firstSelection);
  const second = state.cards.find((c) => c.id === state.secondSelection);
  if (!first || !second) return state;

  const isMatch = first.slug === second.slug;
  let cards: MemoryCard[];
  let streak = state.streak;
  let mismatches = state.mismatches;

  if (isMatch) {
    cards = state.cards.map((c) =>
      c.id === first.id || c.id === second.id
        ? { ...c, matched: true, flipped: true }
        : c
    );
    streak = state.streak + 1;
  } else {
    cards = state.cards.map((c) =>
      c.id === first.id || c.id === second.id
        ? { ...c, flipped: false }
        : c
    );
    streak = 0;
    mismatches = state.mismatches + 1;
  }

  const allMatched = cards.every((c) => c.matched);
  return {
    ...state,
    cards,
    streak,
    mismatches,
    firstSelection: undefined,
    secondSelection: undefined,
    status: allMatched ? "won" : "playing",
    finishedAt: allMatched ? now : state.finishedAt,
  };
}

/** Convenience selectors */
export function bothSelected(state: MemoryState): boolean {
  return (
    state.firstSelection !== undefined && state.secondSelection !== undefined
  );
}
