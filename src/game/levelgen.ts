import {
  BOUNCE_VELOCITY,
  GEN_GAP_SAFETY,
  MAX_FALL_SPEED,
  PLAYER_H,
  PX_PER_METER,
  SPEED_RAMP,
  STEP,
  JUMP_VELOCITY,
} from "./constants";
import type { LevelDef } from "./levels";
import { gravityFor, maxJumpReach } from "./physics";
import { Rng } from "./rng";
import type {
  Collectible,
  CollectibleKind,
  Hint,
  HintAction,
  LevelLayout,
  Obstacle,
  ObstacleKind,
  Platform,
  PlatformKind,
} from "./types";
import { WORLDS, type WorldDef } from "./worlds";

const TOP_MIN = 220;
const TOP_MAX = 640;
const START_TOP = 520;
export const SPAWN_X = 120;

const JUMP_POOLS: Record<number, string[]> = {
  0: ["chimney", "ac", "crate", "crates", "antenna", "pigeon"],
  1: ["chimney", "ac", "crates", "antenna", "sign", "pigeon"],
  2: ["chimney", "ac", "crates", "antenna", "seagull", "sign"],
  3: ["chimney", "crates", "icicle", "sign", "pigeon"],
  4: ["chimney", "crates", "antenna", "laundry", "sign"],
  5: ["crates", "antenna", "sign", "chimney"],
};

const HINTS: Record<HintAction, [string, string]> = {
  jump: ["Press SPACE, W or UP to jump", "Tap the right side to jump"],
  hold: ["Hold jump to leap higher", "Hold your tap to leap higher"],
  double: ["Jump again in mid-air to double jump", "Tap again in mid-air to double jump"],
  slide: ["Press S or DOWN to slide under", "Swipe down or tap the left side to slide"],
  wall: ["Hold jump against the wall to wall-run", "Hold your tap against the wall to wall-run"],
  power: ["Grab the power-up for a special boost!", "Grab the power-up for a special boost!"],
  fish: ["Collect fish to spend in the shop", "Collect fish to spend in the shop"],
};

interface Flat {
  x0: number;
  x1: number;
  top: number;
}

class Generator {
  platforms: Platform[] = [];
  obstacles: Obstacle[] = [];
  collectibles: Collectible[] = [];
  hints: Hint[] = [];
  flats: Flat[] = [];
  private nextId = 1;
  private cur!: Platform;
  private cursor = 0;
  finishX: number;
  private hintSeen = new Set<string>();
  private reachCache = new Map<string, number>();
  private world: WorldDef;

  constructor(
    private def: LevelDef,
    private rng: Rng,
  ) {
    this.world = WORLDS[def.world] ?? (WORLDS[0] as WorldDef);
    this.finishX = SPAWN_X + def.distance * PX_PER_METER;
  }

  // ---------- helpers ----------
  private progress(x: number) {
    return Math.max(0, Math.min(1, x / this.finishX));
  }
  private speedAt(x: number) {
    return this.def.speed * (1 + SPEED_RAMP * this.progress(x));
  }
  private react(x: number) {
    const p = this.progress(x);
    return this.def.react0 + (this.def.react1 - this.def.react0) * p;
  }
  private frac(x: number) {
    const p = this.progress(x);
    const f = (this.def.gapLo + (this.def.gapHi - this.def.gapLo) * p) * this.rng.range(0.92, 1.04);
    return Math.max(0.3, Math.min(1, f));
  }
  private reach(dy: number, double: boolean, bounce = false): number {
    const key = `${Math.round(dy / 4)}|${double}|${bounce}`;
    const c = this.reachCache.get(key);
    if (c !== undefined) return c;
    const r = bounce
      ? maxJumpReach(this.def.speed, dy, { double: false, bounce: true, held: false })
      : maxJumpReach(this.def.speed, dy, { double });
    this.reachCache.set(key, r);
    return r;
  }
  private clampTop(y: number) {
    return Math.max(TOP_MIN, Math.min(TOP_MAX, y));
  }

  private platform(kind: PlatformKind, x: number, y: number, w: number, h: number): Platform {
    const p: Platform = {
      id: this.nextId++,
      kind,
      x,
      y,
      w,
      h,
      baseY: y,
      prevY: y,
      surface: this.world.surface,
      style: this.rng.int(0, 3),
      moveRange: 0,
      moveSpeed: 0,
      movePhase: 0,
      crumbleState: 0,
      crumbleTimer: 0,
      vy: 0,
      wall: false,
      dead: false,
    };
    this.platforms.push(p);
    return p;
  }

  private building(x: number, top: number, kind: PlatformKind = "building"): Platform {
    const b = this.platform(kind, x, top, 10, kind === "float" ? 96 : 2400);
    this.cur = b;
    return b;
  }

  private extendTo(x: number) {
    this.cur.w = Math.max(this.cur.w, x - this.cur.x);
  }

  private obstacle(kind: ObstacleKind, x: number, y: number, w: number, h: number): Obstacle {
    const solid = kind === "chimney" || kind === "ac" || kind === "crate";
    const zone = kind === "puddle" || kind === "ice" || kind === "gust" || kind === "wind";
    const o: Obstacle = {
      id: this.nextId++,
      kind,
      x,
      y,
      w,
      h,
      baseX: x,
      baseY: y,
      prevX: x,
      prevY: y,
      vx: 0,
      vy: 0,
      solid,
      hazard: !solid && !zone,
      zone,
      forceX: 0,
      forceY: 0,
      state: 0,
      timer: 0,
      active: false,
      dead: false,
      passed: false,
      closest: Infinity,
      style: this.rng.int(0, 3),
    };
    this.obstacles.push(o);
    return o;
  }

  private collect(kind: CollectibleKind, x: number, y: number) {
    this.collectibles.push({
      id: this.nextId++,
      kind,
      x,
      y,
      baseY: y,
      phase: this.rng.range(0, Math.PI * 2),
      taken: false,
      attracted: false,
    });
  }

  private fishRow(x0: number, top: number, n: number, gap = 48, yOff = 40, kind: CollectibleKind = "fish") {
    for (let i = 0; i < n; i++) this.collect(kind, x0 + i * gap, top - yOff);
  }

  /** Fish along a real jump trajectory (cat centre), so they are always collectible. */
  private fishArc(
    x0: number,
    feetY: number,
    opts: { held: boolean; bounce?: boolean; kind?: CollectibleKind; every?: number; stopBelow?: number; maxN?: number },
  ) {
    const speed = this.speedAt(x0);
    let x = x0;
    let y = feetY;
    let vy = opts.bounce ? -BOUNCE_VELOCITY : -JUMP_VELOCITY;
    let hold = 0;
    const every = opts.every ?? 7;
    const stopBelow = opts.stopBelow ?? feetY - 10;
    let n = 0;
    for (let i = 1; i < 240; i++) {
      vy = Math.min(vy + gravityFor(vy, opts.held, hold) * STEP, MAX_FALL_SPEED);
      hold += STEP;
      y += vy * STEP;
      x += speed * STEP;
      if (vy > 0 && y > stopBelow) break;
      if (i % every === 0) {
        this.collect(opts.kind ?? "fish", x + 20, y - PLAYER_H / 2);
        n++;
        if (opts.maxN !== undefined && n >= opts.maxN) break;
      }
    }
  }

  private hint(action: HintAction, key: string, targetX: number) {
    if (!this.def.tutorial || this.hintSeen.has(key)) return;
    if (this.def.id === 2 && key !== "wall" && key !== "pigeon") return;
    this.hintSeen.add(key);
    const sp = this.speedAt(targetX);
    const texts = HINTS[action];
    this.hints.push({
      x: targetX - sp * 2.4,
      until: targetX + 80,
      slowFrom: targetX - sp * 0.75,
      text: key === "pigeon" ? "Jump over the pigeon!" : texts[0],
      touchText: key === "pigeon" ? "Jump over the pigeon!" : texts[1],
      action,
      slowmo: action !== "fish" && action !== "power",
      shown: false,
      done: false,
    });
  }

  // ---------- token handlers ----------
  private takeoff(): number {
    const sp = this.speedAt(this.cursor);
    const t = this.cursor + Math.max(150, sp * this.react(this.cursor) * 0.6);
    this.cur.w = Math.max(60, t - this.cur.x);
    return this.cur.x + this.cur.w;
  }

  private gapDy(kind: string): number {
    const r = this.rng;
    let dy = 0;
    if (kind === "up") dy = -r.range(50, 100);
    else if (kind === "down") dy = r.range(80, 170);
    else if (kind === "gap-s") dy = r.range(-20, 40);
    else if (kind === "gap-l") dy = r.range(-20, 70);
    else dy = r.range(-40, 60);
    if (this.cur.y < 330) dy = Math.abs(dy) + 30;
    if (this.cur.y > 590) dy = -Math.abs(dy);
    return this.clampTop(this.cur.y + dy) - this.cur.y;
  }

  private gap(kind: string) {
    const edge = this.takeoff();
    const dy = this.gapDy(kind);
    const f = this.frac(edge);
    let gap: number;
    if (kind === "gap-l") {
      const single = this.reach(dy, false) * GEN_GAP_SAFETY;
      const dbl = this.reach(dy, true) * GEN_GAP_SAFETY;
      gap = Math.max(single * 1.02, dbl * (0.6 + 0.4 * f));
      gap = Math.min(gap, dbl);
      this.hint("double", "gap-l", edge);
    } else {
      const single = this.reach(dy, false) * GEN_GAP_SAFETY;
      gap = single * f * (kind === "gap-s" ? 0.6 : 1);
      gap = Math.max(90, Math.min(gap, single));
      this.hint("jump", "gap", edge);
    }
    const fromY = this.cur.y;
    const newTop = fromY + dy;
    this.fishArc(edge - 30, fromY, { held: true, stopBelow: Math.min(fromY, newTop) - 40, maxN: 7 });
    const b = this.building(edge + gap, newTop);
    this.cursor = b.x + Math.max(140, this.speedAt(b.x) * 0.4);
  }

  private roofObstacle(kind: string) {
    const sp = this.speedAt(this.cursor);
    const x = this.cursor + sp * this.react(this.cursor);
    const top = this.cur.y;
    const d = this.def.id / 30;
    let w = 0;
    switch (kind) {
      case "chimney": {
        w = this.rng.range(54, 68);
        const h = this.def.id === 1 ? 58 : this.rng.range(56, 74 + 40 * d);
        this.obstacle("chimney", x, top - h, w, h);
        this.hint("hold", "chimney", x);
        this.fishArc(x - sp * 0.3, top, { held: true, every: 6, maxN: 6 });
        break;
      }
      case "ac": {
        w = 92;
        this.obstacle("ac", x, top - 50, w, 50);
        this.fishArc(x - sp * 0.28, top, { held: false, every: 6, maxN: 5 });
        break;
      }
      case "crate": {
        w = 50;
        this.obstacle("crate", x, top - 50, w, 50);
        this.fishArc(x - sp * 0.26, top, { held: false, every: 6, maxN: 5 });
        break;
      }
      case "crates": {
        if (this.rng.chance(0.5)) {
          w = 50;
          const o = this.obstacle("crate", x, top - 100, 50, 100);
          o.state = 2; // stacked
          this.fishArc(x - sp * 0.32, top, { held: true, every: 6, maxN: 6 });
        } else {
          w = 104;
          const o = this.obstacle("crate", x, top - 50, 104, 50);
          o.state = 1; // side by side
          this.fishArc(x - sp * 0.3, top, { held: true, every: 6, maxN: 6 });
        }
        break;
      }
      case "antenna": {
        w = 14;
        const h = this.rng.range(70, 100 + 20 * d);
        this.obstacle("antenna", x, top - h, w, h);
        this.fishArc(x - sp * 0.3, top, { held: true, every: 6, maxN: 6 });
        break;
      }
      case "pigeon": {
        w = 34;
        const drift = 50 * (1000 / (sp + 50));
        const o = this.obstacle("pigeon", x + drift, top - 30, 34, 24);
        o.vx = -50;
        this.hint("jump", "pigeon", x);
        break;
      }
      case "seagull": {
        w = 46;
        const drift = 150 * (1000 / (sp + 150));
        const o = this.obstacle("seagull", x + drift, top - 58, 46, 26);
        o.vx = -150;
        break;
      }
      case "icicle": {
        w = 20;
        this.obstacle("icicle", x, top - 250, 20, 46);
        break;
      }
      case "sign": {
        w = 92;
        this.obstacle("sign", x, top - 112, w, 82);
        this.hint("slide", "slide", x);
        this.fishRow(x - 20, top, 3, 48, 13);
        break;
      }
      case "laundry": {
        w = 170;
        this.obstacle("laundry", x, top - 80, w, 50);
        this.hint("slide", "slide", x);
        this.fishRow(x + 10, top, 4, 48, 13);
        break;
      }
    }
    this.extendTo(x + w + 220);
    this.cursor = x + w + sp * 0.75;
  }

  private flat() {
    const sp = this.speedAt(this.cursor);
    const x0 = this.cursor + 40;
    const len = sp * this.rng.range(0.9, 1.3);
    this.extendTo(x0 + len + 160);
    const n = Math.max(4, Math.floor(len / 52));
    this.fishRow(x0 + 40, this.cur.y, n, 48, 40);
    this.flats.push({ x0, x1: x0 + len, top: this.cur.y });
    if (this.def.id === 1) this.hint("fish", "fish", x0 + 120);
    this.cursor = x0 + len;
  }

  private gold() {
    const sp = this.speedAt(this.cursor);
    const x0 = this.cursor + sp * 0.4;
    this.extendTo(x0 + sp * 1.3 + 200);
    this.fishArc(x0, this.cur.y, { held: true, kind: "gold", every: 7, maxN: 6 });
    this.flats.push({ x0, x1: x0 + sp * 1.0, top: this.cur.y });
    this.cursor = x0 + sp * 1.2;
  }

  private power(kind: string) {
    const sp = this.speedAt(this.cursor);
    const x = this.cursor + sp * 0.6;
    this.extendTo(x + 300);
    const k = kind.slice(3) as CollectibleKind;
    this.collect(k, x, this.cur.y - 70);
    this.hint("power", "power", x);
    this.cursor = x + sp * 0.5;
  }

  private puddle() {
    const sp = this.speedAt(this.cursor);
    const x = this.cursor + sp * 0.5;
    const w = this.rng.range(100, 150);
    this.obstacle("puddle", x, this.cur.y - 8, w, 8);
    this.fishRow(x + 10, this.cur.y, 3, 48, 40);
    this.extendTo(x + w + sp * 1.2 + 200);
    this.cursor = x + w + sp * 1.15;
  }

  private ice() {
    const x = this.cursor + 30;
    const w = this.rng.range(360, 520);
    this.obstacle("ice", x, this.cur.y - 6, w, 6);
    this.extendTo(x + w + 160);
    this.fishRow(x + 60, this.cur.y, 5, 56, 40);
    this.cursor = x + 120;
  }

  private wall() {
    const edge = this.takeoff();
    const gap = Math.max(70, this.reach(0, false) * GEN_GAP_SAFETY * 0.32);
    const fromY = this.cur.y;
    const newTop = this.clampTop(fromY - this.rng.range(210, 280));
    const b = this.building(edge + gap, newTop);
    b.wall = true;
    this.hint("wall", "wall", edge);
    for (let y = fromY - 90; y > newTop + 10; y -= 52) this.collect("fish", b.x - 22, y);
    this.cursor = b.x + Math.max(160, this.speedAt(b.x) * 0.5);
  }

  private crumble() {
    const edge = this.takeoff();
    const f = this.frac(edge);
    const fromY = this.cur.y;
    const plankY = this.clampTop(fromY + this.rng.range(0, 30));
    const g1 = Math.max(90, this.reach(plankY - fromY, false) * GEN_GAP_SAFETY * f * 0.8);
    const w = Math.min(200, this.def.speed * 0.5);
    const plank = this.platform("crumble", edge + g1, plankY, w, 26);
    this.fishRow(plank.x + 30, plankY, 3, 48, 40);
    const nextTop = this.clampTop(plankY + this.rng.range(-20, 40));
    const g2 = Math.max(90, this.reach(nextTop - plankY, false) * GEN_GAP_SAFETY * f * 0.8);
    const b = this.building(plank.x + w + g2, nextTop);
    this.cursor = b.x + Math.max(140, this.speedAt(b.x) * 0.4);
  }

  private moving() {
    const edge = this.takeoff();
    const f = this.frac(edge);
    const fromY = this.cur.y;
    const range = 45;
    const base = this.clampTop(fromY + this.rng.range(-10, 30));
    const r1 = Math.min(this.reach(base - range - fromY, false), this.reach(base + range - fromY, false));
    const g1 = Math.max(90, r1 * GEN_GAP_SAFETY * f * 0.85);
    const plank = this.platform("moving", edge + g1, base, 180, 26);
    plank.moveRange = range;
    plank.moveSpeed = this.rng.range(1.4, 1.9);
    plank.movePhase = this.rng.range(0, Math.PI * 2);
    this.fishRow(plank.x + 40, base, 3, 48, 40);
    const nextTop = this.clampTop(base + this.rng.range(-20, 30));
    const r2 = Math.min(this.reach(nextTop - (base + range), false), this.reach(nextTop - (base - range), false));
    const g2 = Math.max(90, r2 * GEN_GAP_SAFETY * f * 0.85);
    const b = this.building(plank.x + plank.w + g2, nextTop);
    this.cursor = b.x + Math.max(140, this.speedAt(b.x) * 0.4);
  }

  private bridge() {
    const edge = this.takeoff();
    const len = this.rng.range(300, 460);
    const y = this.cur.y;
    this.platform("bridge", edge, y, len, 20);
    this.fishRow(edge + 40, y, Math.floor(len / 60), 56, 40);
    const b = this.building(edge + len, y);
    this.cursor = b.x + Math.max(140, this.speedAt(b.x) * 0.4);
  }

  private awning() {
    const edge = this.takeoff();
    const f = this.frac(edge);
    const fromY = this.cur.y;
    const awY = this.clampTop(fromY + 80);
    const g1 = Math.max(90, this.reach(awY - fromY, false) * GEN_GAP_SAFETY * f * 0.7);
    const aw = this.platform("awning", edge + g1, awY, 150, 24);
    const nextTop = this.clampTop(fromY + this.rng.range(-60, 20));
    const r = this.reach(nextTop - awY, false, true);
    const g2 = Math.max(110, Math.min(380, r * GEN_GAP_SAFETY * (0.5 + 0.4 * f)));
    this.fishArc(aw.x + 40, awY, { held: false, bounce: true, every: 6, stopBelow: Math.min(nextTop, awY) - 40, maxN: 8 });
    const b = this.building(aw.x + aw.w + g2, nextTop);
    this.cursor = b.x + Math.max(150, this.speedAt(b.x) * 0.45);
  }

  private gust() {
    const startX = this.cursor;
    const top = this.cur.y;
    this.gap("gap");
    const z = this.obstacle("gust", startX + 60, top - 420, this.cur.x - startX + 80, 460);
    z.forceX = 200;
    z.forceY = -900;
  }

  private windZone() {
    const edge = this.takeoff();
    const fromY = this.cur.y;
    const dy = this.clampTop(fromY + this.rng.range(-40, 40)) - fromY;
    const f = this.frac(edge);
    const dbl = this.reach(dy, true) * GEN_GAP_SAFETY;
    const gap = Math.max(160, dbl * (0.65 + 0.3 * f));
    const z = this.obstacle("wind", edge, Math.min(fromY, fromY + dy) - 380, gap, 380 + Math.abs(dy) + 40);
    z.forceY = -1700;
    this.fishArc(edge - 30, fromY, { held: true, stopBelow: Math.min(fromY, fromY + dy) - 40, maxN: 6 });
    const b = this.building(edge + gap, fromY + dy);
    this.cursor = b.x + Math.max(140, this.speedAt(b.x) * 0.4);
  }

  private floats() {
    const n = this.rng.int(2, 3);
    for (let i = 0; i < n; i++) {
      const edge = this.takeoff();
      const fromY = this.cur.y;
      const top = this.clampTop(fromY + this.rng.range(-60, 50));
      const f = this.frac(edge);
      const g = Math.max(100, this.reach(top - fromY, false) * GEN_GAP_SAFETY * f);
      const isl = this.building(edge + g, top, "float");
      isl.w = this.rng.range(240, 340);
      this.fishRow(isl.x + 40, top, 4, 48, 40);
      this.cursor = isl.x + Math.max(120, this.speedAt(isl.x) * 0.3);
    }
  }

  private run(token: string) {
    if (token === "flat") this.flat();
    else if (token === "gap" || token === "gap-s" || token === "gap-l" || token === "up" || token === "down")
      this.gap(token);
    else if (token === "gold") this.gold();
    else if (token.startsWith("pw:")) this.power(token);
    else if (token === "puddle") this.puddle();
    else if (token === "ice") this.ice();
    else if (token === "wall") this.wall();
    else if (token === "crumble") this.crumble();
    else if (token === "moving") this.moving();
    else if (token === "bridge") this.bridge();
    else if (token === "awning") this.awning();
    else if (token === "gust") this.gust();
    else if (token === "wind") this.windZone();
    else if (token === "float") this.floats();
    else this.roofObstacle(token);
  }

  build(): LevelLayout {
    const def = this.def;
    // Guaranteed long safe start platform directly under the spawn point.
    this.building(-700, START_TOP);
    this.cursor = SPAWN_X + 560;
    this.extendTo(this.cursor + 200);

    const seq = def.seq.split(/\s+/).filter(Boolean);
    const pool = JUMP_POOLS[def.world] ?? ["chimney"];
    let i = 0;
    let powerCount = 0;
    while (this.cursor < this.finishX - 900 && i < 600) {
      const pass = Math.floor(i / seq.length);
      let token = seq[i % seq.length] ?? "flat";
      i++;
      if (pass > 0 && !def.tutorial) {
        if (token.startsWith("pw:") && (powerCount >= 4 || this.rng.chance(0.4))) continue;
        if (pool.includes(token) && this.rng.chance(0.35)) token = this.rng.pick(pool);
        if (token === "gold" && this.rng.chance(0.3)) token = "flat";
      }
      if (token.startsWith("pw:")) powerCount++;
      this.run(token);
    }
    // The finish line must sit on solid ground with a clear runway.
    if (this.cur.x > this.finishX - 300) this.finishX = this.cur.x + 400;
    this.extendTo(this.finishX + 1800);

    this.placeStar();
    this.sanitizeCollectibles();

    this.platforms.sort((a, b) => a.x - b.x);
    this.obstacles.sort((a, b) => a.x - b.x);
    this.collectibles.sort((a, b) => a.x - b.x);
    this.hints.sort((a, b) => a.x - b.x);

    const totalFish = this.collectibles.filter((c) => c.kind === "fish" || c.kind === "gold").length;
    return {
      platforms: this.platforms,
      obstacles: this.obstacles,
      collectibles: this.collectibles,
      hints: this.hints,
      finishX: this.finishX,
      spawnX: SPAWN_X,
      spawnY: START_TOP,
      totalFish,
      baseSpeed: def.speed,
    };
  }

  private placeStar() {
    const fx = this.finishX;
    const candidates = this.flats.filter((f) => f.x0 > fx * 0.35 && f.x1 < fx * 0.9 && f.x1 - f.x0 > 280);
    const pickFrom = candidates.length ? candidates : this.flats;
    let x: number;
    let top: number;
    const f = pickFrom.length ? this.rng.pick(pickFrom) : null;
    if (f) {
      x = (f.x0 + f.x1) / 2;
      top = f.top;
    } else {
      const b = this.platforms.find((p) => p.kind === "building" && p.x > fx * 0.4) ?? this.platforms[0];
      if (!b) return;
      x = b.x + Math.min(200, b.w / 2);
      top = b.y;
    }
    // Remove regular fish right where the star sits, then add the star and a breadcrumb trail.
    this.collectibles = this.collectibles.filter((c) => Math.abs(c.x - x) > 60 || c.y < top - 360);
    this.collect("star", x, top - 300);
    this.collect("fish", x - 40, top - 120);
    this.collect("fish", x - 10, top - 180);
  }

  /** Collectibles must never sit inside obstacles or platforms. */
  private sanitizeCollectibles() {
    const R = 14;
    this.collectibles = this.collectibles.filter((c) => {
      for (const o of this.obstacles) {
        if (o.zone) continue;
        // icicles fall; keep fish clear of their whole fall column
        const oy = o.kind === "icicle" ? o.y : o.y;
        const oh = o.kind === "icicle" ? 400 : o.h;
        const ox = o.kind === "pigeon" || o.kind === "seagull" ? o.x - 260 : o.x;
        const ow = o.kind === "pigeon" || o.kind === "seagull" ? o.w + 260 : o.w;
        if (c.x + R + 8 > ox && c.x - R - 8 < ox + ow && c.y + R + 8 > oy && c.y - R - 8 < oy + oh) return false;
      }
      for (const p of this.platforms) {
        if (c.x + R < p.x || c.x - R > p.x + p.w) continue;
        if (p.kind === "building" || p.kind === "float") {
          if (c.y + R > p.y && c.y - R < p.y + p.h) return false;
        } else if (Math.abs(c.y - p.y) < R + 6) return false;
      }
      return Number.isFinite(c.x) && Number.isFinite(c.y);
    });
  }
}

export function generateLevel(def: LevelDef): LevelLayout {
  return new Generator(def, new Rng(def.seed)).build();
}
