"use client";
import { useCallback, useEffect, useState } from "react";
import { useNivStore } from "@/lib/store/use-niv-store";
import { NIV_MANIFEST } from "@/lib/niv-manifest";
import { matchUnlocks } from "./engine";
import type { NivAsset } from "@/lib/niv-types";

export function useAchievements() {
  const unlocks = useNivStore((s) => s.unlocks);
  const unlock = useNivStore((s) => s.unlock);
  const [pending, setPending] = useState<NivAsset[]>([]);

  const fire = useCallback(
    (milestone: string) => {
      const slugs = matchUnlocks({ milestone }, unlocks);
      if (slugs.length === 0) return;
      const newAssets: NivAsset[] = [];
      for (const slug of slugs) {
        if (unlock(slug)) {
          const a = NIV_MANIFEST.assets.find((x) => x.slug === slug);
          if (a) newAssets.push(a as NivAsset);
        }
      }
      if (newAssets.length) setPending((p) => [...p, ...newAssets]);
    },
    [unlock, unlocks]
  );

  const dismiss = useCallback(() => setPending((p) => p.slice(1)), []);

  useEffect(() => {
    if (pending.length === 0) return;
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
  }, [pending, dismiss]);

  return { fire, currentToast: pending[0] ?? null, dismissToast: dismiss };
}
