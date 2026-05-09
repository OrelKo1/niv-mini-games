import { NIV_MANIFEST } from "../niv-manifest";

export interface MilestoneEvent {
  milestone: string;
}

export function matchUnlocks(
  event: MilestoneEvent,
  alreadyUnlocked: string[]
): string[] {
  const owned = new Set(alreadyUnlocked);
  return NIV_MANIFEST.assets
    .filter((a) => a.milestone === event.milestone && !owned.has(a.slug))
    .map((a) => a.slug);
}
