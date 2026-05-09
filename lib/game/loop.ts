export interface LoopHandle {
  start: () => void;
  stop: () => void;
  _tick: (now: number) => void;
}

export function makeFixedStepLoop(opts: {
  stepMs: number;
  step: () => void;
  render?: () => void;
}): LoopHandle {
  const { stepMs, step, render } = opts;
  let acc = 0;
  let last = NaN;
  let raf = 0;
  let running = false;

  const tick = (now: number) => {
    if (Number.isNaN(last)) {
      last = now;
      if (running) raf = requestAnimationFrame(tick);
      return;
    }
    acc += now - last;
    last = now;
    let safety = 8;
    while (acc >= stepMs && safety-- > 0) {
      step();
      acc -= stepMs;
    }
    render?.();
    if (running) raf = requestAnimationFrame(tick);
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = NaN;
      acc = 0;
      raf = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    _tick: tick,
  };
}
