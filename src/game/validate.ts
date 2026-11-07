import { PLAYER_H, PLAYER_W, VALIDATE_GAP_SAFETY } from "./constants";
import { generateLevel } from "./levelgen";
import { LEVELS, type LevelDef } from "./levels";
import { maxJumpHeight, maxJumpReach, wallRunHeight } from "./physics";
import type { LevelLayout, Platform } from "./types";

export interface ValidationResult {
  levelId: number;
  ok: boolean;
  problems: string[];
  maxGapRatio: number;
}

function topRange(p: Platform): [number, number] {
  if (p.kind === "moving") return [p.baseY - p.moveRange, p.baseY + p.moveRange];
  return [p.y, p.y];
}

/**
 * Checks a generated layout is beatable:
 *  - every gap is shorter than the max reachable jump distance at the level's slowest speed
 *  - every rise is below the reachable height (or is a wall-run wall)
 *  - the spawn is on a platform, the start is clear
 *  - collectibles are not inside obstacles, the hidden star exists
 *  - puddles never sit right before a gap
 */
export function validateLayout(def: LevelDef, layout: LevelLayout): ValidationResult {
  const problems: string[] = [];
  const speed = layout.baseSpeed; // slowest speed in the level
  let maxRatio = 0;
  const stones = layout.platforms.filter((p) => !p.dead).sort((a, b) => a.x - b.x);
  const maxRise = maxJumpHeight(true) * 0.9;
  const wallRise = wallRunHeight() * 0.85;

  // Spawn platform.
  const spawnP = stones.find((p) => p.x <= layout.spawnX && p.x + p.w >= layout.spawnX + PLAYER_W);
  if (!spawnP || Math.abs(spawnP.y - layout.spawnY) > 0.5) problems.push("spawn is not on a platform");
  for (const o of layout.obstacles) {
    if (!o.zone && o.x < layout.spawnX + 500) problems.push(`obstacle ${o.kind} too close to spawn`);
  }

  // Walk the path: consecutive stepping stones.
  for (let i = 0; i < stones.length - 1; i++) {
    const a = stones[i] as Platform;
    const b = stones[i + 1] as Platform;
    const gap = b.x - (a.x + a.w);
    if (gap <= 0.5) continue;
    if (!Number.isFinite(gap)) {
      problems.push("non-finite gap");
      continue;
    }
    const [aHi, aLo] = topRange(a);
    const [bHi, bLo] = topRange(b);
    // Worst cases: highest target from lowest take-off, and lowest target from highest take-off.
    const dyRise = bHi - aLo;
    const dyDrop = bLo - aHi;
    let reach: number;
    if (a.kind === "awning") {
      reach = Math.min(
        maxJumpReach(speed, dyRise, { double: false, bounce: true, held: false }),
        maxJumpReach(speed, dyDrop, { double: false, bounce: true, held: false }),
      );
    } else {
      reach = Math.min(maxJumpReach(speed, dyRise, { double: true }), maxJumpReach(speed, dyDrop, { double: true }));
    }
    if (b.wall) {
      const touch = maxJumpReach(speed, 0, { double: true });
      if (gap > touch * 0.6) problems.push(`wall gap ${gap.toFixed(0)} too wide at x=${b.x.toFixed(0)}`);
      if (-dyRise > wallRise) problems.push(`wall too tall (${(-dyRise).toFixed(0)}) at x=${b.x.toFixed(0)}`);
      continue;
    }
    if (-dyRise > maxRise) problems.push(`rise ${(-dyRise).toFixed(0)} too high at x=${b.x.toFixed(0)}`);
    const ratio = gap / Math.max(1, reach);
    maxRatio = Math.max(maxRatio, ratio);
    if (ratio > VALIDATE_GAP_SAFETY)
      problems.push(`gap ${gap.toFixed(0)} > ${(reach * VALIDATE_GAP_SAFETY).toFixed(0)} reachable at x=${a.x + a.w}`);
  }

  // Finish must be on solid ground.
  const finishP = stones.find((p) => p.x <= layout.finishX && p.x + p.w >= layout.finishX + 400);
  if (!finishP) problems.push("finish line is not on a platform");

  // Collectibles never inside obstacles.
  const R = 14;
  for (const c of layout.collectibles) {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) problems.push("non-finite collectible");
    for (const o of layout.obstacles) {
      if (o.zone) continue;
      if (c.x + R > o.x && c.x - R < o.x + o.w && c.y + R > o.y && c.y - R < o.y + o.h)
        problems.push(`${c.kind} inside ${o.kind} at x=${c.x.toFixed(0)}`);
    }
  }
  if (!layout.collectibles.some((c) => c.kind === "star")) problems.push("hidden star missing");
  if (layout.totalFish < 20) problems.push("too few fish");

  // Puddles must not slow you right before a gap.
  for (const o of layout.obstacles) {
    if (o.kind !== "puddle") continue;
    const host = stones.find((p) => p.x <= o.x && p.x + p.w >= o.x + o.w);
    if (!host) {
      problems.push("puddle floating in air");
      continue;
    }
    if (host.x + host.w - (o.x + o.w) < speed * 1.0) problems.push(`puddle too close to a gap at x=${o.x.toFixed(0)}`);
  }

  // Obstacles must stand on something.
  for (const o of layout.obstacles) {
    if (o.zone || o.kind === "icicle" || o.kind === "seagull" || o.kind === "sign" || o.kind === "laundry") continue;
    const foot = o.y + o.h;
    const host = stones.find((p) => p.x <= o.x && p.x + p.w >= o.x + o.w && Math.abs(p.y - foot) < 8 + PLAYER_H);
    if (!host) problems.push(`${o.kind} not on a roof at x=${o.x.toFixed(0)}`);
  }

  return { levelId: def.id, ok: problems.length === 0, problems, maxGapRatio: maxRatio };
}

export function validateAllLevels(): ValidationResult[] {
  return LEVELS.map((def) => validateLayout(def, generateLevel(def)));
}

/** Development-only startup check: warns in the console about any unbeatable level. */
export function devValidateLevels() {
  try {
    const results = validateAllLevels();
    const bad = results.filter((r) => !r.ok);
    if (bad.length) {
      for (const r of bad) console.warn(`[Whisker Rooftops] Level ${r.levelId} validation:`, r.problems);
    } else {
      console.info(`[Whisker Rooftops] All ${results.length} levels validated as beatable.`);
    }
  } catch (e) {
    console.warn("[Whisker Rooftops] level validation crashed", e);
  }
}
