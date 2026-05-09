import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { GameId } from "../niv-types";

interface NivState {
  highScores: Partial<Record<GameId, number>>;
  unlocks: string[];
  settings: { sound: boolean; haptics: boolean; crt: boolean };
  konami: boolean;
  recordScore: (game: GameId, score: number) => boolean;
  unlock: (slug: string) => boolean;
  toggleSetting: (key: "sound" | "haptics" | "crt") => void;
  setKonami: (v: boolean) => void;
  reset: () => void;
}

const initial = {
  highScores: {} as Partial<Record<GameId, number>>,
  unlocks: [] as string[],
  settings: { sound: true, haptics: true, crt: true },
  konami: false,
};

export const useNivStore = create<NivState>()(
  persist(
    (set, get) => ({
      ...initial,
      recordScore: (game, score) => {
        const cur = get().highScores[game] ?? 0;
        if (score <= cur) return false;
        set({ highScores: { ...get().highScores, [game]: score } });
        return true;
      },
      unlock: (slug) => {
        if (get().unlocks.includes(slug)) return false;
        set({ unlocks: [...get().unlocks, slug] });
        return true;
      },
      toggleSetting: (key) =>
        set({ settings: { ...get().settings, [key]: !get().settings[key] } }),
      setKonami: (v) => set({ konami: v }),
      reset: () => set(initial),
    }),
    {
      name: "nivtendo:v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        highScores: s.highScores,
        unlocks: s.unlocks,
        settings: s.settings,
        konami: s.konami,
      }),
    }
  )
);
