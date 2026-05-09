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

export function pickFaceForGame(
  game: GameId,
  rng: () => number = Math.random
): NivAsset {
  const tagged = ASSETS.filter((a) => a.game === game);
  const pool = tagged.length > 0 ? tagged : ASSETS;
  const idx = Math.floor(rng() * pool.length);
  return pool[Math.min(idx, pool.length - 1)];
}
