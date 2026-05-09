import { describe, it, expect, beforeEach } from "vitest";
import { useNivStore } from "./use-niv-store";

beforeEach(() => {
  localStorage.clear();
  useNivStore.setState({
    highScores: {},
    unlocks: [],
    settings: { sound: true, haptics: true, crt: true },
    konami: false,
  });
});

describe("useNivStore", () => {
  it("starts with empty unlocks and zero scores", () => {
    const s = useNivStore.getState();
    expect(s.unlocks).toEqual([]);
    expect(Object.keys(s.highScores)).toHaveLength(0);
  });

  it("records a high score only if higher", () => {
    const { recordScore } = useNivStore.getState();
    expect(recordScore("snake-niv", 100)).toBe(true);
    expect(useNivStore.getState().highScores["snake-niv"]).toBe(100);
    expect(recordScore("snake-niv", 50)).toBe(false);
    expect(useNivStore.getState().highScores["snake-niv"]).toBe(100);
    expect(recordScore("snake-niv", 200)).toBe(true);
    expect(useNivStore.getState().highScores["snake-niv"]).toBe(200);
  });

  it("unlocks are idempotent", () => {
    const { unlock } = useNivStore.getState();
    expect(unlock("abc")).toBe(true);
    expect(unlock("abc")).toBe(false);
    expect(useNivStore.getState().unlocks).toEqual(["abc"]);
  });

  it("toggleSetting flips a single setting", () => {
    const { toggleSetting } = useNivStore.getState();
    expect(useNivStore.getState().settings.sound).toBe(true);
    toggleSetting("sound");
    expect(useNivStore.getState().settings.sound).toBe(false);
    expect(useNivStore.getState().settings.haptics).toBe(true);
  });
});
