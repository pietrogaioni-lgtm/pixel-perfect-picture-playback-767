import {
  BOUNCE_VELOCITY,
  DOUBLE_JUMP_VELOCITY,
  GRAVITY,
  HOLD_GRAVITY_MULT,
  JUMP_VELOCITY,
  MAX_FALL_SPEED,
  MAX_HOLD_TIME,
  STEP,
  WALLRUN_MAX_TIME,
  WALLRUN_SPEED,
} from "./constants";
import type { Box } from "./types";

export interface SweepHit {
  t: number;
  nx: number;
  ny: number;
}

/**
 * Swept AABB test (continuous collision): box `a` moving by (dx, dy) during this step
 * against static box `b`. Returns the time of impact in [0, 1] and the surface normal.
 * Boxes that already overlap at t=0 return null (handled by depenetration).
 */
export function sweepAABB(a: Box, dx: number, dy: number, b: Box): SweepHit | null {
  let xEntry: number;
  let xExit: number;
  let yEntry: number;
  let yExit: number;

  if (dx === 0) {
    if (a.x + a.w <= b.x || a.x >= b.x + b.w) return null;
    xEntry = -Infinity;
    xExit = Infinity;
  } else {
    const invEntry = dx > 0 ? b.x - (a.x + a.w) : b.x + b.w - a.x;
    const invExit = dx > 0 ? b.x + b.w - a.x : b.x - (a.x + a.w);
    xEntry = invEntry / dx;
    xExit = invExit / dx;
  }
  if (dy === 0) {
    if (a.y + a.h <= b.y || a.y >= b.y + b.h) return null;
    yEntry = -Infinity;
    yExit = Infinity;
  } else {
    const invEntry = dy > 0 ? b.y - (a.y + a.h) : b.y + b.h - a.y;
    const invExit = dy > 0 ? b.y + b.h - a.y : b.y - (a.y + a.h);
    yEntry = invEntry / dy;
    yExit = invExit / dy;
  }

  const entry = Math.max(xEntry, yEntry);
  const exit = Math.min(xExit, yExit);
  if (entry > exit) return null;
  if (xEntry < 0 && yEntry < 0) return null; // already overlapping
  if (entry < 0 || entry > 1) return null;

  if (xEntry > yEntry) return { t: entry, nx: dx > 0 ? -1 : 1, ny: 0 };
  return { t: entry, nx: 0, ny: dy > 0 ? -1 : 1 };
}

export function overlaps(a: Box, b: Box, shrink = 0): boolean {
  return (
    a.x + shrink < b.x + b.w &&
    a.x + a.w - shrink > b.x &&
    a.y + shrink < b.y + b.h &&
    a.y + a.h - shrink > b.y
  );
}

export function boxDistance(a: Box, b: Box): number {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
  return Math.hypot(dx, dy);
}

/** Gravity used by the player each step — shared with the reach simulation. */
export function gravityFor(vy: number, held: boolean, holdTime: number): number {
  return vy < 0 && held && holdTime < MAX_HOLD_TIME ? GRAVITY * HOLD_GRAVITY_MULT : GRAVITY;
}

export function finite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

interface ReachOpts {
  double: boolean;
  jumpMult?: number;
  bounce?: boolean;
  held?: boolean;
}

/**
 * Simulates the cat's jump with the exact fixed-step integration the game uses and
 * returns the furthest horizontal distance at which its feet can land on a surface
 * `dy` pixels below (positive) or above (negative) the take-off height.
 */
export function maxJumpReach(speed: number, dy: number, opts: ReachOpts): number {
  const mult = opts.jumpMult ?? 1;
  const v0 = opts.bounce ? BOUNCE_VELOCITY : JUMP_VELOCITY * mult;
  const held = opts.held ?? true;
  let best = 0;
  const tries = opts.double ? 70 : 1;
  for (let k = 0; k < tries; k++) {
    const doubleAt = opts.double ? k + 1 : -1;
    let y = 0;
    let vy = -v0;
    let x = 0;
    let hold = 0;
    let rose = false;
    for (let i = 0; i < 400; i++) {
      if (i === doubleAt) {
        vy = -DOUBLE_JUMP_VELOCITY * mult;
        hold = 0;
      }
      vy = Math.min(vy + gravityFor(vy, held, hold) * STEP, MAX_FALL_SPEED);
      hold += STEP;
      const ny = y + vy * STEP;
      x += speed * STEP;
      if (ny <= dy) rose = true;
      if (vy > 0 && y <= dy && ny >= dy && (dy >= 0 || rose)) {
        best = Math.max(best, x);
        break;
      }
      y = ny;
      if (y > dy + 2000) break;
    }
  }
  return best;
}

/** Highest point (in px above take-off) reachable with a held jump and optional double jump. */
export function maxJumpHeight(double: boolean, jumpMult = 1): number {
  let best = 0;
  const tries = double ? 70 : 1;
  for (let k = 0; k < tries; k++) {
    let y = 0;
    let vy = -JUMP_VELOCITY * jumpMult;
    let hold = 0;
    for (let i = 0; i < 300; i++) {
      if (double && i === k + 1) {
        vy = -DOUBLE_JUMP_VELOCITY * jumpMult;
        hold = 0;
      }
      vy = Math.min(vy + gravityFor(vy, true, hold) * STEP, MAX_FALL_SPEED);
      hold += STEP;
      y += vy * STEP;
      best = Math.max(best, -y);
      if (vy > 0 && y > 0) break;
    }
  }
  return best;
}

export function wallRunHeight(): number {
  return maxJumpHeight(false) * 0.5 + WALLRUN_SPEED * WALLRUN_MAX_TIME;
}
