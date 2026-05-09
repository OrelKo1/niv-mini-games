import { describe, it, expect, vi } from "vitest";
import { makeFixedStepLoop } from "./loop";

describe("makeFixedStepLoop", () => {
  it("calls step the right number of times for elapsed time", () => {
    const step = vi.fn();
    const loop = makeFixedStepLoop({ stepMs: 100, step });
    loop._tick(0);
    loop._tick(250);
    expect(step).toHaveBeenCalledTimes(2);
    loop._tick(310);
    expect(step).toHaveBeenCalledTimes(3);
  });

  it("clamps catch-up to a safety bound", () => {
    const step = vi.fn();
    const loop = makeFixedStepLoop({ stepMs: 16, step });
    loop._tick(0);
    loop._tick(10000);
    expect(step.mock.calls.length).toBeLessThanOrEqual(8);
  });
});
