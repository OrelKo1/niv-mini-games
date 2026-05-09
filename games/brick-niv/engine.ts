import {
  ADULTING_LABELS,
  BALL_BASE_SPEED,
  BALL_R,
  BRICK_COLS,
  BRICK_GAP,
  BRICK_H,
  BRICK_LABELS,
  BRICK_LEFT_PAD,
  BRICK_ROWS,
  BRICK_TOP_PAD,
  BRICK_W,
  FIELD_H,
  FIELD_W,
  PADDLE_BASE_W,
  PADDLE_H,
  PADDLE_Y,
  POWERUP_DROP_VY,
  POWERUP_DURATION_MS,
  POWERUP_SIZE,
  SCORE_PER_BREAK,
  type Ball,
  type Brick,
  type BrickState,
  type PowerUpDrop,
  type PowerUpKind,
} from "./types";

const POWERUP_KINDS: PowerUpKind[] = [
  "multi-ball",
  "wide-paddle",
  "slow-ball",
  "joint",
];

function pickPowerUp(seed: number): PowerUpKind {
  // simple deterministic-ish picker
  const idx = Math.abs(Math.floor(seed * 9301 + 49297)) % POWERUP_KINDS.length;
  return POWERUP_KINDS[idx];
}

function makeBricks(level: number): Brick[] {
  const bricks: Brick[] = [];
  let labelIdx = 0;
  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      const label = BRICK_LABELS[labelIdx % BRICK_LABELS.length];
      labelIdx++;
      // higher levels add HP to top rows
      const baseHp = 1 + Math.max(0, Math.min(level - 1, 2));
      const rowBonus = row < 2 && level > 1 ? 1 : 0;
      const hp = baseHp + rowBonus;
      // 30% chance of dropping power-up (deterministic by row/col so tests stable)
      const seed = (row * 31 + col * 17 + level * 7) % 100;
      const dropsPowerUp = seed < 30;
      bricks.push({
        x: BRICK_LEFT_PAD + col * (BRICK_W + BRICK_GAP),
        y: BRICK_TOP_PAD + row * (BRICK_H + BRICK_GAP),
        w: BRICK_W,
        h: BRICK_H,
        label,
        hp,
        maxHp: hp,
        dropsPowerUp,
      });
    }
  }
  return bricks;
}

function makeBall(): Ball {
  // Launches up-right by default
  const speed = BALL_BASE_SPEED;
  const angle = -Math.PI / 3 + Math.random() * (Math.PI / 6); // ~ -60° to -30°
  return {
    x: FIELD_W / 2,
    y: PADDLE_Y - BALL_R - 1,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}

export function start(level = 1): BrickState {
  return {
    paddle: {
      x: FIELD_W / 2,
      y: PADDLE_Y,
      width: PADDLE_BASE_W,
    },
    balls: [makeBall()],
    bricks: makeBricks(level),
    powerUps: [],
    score: 0,
    lives: 3,
    level,
    status: "playing",
    multiBallActiveMs: 0,
    effects: { widePaddleMs: 0, slowBallMs: 0 },
    events: { brokenBricks: [], collectedPowerUps: [], ballsLostThisStep: 0 },
    roundElapsedMs: 0,
    recentBreakTimes: [],
    adultingSmashed: [],
    fieldW: FIELD_W,
    fieldH: FIELD_H,
  };
}

export function setPaddleX(state: BrickState, x: number): void {
  const half = state.paddle.width / 2;
  state.paddle.x = Math.max(half, Math.min(state.fieldW - half, x));
}

export function applyPowerUp(state: BrickState, kind: PowerUpKind): void {
  state.events.collectedPowerUps.push(kind);
  if (kind === "multi-ball") {
    if (state.balls.length === 0) return;
    const src = state.balls[0];
    const speed = Math.hypot(src.vx, src.vy) || BALL_BASE_SPEED;
    const angles = [Math.PI / 6, -Math.PI / 6];
    for (const a of angles) {
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      state.balls.push({
        x: src.x,
        y: src.y,
        vx: src.vx * cos - src.vy * sin,
        vy: src.vx * sin + src.vy * cos,
      });
    }
  } else if (kind === "wide-paddle") {
    state.paddle.width = PADDLE_BASE_W * 1.5;
    state.effects.widePaddleMs = POWERUP_DURATION_MS;
  } else if (kind === "slow-ball") {
    if (state.effects.slowBallMs <= 0) {
      for (const b of state.balls) {
        b.vx *= 0.7;
        b.vy *= 0.7;
      }
    }
    state.effects.slowBallMs = POWERUP_DURATION_MS;
  } else if (kind === "joint") {
    state.score += 500;
  }
}

function reflectBallOnBrick(ball: Ball, brick: Brick): void {
  // Determine collision side by comparing penetration depths
  const ballR = BALL_R;
  const cx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
  const cy = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  if (Math.abs(dx) > Math.abs(dy)) {
    ball.vx = dx >= 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
    // push out
    ball.x = dx >= 0 ? brick.x + brick.w + ballR : brick.x - ballR;
  } else {
    ball.vy = dy >= 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
    ball.y = dy >= 0 ? brick.y + brick.h + ballR : brick.y - ballR;
  }
}

function ballHitsBrick(ball: Ball, brick: Brick): boolean {
  const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
  const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  return dx * dx + dy * dy <= BALL_R * BALL_R;
}

export function step(state: BrickState, dtMs: number): void {
  // Reset per-step events
  state.events = {
    brokenBricks: [],
    collectedPowerUps: [],
    ballsLostThisStep: 0,
  };

  if (state.status !== "playing") return;

  state.roundElapsedMs += dtMs;

  // Tick effects
  if (state.effects.widePaddleMs > 0) {
    state.effects.widePaddleMs -= dtMs;
    if (state.effects.widePaddleMs <= 0) {
      state.effects.widePaddleMs = 0;
      state.paddle.width = PADDLE_BASE_W;
    }
  }
  if (state.effects.slowBallMs > 0) {
    state.effects.slowBallMs -= dtMs;
    if (state.effects.slowBallMs <= 0) {
      // restore
      for (const b of state.balls) {
        const speed = Math.hypot(b.vx, b.vy);
        if (speed > 0) {
          const factor = BALL_BASE_SPEED / speed;
          b.vx *= factor;
          b.vy *= factor;
        }
      }
      state.effects.slowBallMs = 0;
    }
  }

  // multi-ball cumulative timer
  if (state.balls.length >= 2) {
    state.multiBallActiveMs += dtMs;
  }

  // Move balls
  for (const ball of state.balls) {
    ball.x += ball.vx * dtMs;
    ball.y += ball.vy * dtMs;

    // Wall collisions
    if (ball.x - BALL_R < 0) {
      ball.x = BALL_R;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + BALL_R > state.fieldW) {
      ball.x = state.fieldW - BALL_R;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - BALL_R < 0) {
      ball.y = BALL_R;
      ball.vy = Math.abs(ball.vy);
    }

    // Paddle collision
    const p = state.paddle;
    const px0 = p.x - p.width / 2;
    const px1 = p.x + p.width / 2;
    if (
      ball.vy > 0 &&
      ball.y + BALL_R >= p.y &&
      ball.y + BALL_R <= p.y + PADDLE_H + 4 &&
      ball.x >= px0 - BALL_R &&
      ball.x <= px1 + BALL_R
    ) {
      ball.y = p.y - BALL_R - 0.1;
      const rel = (ball.x - p.x) / (p.width / 2); // -1..1
      const speed = Math.hypot(ball.vx, ball.vy) || BALL_BASE_SPEED;
      const angle = (-Math.PI / 2) + rel * (Math.PI / 3); // -60° to +60° around up
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
    }

    // Brick collisions — find first hit
    for (let i = 0; i < state.bricks.length; i++) {
      const brick = state.bricks[i];
      if (ballHitsBrick(ball, brick)) {
        reflectBallOnBrick(ball, brick);
        brick.hp -= 1;
        if (brick.hp <= 0) {
          // remove brick
          state.bricks.splice(i, 1);
          state.score += SCORE_PER_BREAK;
          state.recentBreakTimes.push(state.roundElapsedMs);
          // prune old (>5s) break times
          const cutoff = state.roundElapsedMs - 5000;
          state.recentBreakTimes = state.recentBreakTimes.filter(
            (t) => t >= cutoff
          );
          let drop: PowerUpKind | null = null;
          if (brick.dropsPowerUp) {
            const kind = pickPowerUp(brick.x * 0.013 + brick.y * 0.011);
            drop = kind;
            state.powerUps.push({
              x: brick.x + brick.w / 2,
              y: brick.y + brick.h / 2,
              vy: POWERUP_DROP_VY,
              kind,
            });
          }
          if (
            (ADULTING_LABELS as readonly string[]).includes(brick.label) &&
            !state.adultingSmashed.includes(brick.label)
          ) {
            state.adultingSmashed.push(brick.label);
          }
          state.events.brokenBricks.push({ label: brick.label, powerUp: drop });
        }
        break; // one brick per ball per step
      }
    }
  }

  // Remove balls that fell below paddle
  const survivors: Ball[] = [];
  for (const b of state.balls) {
    if (b.y - BALL_R > state.paddle.y + PADDLE_H + 20) {
      state.events.ballsLostThisStep += 1;
    } else {
      survivors.push(b);
    }
  }
  state.balls = survivors;

  // Lives logic
  if (state.balls.length === 0) {
    state.lives -= 1;
    if (state.lives <= 0) {
      state.status = "gameover";
    } else {
      state.balls.push(makeBall());
      state.roundElapsedMs = 0;
      state.recentBreakTimes = [];
    }
  }

  // Move power-ups, check pickup
  const remaining: PowerUpDrop[] = [];
  for (const pu of state.powerUps) {
    pu.y += pu.vy * dtMs;
    const p = state.paddle;
    const px0 = p.x - p.width / 2;
    const px1 = p.x + p.width / 2;
    const hitsPaddle =
      pu.y + POWERUP_SIZE / 2 >= p.y &&
      pu.y - POWERUP_SIZE / 2 <= p.y + PADDLE_H &&
      pu.x >= px0 &&
      pu.x <= px1;
    if (hitsPaddle) {
      applyPowerUp(state, pu.kind);
    } else if (pu.y - POWERUP_SIZE / 2 > state.fieldH) {
      // fell off
    } else {
      remaining.push(pu);
    }
  }
  state.powerUps = remaining;

  // Cleared?
  if (state.bricks.length === 0 && state.status === "playing") {
    state.status = "cleared";
  }
}

export function nextLevel(state: BrickState): BrickState {
  return start(state.level + 1);
}
