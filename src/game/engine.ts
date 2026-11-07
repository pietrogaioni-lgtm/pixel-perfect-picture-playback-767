import {
  BOOST_MULT,
  BOUNCE_VELOCITY,
  COMBO_TIMEOUT,
  COYOTE_TIME,
  DOUBLE_JUMP_VELOCITY,
  FAST_FALL_SPEED,
  JUMP_BUFFER_TIME,
  JUMP_VELOCITY,
  LEDGE_TOLERANCE,
  MAGNET_RADIUS,
  MAX_FALL_SPEED,
  NEAR_MISS_DIST,
  PERFECT_ZONE,
  PICKUP_RADIUS,
  PLAYER_H,
  PLAYER_W,
  POWERUP_DURATION,
  PUDDLE_SLOW,
  PUDDLE_TIME,
  PX_PER_METER,
  RUN_ACCEL,
  RUN_ACCEL_SLIPPERY,
  SLIDE_H,
  SLIDE_TIME,
  SLIDE_TIME_ICE,
  SPEED_RAMP,
  SUPER_JUMP_MULT,
  VIEW_H,
  VIEW_W,
  WALLRUN_MAX_TIME,
  WALLRUN_SPEED,
  WALL_SLIDE_SPEED,
  GRAVITY,
} from "./constants";
import { generateLevel } from "./levelgen";
import type { LevelDef } from "./levels";
import { ParticlePool, Shape, TextPool } from "./particles";
import { boxDistance, finite, gravityFor, overlaps, sweepAABB } from "./physics";
import type { Box, Collectible, Hint, HintAction, LevelLayout, Obstacle, Platform, PowerKind, Surface } from "./types";
import { WORLDS, type WorldDef } from "./worlds";

export type SfxName =
  | "jump"
  | "double"
  | "land"
  | "fish"
  | "gold"
  | "star"
  | "power"
  | "hit"
  | "shield"
  | "slide"
  | "wallrun"
  | "bounce"
  | "splash"
  | "smash"
  | "combo"
  | "complete"
  | "crumble"
  | "thunder"
  | "whoosh";

export interface EngineSink {
  sfx(name: SfxName, pitch?: number): void;
  gameOver(): void;
  complete(): void;
}

export interface InputFrame {
  jumpPressed: boolean;
  jumpHeld: boolean;
  slidePressed: boolean;
  slideHeld: boolean;
}

export type RunState = "playing" | "dying" | "dead" | "complete" | "done";

export interface Player {
  x: number;
  y: number;
  w: number;
  h: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  windX: number;
  grounded: boolean;
  ground: Platform | Obstacle | null;
  groundSurface: Surface;
  coyote: number;
  jumpBuffer: number;
  jumpsUsed: number;
  jumpHeld: boolean;
  holdTime: number;
  airTime: number;
  sliding: boolean;
  slideTimer: number;
  slideQueued: boolean;
  wallRun: boolean;
  wallRunTimer: number;
  wallRunUsed: boolean;
  wallContact: boolean;
  ledgeTimer: number;
  takeoffId: number;
  squashX: number;
  squashY: number;
  squashVX: number;
  squashVY: number;
  anim: number;
  invuln: number;
  hurt: boolean;
  lastFeet: number;
  doubleFlash: number;
  trail: { x: number; y: number }[];
}

const SOLID_PLATFORM = (p: Platform) => p.kind === "building" || p.kind === "float";

function makePlayer(x: number, feet: number): Player {
  return {
    x,
    y: feet - PLAYER_H,
    w: PLAYER_W,
    h: PLAYER_H,
    prevX: x,
    prevY: feet - PLAYER_H,
    vx: 0,
    vy: 0,
    windX: 0,
    grounded: true,
    ground: null,
    groundSurface: "normal",
    coyote: COYOTE_TIME,
    jumpBuffer: 0,
    jumpsUsed: 0,
    jumpHeld: false,
    holdTime: 0,
    airTime: 0,
    sliding: false,
    slideTimer: 0,
    slideQueued: false,
    wallRun: false,
    wallRunTimer: 0,
    wallRunUsed: false,
    wallContact: false,
    ledgeTimer: 0,
    takeoffId: -1,
    squashX: 1,
    squashY: 1,
    squashVX: 0,
    squashVY: 0,
    anim: 0,
    invuln: 0,
    hurt: false,
    lastFeet: feet,
    doubleFlash: 0,
    trail: [],
  };
}

export interface RunStats {
  jumps: number;
  perfects: number;
  nearMisses: number;
  maxCombo: number;
}

const NOOP_SINK: EngineSink = { sfx() {}, gameOver() {}, complete() {} };

/** One attempt at a level. Creating a new Run is a full reset of all game state. */
export class Run {
  readonly def: LevelDef;
  readonly world: WorldDef;
  readonly layout: LevelLayout;
  readonly player: Player;
  readonly particles: ParticlePool;
  readonly texts = new TextPool(18);
  readonly cam = { x: 0, y: 0, prevX: 0, prevY: 0, targetY: 0, trauma: 0 };
  readonly powers: Record<PowerKind, number> = { magnet: 0, shield: 0, speed: 0, super: 0 };
  readonly stats: RunStats = { jumps: 0, perfects: 0, nearMisses: 0, maxCombo: 0 };
  readonly vacuum: { x: number; prevX: number; active: boolean };

  state: RunState = "playing";
  time = 0;
  stateTimer = 0;
  distance = 0;
  fishCount = 0; // number of fish collected (for the 80% star)
  coins = 0; // fish value banked to the wallet
  score = 0;
  combo = 0;
  comboTimer = 0;
  mult = 1;
  comboPop = 0;
  starFound = false;
  slowTimer = 0;
  timeScale = 1;
  activeHint: Hint | null = null;
  hintAlpha = 0;
  reviveUsed = false;
  deathCause: "fall" | "hit" | "caught" | null = null;
  flash = 0;
  private nextThunder = 6;
  private dustTimer = 0;
  private fishStreak = 0;
  private fishStreakTimer = 0;
  private platStart = 0;
  private obsStart = 0;
  private colStart = 0;
  private sink: EngineSink;
  private lowQuality: boolean;

  constructor(def: LevelDef, sink: EngineSink = NOOP_SINK, opts: { lowQuality?: boolean } = {}) {
    this.def = def;
    this.world = WORLDS[def.world] ?? (WORLDS[0] as WorldDef);
    this.layout = generateLevel(def);
    this.sink = sink;
    this.lowQuality = opts.lowQuality ?? false;
    this.particles = new ParticlePool(this.lowQuality ? 140 : 380);
    this.player = makePlayer(this.layout.spawnX, this.layout.spawnY);
    this.player.vx = def.speed * 0.5;
    const first = this.layout.platforms.find((p) => p.x <= this.layout.spawnX && p.x + p.w > this.layout.spawnX);
    this.player.ground = first ?? null;
    this.cam.x = this.player.x - VIEW_W * 0.3;
    this.cam.y = this.layout.spawnY - VIEW_H * 0.66;
    this.cam.targetY = this.cam.y;
    this.cam.prevX = this.cam.x;
    this.cam.prevY = this.cam.y;
    this.vacuum = { x: this.layout.spawnX - 700, prevX: this.layout.spawnX - 700, active: def.boss };
  }

  get progress(): number {
    return Math.max(0, Math.min(1, (this.player.x - this.layout.spawnX) / (this.layout.finishX - this.layout.spawnX)));
  }

  targetSpeed(): number {
    let s = this.def.speed * (1 + SPEED_RAMP * this.progress);
    if (this.slowTimer > 0) s *= PUDDLE_SLOW;
    if (this.powers.speed > 0) s *= BOOST_MULT;
    return s;
  }

  entityCount(): number {
    return (
      this.layout.platforms.length - this.platStart +
      (this.layout.obstacles.length - this.obsStart) +
      (this.layout.collectibles.length - this.colStart) +
      this.particles.count()
    );
  }

  // ------------------------------------------------------------------ update
  update(dt: number, input: InputFrame) {
    this.time += dt;
    this.cam.prevX = this.cam.x;
    this.cam.prevY = this.cam.y;
    const p = this.player;
    p.prevX = p.x;
    p.prevY = p.y;
    this.vacuum.prevX = this.vacuum.x;
    for (const o of this.layout.obstacles) {
      o.prevX = o.x;
      o.prevY = o.y;
    }

    this.updatePlatforms(dt);
    this.updateObstacles(dt);

    if (this.state === "playing") {
      this.updatePlayer(dt, input);
      this.checkZonesAndHazards(dt);
      this.updateCollectibles(dt);
      this.updateVacuum(dt);
      this.checkDeath();
      this.updateHints(dt);
      this.updateTimers(dt);
      if (p.x >= this.layout.finishX && this.state === "playing") this.finish();
    } else {
      this.updateEndStates(dt);
      this.updateCollectibles(dt);
      this.timeScale = 1;
    }

    this.updateSquash(dt);
    this.particles.update(dt);
    this.texts.update(dt);
    this.updateCamera(dt);
    this.updateWeather(dt);
    this.advanceWindows();
    this.sanity();
  }

  private updateTimers(dt: number) {
    const p = this.player;
    for (const k of ["magnet", "shield", "speed", "super"] as PowerKind[]) {
      if (this.powers[k] > 0) this.powers[k] = Math.max(0, this.powers[k] - dt);
    }
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.ledgeTimer = Math.max(0, p.ledgeTimer - dt);
    p.doubleFlash = Math.max(0, p.doubleFlash - dt);
    this.comboPop = Math.max(0, this.comboPop - dt * 2.5);
    this.fishStreakTimer -= dt;
    if (this.fishStreakTimer <= 0) this.fishStreak = 0;
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.mult = 1;
      }
    }
    const newDist = Math.max(this.distance, (p.x - this.layout.spawnX) / PX_PER_METER);
    if (newDist > this.distance) {
      this.score += (newDist - this.distance) * this.mult;
      this.distance = newDist;
    }
    // Trail ring buffer for motion trails at high speed.
    if (this.powers.speed > 0 || p.vx > this.def.speed * 1.25) {
      p.trail.unshift({ x: p.x, y: p.y });
      if (p.trail.length > 7) p.trail.length = 7;
    } else if (p.trail.length) p.trail.pop();
  }

  private updatePlatforms(dt: number) {
    const L = this.layout.platforms;
    const camR = this.cam.x + VIEW_W + 600;
    for (let i = this.platStart; i < L.length; i++) {
      const pl = L[i] as Platform;
      if (pl.x > camR) break;
      pl.prevY = pl.y;
      if (pl.kind === "moving") {
        pl.y = pl.baseY + Math.sin(this.time * pl.moveSpeed + pl.movePhase) * pl.moveRange;
      } else if (pl.kind === "crumble" && pl.crumbleState > 0 && !pl.dead) {
        pl.crumbleTimer += dt;
        if (pl.crumbleState === 1 && pl.crumbleTimer > 0.5) {
          pl.crumbleState = 2;
          this.sink.sfx("crumble");
          for (let k = 0; k < 10; k++)
            this.particles.spawn({
              x: pl.x + Math.random() * pl.w,
              y: pl.y + 10,
              vx: (Math.random() - 0.5) * 120,
              vy: Math.random() * 80,
              gravity: 1400,
              life: 0.9,
              size: 6 + Math.random() * 6,
              color: this.world.roof,
              shape: Shape.Rect,
              vr: (Math.random() - 0.5) * 8,
            });
        }
        if (pl.crumbleState === 2) {
          pl.vy += GRAVITY * 0.55 * dt;
          pl.y += pl.vy * dt;
          if (pl.y > pl.baseY + 1600) pl.dead = true;
        }
      }
    }
  }

  private updateObstacles(dt: number) {
    const p = this.player;
    const L = this.layout.obstacles;
    const camR = this.cam.x + VIEW_W + 1200;
    for (let i = this.obsStart; i < L.length; i++) {
      const o = L[i] as Obstacle;
      if (o.x > camR && o.baseX > camR) break;
      if (o.dead) continue;
      if (o.kind === "pigeon" || o.kind === "seagull") {
        if (!o.active && o.x - p.x < 1000) o.active = true;
        if (o.active) {
          o.x += o.vx * dt;
          const amp = o.kind === "pigeon" ? 4 : 10;
          const f = o.kind === "pigeon" ? 9 : 3;
          o.y = o.baseY + Math.sin(this.time * f + o.id) * amp;
        }
      } else if (o.kind === "icicle") {
        if (o.state === 0 && o.x - p.x < 700) {
          o.state = 1;
          o.timer = 0;
        } else if (o.state === 1) {
          o.timer += dt;
          o.x = o.baseX + Math.sin(this.time * 60) * 1.5;
          if (o.timer > 0.25) {
            o.state = 2;
            o.x = o.baseX;
          }
        } else if (o.state === 2) {
          o.vy = Math.min(o.vy + GRAVITY * dt, 1600);
          o.y += o.vy * dt;
          const hostTop = o.baseY + 250;
          if (o.y + o.h >= hostTop) {
            o.state = 3;
            o.h = 34;
            o.y = hostTop - 34;
            o.vy = 0;
            for (let k = 0; k < 8; k++)
              this.particles.spawn({
                x: o.x + 10,
                y: hostTop - 4,
                vx: (Math.random() - 0.5) * 260,
                vy: -Math.random() * 260,
                gravity: 1200,
                life: 0.5,
                size: 3 + Math.random() * 3,
                color: "#e8f6ff",
                shape: Shape.Rect,
              });
            if (Math.abs(o.x - p.x) < 900) this.sink.sfx("smash", 1.6);
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------ player
  private updatePlayer(dt: number, input: InputFrame) {
    const p = this.player;
    p.anim += dt * (p.vx / 60);
    p.jumpHeld = input.jumpHeld;
    if (input.jumpPressed) p.jumpBuffer = JUMP_BUFFER_TIME;
    else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    if (p.grounded) p.coyote = COYOTE_TIME;
    else p.coyote = Math.max(0, p.coyote - dt);
    if (!p.grounded) p.airTime += dt;

    // Carry the cat along with moving / falling planks.
    if (p.grounded && p.ground && "kind" in p.ground && (p.ground.kind === "moving" || p.ground.kind === "crumble")) {
      const g = p.ground as Platform;
      if (!g.dead) p.y += g.y - g.prevY;
    }

    // Horizontal speed toward target, depending on surface grip.
    const target = this.targetSpeed();
    let accel = RUN_ACCEL;
    if (p.grounded) {
      if (p.groundSurface === "ice") accel = RUN_ACCEL_SLIPPERY;
      else if (p.groundSurface === "wet") accel = RUN_ACCEL_SLIPPERY * 1.6;
    } else accel = RUN_ACCEL * 0.6;
    if (this.powers.speed > 0) accel = RUN_ACCEL * 2.5;
    const dv = target - p.vx;
    p.vx += Math.max(-accel * dt, Math.min(accel * dt, dv));

    // Jumping (with jump buffer + coyote time + one air jump).
    if (p.jumpBuffer > 0 && !p.wallRun) {
      if (p.grounded || (p.coyote > 0 && p.jumpsUsed === 0)) this.jump();
      else if (p.wallContact && !p.wallRunUsed) this.startWallRun();
      else if (p.jumpsUsed < 2) this.doubleJump();
    }
    if (p.jumpHeld && p.vy < 0 && p.holdTime > 0.2 && !p.wallRun) this.markHint("hold");

    // Sliding.
    if (input.slidePressed) {
      if (p.grounded) this.startSlide();
      else {
        p.vy = Math.max(p.vy, FAST_FALL_SPEED);
        p.slideQueued = true;
        p.wallRun = false;
      }
    }
    if (p.sliding) {
      p.slideTimer -= dt;
      if (p.slideTimer <= 0 && !input.slideHeld) this.tryStand();
      if (p.grounded && Math.random() < 0.5)
        this.particles.spawn({
          x: p.x + 4,
          y: p.y + p.h,
          vx: -p.vx * 0.2,
          vy: -40 - Math.random() * 40,
          life: 0.35,
          size: 3 + Math.random() * 3,
          grow: 10,
          color: this.dustColor(),
          alpha: 0.6,
        });
    }

    // Vertical motion.
    if (p.wallRun) {
      p.vy = -WALLRUN_SPEED;
      p.wallRunTimer += dt;
      if (!p.jumpHeld || p.wallRunTimer > WALLRUN_MAX_TIME) {
        p.wallRun = false;
        p.vy = -120;
      }
      if (Math.random() < 0.6)
        this.particles.spawn({
          x: p.x + p.w,
          y: p.y + p.h,
          vx: -30,
          vy: 60,
          life: 0.4,
          size: 3,
          grow: 6,
          color: this.dustColor(),
          alpha: 0.6,
        });
    } else if (!p.grounded) {
      const mult = this.powers.super > 0 ? 0.92 : 1;
      p.vy += gravityFor(p.vy, p.jumpHeld, p.holdTime) * mult * dt;
      p.holdTime += dt;
      p.vy = Math.min(p.vy, p.wallContact && p.vy > 0 ? WALL_SLIDE_SPEED : MAX_FALL_SPEED);
    } else {
      p.vy = 0.0001; // tiny downward probe keeps ground contact through the sweep
    }

    p.wallContact = false;
    this.moveAndCollide(dt);

    // Wall-run ends when the wall is no longer there (reached the top): pop onto the roof.
    if (p.wallRun && !p.wallContact) {
      p.wallRun = false;
      p.vy = -360;
      p.squashY = 1.2;
      p.squashX = 0.85;
    }

    // Running dust.
    if (p.grounded && !p.sliding) {
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = this.lowQuality ? 0.2 : 0.1;
        this.particles.spawn({
          x: p.x + 6,
          y: p.y + p.h - 2,
          vx: -40 - Math.random() * 40,
          vy: -20 - Math.random() * 30,
          life: 0.4,
          size: 2 + Math.random() * 3,
          grow: 8,
          color: this.dustColor(),
          alpha: 0.45,
        });
      }
    }
  }

  private dustColor() {
    const s = this.player.groundSurface;
    if (s === "ice" || this.world.weather === "snow") return "#f2f6ff";
    if (s === "sand") return "#f3d3a0";
    if (s === "wet") return "#c6dbe6";
    if (s === "cloud") return "#ffffff";
    return "#e9dcc8";
  }

  private jump() {
    const p = this.player;
    const mult = this.powers.super > 0 ? SUPER_JUMP_MULT : 1;
    if (p.sliding) this.stand(true);
    p.vy = -JUMP_VELOCITY * mult;
    p.grounded = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
    p.jumpsUsed = 1;
    p.holdTime = 0;
    p.airTime = 0;
    p.takeoffId = p.ground && "kind" in p.ground ? p.ground.id : -1;
    p.ground = null;
    p.squashX = 0.78;
    p.squashY = 1.28;
    this.stats.jumps++;
    for (let i = 0; i < 6; i++)
      this.particles.spawn({
        x: p.x + p.w / 2,
        y: p.y + p.h,
        vx: (Math.random() - 0.5) * 160,
        vy: -Math.random() * 60,
        life: 0.4,
        size: 3 + Math.random() * 3,
        grow: 10,
        color: this.dustColor(),
        alpha: 0.6,
      });
    this.sink.sfx("jump", mult);
    this.markHint("jump");
  }

  private doubleJump() {
    const p = this.player;
    const mult = this.powers.super > 0 ? SUPER_JUMP_MULT : 1;
    p.vy = -DOUBLE_JUMP_VELOCITY * mult;
    p.jumpsUsed = 2;
    p.jumpBuffer = 0;
    p.holdTime = 0;
    p.doubleFlash = 0.35;
    p.squashX = 0.8;
    p.squashY = 1.25;
    this.stats.jumps++;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.particles.spawn({
        x: p.x + p.w / 2,
        y: p.y + p.h,
        vx: Math.cos(a) * 160,
        vy: Math.sin(a) * 60 + 40,
        life: 0.35,
        size: 3,
        color: this.world.accent2,
        shape: Shape.Star,
        additive: true,
      });
    }
    this.sink.sfx("double", mult);
    this.markHint("double");
    this.markHint("jump");
  }

  private startWallRun() {
    const p = this.player;
    p.wallRun = true;
    p.wallRunUsed = true;
    p.wallRunTimer = 0;
    p.jumpBuffer = 0;
    p.vy = -WALLRUN_SPEED;
    p.jumpsUsed = 1;
    this.sink.sfx("wallrun");
    this.markHint("wall");
  }

  private startSlide() {
    const p = this.player;
    if (p.sliding) {
      p.slideTimer = Math.max(p.slideTimer, 0.2);
      return;
    }
    p.sliding = true;
    p.slideQueued = false;
    p.slideTimer = p.groundSurface === "ice" ? SLIDE_TIME_ICE : SLIDE_TIME;
    p.y += PLAYER_H - SLIDE_H;
    p.h = SLIDE_H;
    p.squashX = 1.2;
    p.squashY = 0.85;
    this.sink.sfx("slide");
    this.markHint("slide");
  }

  /** Stand up only if nothing is overhead; otherwise keep sliding. */
  private tryStand() {
    const p = this.player;
    const box: Box = { x: p.x, y: p.y + p.h - PLAYER_H, w: p.w, h: PLAYER_H };
    for (let i = this.obsStart; i < this.layout.obstacles.length; i++) {
      const o = this.layout.obstacles[i] as Obstacle;
      if (o.x > p.x + 200) break;
      if (o.dead || o.zone) continue;
      if ((o.kind === "sign" || o.kind === "laundry" || o.solid) && overlaps(box, o, 2)) {
        p.slideTimer = 0.05;
        return;
      }
    }
    this.stand(false);
  }

  private stand(force: boolean) {
    const p = this.player;
    if (!p.sliding && !force) return;
    p.sliding = false;
    p.y -= PLAYER_H - p.h;
    p.h = PLAYER_H;
  }

  // ------------------------------------------------------------------ collision
  private moveAndCollide(dt: number) {
    const p = this.player;
    let rx = finite((p.vx + p.windX) * dt);
    let ry = finite(p.vy * dt);
    const wasGrounded = p.grounded;
    const prevGround = p.ground;
    p.grounded = false;

    for (let iter = 0; iter < 4; iter++) {
      if (rx === 0 && ry === 0) break;
      const box: Box = { x: p.x, y: p.y, w: p.w, h: p.h };
      let bestT = 2;
      let bestNx = 0;
      let bestNy = 0;
      let bestP: Platform | null = null;
      let bestO: Obstacle | null = null;
      const minX = Math.min(p.x, p.x + rx) - 20;
      const maxX = Math.max(p.x + p.w, p.x + p.w + rx) + 20;

      const PL = this.layout.platforms;
      for (let i = this.platStart; i < PL.length; i++) {
        const s = PL[i] as Platform;
        if (s.x > maxX) break;
        if (s.dead || s.x + s.w < minX) continue;
        if (SOLID_PLATFORM(s)) {
          const h = sweepAABB(box, rx, ry, s);
          if (h && h.t < bestT) {
            bestT = h.t;
            bestNx = h.nx;
            bestNy = h.ny;
            bestP = s;
            bestO = null;
          }
        } else {
          // one-way: only from above, only when feet were above the plank
          if (ry <= 0) continue;
          if (box.y + box.h > Math.min(s.y, s.prevY) + 1.5) continue;
          const h = sweepAABB(box, rx, ry, { x: s.x, y: s.y, w: s.w, h: 4 });
          if (h && h.ny === -1 && h.t < bestT) {
            bestT = h.t;
            bestNx = 0;
            bestNy = -1;
            bestP = s;
            bestO = null;
          }
        }
      }
      const OL = this.layout.obstacles;
      for (let i = this.obsStart; i < OL.length; i++) {
        const o = OL[i] as Obstacle;
        if (o.x > maxX) break;
        if (!o.solid || o.dead || o.x + o.w < minX) continue;
        const h = sweepAABB(box, rx, ry, o);
        if (h && h.t < bestT) {
          bestT = h.t;
          bestNx = h.nx;
          bestNy = h.ny;
          bestP = null;
          bestO = o;
        }
      }

      if (bestT > 1) {
        p.x += rx;
        p.y += ry;
        break;
      }
      p.x += rx * bestT;
      p.y += ry * bestT;
      const remain = 1 - bestT;
      const surf = (bestP ?? bestO) as Platform | Obstacle;

      if (bestNy === -1) {
        p.y = surf.y - p.h;
        this.land(surf, wasGrounded, prevGround);
        ry = 0;
        rx *= remain;
        if (!p.grounded) ry = p.vy * dt * remain; // bounced
      } else if (bestNy === 1) {
        p.vy = Math.max(0, p.vy);
        ry = 0;
        rx *= remain;
      } else {
        const res = this.sideHit(surf, bestO !== null);
        if (res === "grab") {
          ry = 0;
          rx *= remain;
        } else if (res === "pass") {
          rx *= remain;
          ry *= remain;
        } else {
          rx = 0;
          ry *= remain;
        }
        if (this.state !== "playing") break;
      }
    }

    // Rising planks may move into the cat's feet: snap onto them.
    if (!p.grounded && p.vy >= 0) {
      const PL = this.layout.platforms;
      for (let i = this.platStart; i < PL.length; i++) {
        const s = PL[i] as Platform;
        if (s.x > p.x + p.w) break;
        if (s.dead || SOLID_PLATFORM(s) || s.x + s.w < p.x) continue;
        const feet = p.y + p.h;
        const prevFeet = p.prevY + p.h;
        if (feet >= s.y && feet <= s.y + 16 && prevFeet <= s.prevY + 2) {
          p.y = s.y - p.h;
          this.land(s, wasGrounded, prevGround);
          break;
        }
      }
    }

    // Depenetration guard (should be rare thanks to the sweep).
    const box: Box = { x: p.x, y: p.y, w: p.w, h: p.h };
    const PL = this.layout.platforms;
    for (let i = this.platStart; i < PL.length; i++) {
      const s = PL[i] as Platform;
      if (s.x > p.x + p.w) break;
      if (s.dead || !SOLID_PLATFORM(s)) continue;
      if (overlaps(box, s)) {
        const pen = p.y + p.h - s.y;
        if (pen <= LEDGE_TOLERANCE) {
          p.y = s.y - p.h;
          this.land(s, wasGrounded, prevGround);
        } else {
          p.x = s.x - p.w - 0.01;
        }
      }
    }
    if (p.grounded) p.lastFeet = p.y + p.h;
  }

  private land(s: Platform | Obstacle, wasGrounded: boolean, prevGround: Platform | Obstacle | null) {
    const p = this.player;
    const isPlatform = "crumbleState" in s;
    const impact = p.vy;
    const fresh = !wasGrounded || prevGround !== s;
    if (fresh && p.airTime > 0.06) {
      // Bouncy awnings launch the cat.
      if (isPlatform && (s as Platform).kind === "awning") {
        p.vy = -BOUNCE_VELOCITY * (this.powers.super > 0 ? 1.1 : 1);
        p.holdTime = MAX_HOLD_BOUNCE;
        p.jumpsUsed = 1;
        p.airTime = 0;
        p.takeoffId = s.id;
        p.squashX = 1.35;
        p.squashY = 0.7;
        this.sink.sfx("bounce");
        return;
      }
      const k = Math.min(1, impact / 1200);
      p.squashX = 1 + 0.35 * k;
      p.squashY = 1 - 0.3 * k;
      const n = Math.round(4 + k * 10);
      for (let i = 0; i < n; i++)
        this.particles.spawn({
          x: p.x + p.w / 2 + (Math.random() - 0.5) * 30,
          y: p.y + p.h,
          vx: (Math.random() - 0.5) * 260 * (0.5 + k),
          vy: -Math.random() * 90,
          life: 0.45,
          size: 3 + Math.random() * 4,
          grow: 12,
          color: this.dustColor(),
          alpha: 0.65,
          drag: 3,
        });
      this.sink.sfx("land", 0.8 + k * 0.4);
      if (k > 0.85) this.addTrauma(0.15);
      if (isPlatform && p.takeoffId !== s.id && p.takeoffId !== -1 && p.airTime > 0.25) {
        const into = p.x + p.w - s.x;
        if (into >= 0 && into < PERFECT_ZONE) {
          this.stats.perfects++;
          this.addCombo("PERFECT!");
        }
      }
      if (isPlatform && (s as Platform).kind === "crumble" && (s as Platform).crumbleState === 0) {
        (s as Platform).crumbleState = 1;
        (s as Platform).crumbleTimer = 0;
      }
    }
    p.grounded = true;
    p.vy = 0;
    p.jumpsUsed = 0;
    p.ground = s;
    p.groundSurface = isPlatform ? (s as Platform).surface : "normal";
    p.airTime = 0;
    p.wallRun = false;
    p.wallRunUsed = false;
    p.coyote = COYOTE_TIME;
    if (p.slideQueued) {
      p.slideQueued = false;
      this.startSlide();
    }
  }

  private sideHit(s: Platform | Obstacle, isObstacle: boolean): "grab" | "wall" | "hit" | "pass" {
    const p = this.player;
    const feet = p.y + p.h;
    const below = feet - s.y;
    // Ledge grab: feet only slightly below the top edge, pop up onto it.
    if (below >= 0 && below <= LEDGE_TOLERANCE && !p.sliding) {
      p.y = s.y - p.h;
      p.x += 1;
      p.ledgeTimer = 0.2;
      p.airTime = Math.max(p.airTime, 0.07);
      this.land(s, false, null);
      return "grab";
    }
    if (isObstacle) {
      const o = s as Obstacle;
      if (this.powers.speed > 0 || p.invuln > 0) {
        this.smash(o);
        return "pass";
      }
      return this.hit(o) ? "pass" : "hit";
    }
    p.wallContact = true;
    if (!p.wallRun && !p.grounded && !p.wallRunUsed && (p.jumpHeld || p.jumpBuffer > 0)) this.startWallRun();
    return "wall";
  }

  /** Returns true when the hit was absorbed and the obstacle destroyed. */
  private hit(o: Obstacle | null): boolean {
    const p = this.player;
    if (p.invuln > 0 || this.powers.speed > 0) {
      if (o) this.smash(o);
      return true;
    }
    if (this.powers.shield > 0) {
      this.powers.shield = 0;
      p.invuln = 1.2;
      if (o) this.smash(o);
      this.texts.spawn("SHIELD SAVED YOU!", p.x + 20, p.y - 30, "#7fe3ff", 24);
      this.sink.sfx("shield");
      this.addTrauma(0.35);
      return true;
    }
    if (this.def.tutorial) {
      if (o) this.smash(o);
      p.invuln = 1.5;
      this.texts.spawn("Oops! Keep going!", p.x + 20, p.y - 30, "#ffd166", 24);
      this.sink.sfx("hit", 1.3);
      this.addTrauma(0.3);
      return true;
    }
    this.die("hit");
    return false;
  }

  private smash(o: Obstacle) {
    o.dead = true;
    const colors = ["#ffd166", "#ffffff", this.world.accent];
    for (let i = 0; i < 14; i++)
      this.particles.spawn({
        x: o.x + o.w / 2,
        y: o.y + o.h / 2,
        vx: (Math.random() - 0.3) * 420,
        vy: -Math.random() * 380,
        gravity: 1300,
        life: 0.8,
        size: 4 + Math.random() * 6,
        color: colors[i % 3] as string,
        shape: Shape.Rect,
        vr: (Math.random() - 0.5) * 12,
      });
    this.sink.sfx("smash");
    this.addTrauma(0.25);
  }

  private die(cause: "fall" | "hit" | "caught") {
    const p = this.player;
    this.state = "dying";
    this.stateTimer = 0;
    this.deathCause = cause;
    p.hurt = true;
    p.wallRun = false;
    this.combo = 0;
    this.mult = 1;
    if (cause !== "fall") {
      p.vy = -520;
      p.vx = -80;
      this.addTrauma(0.6);
    }
    this.sink.sfx("hit");
  }

  // ------------------------------------------------------------------ zones, hazards, collectibles
  private checkZonesAndHazards(dt: number) {
    if (this.state !== "playing") return;
    const p = this.player;
    const box: Box = { x: p.x, y: p.y, w: p.w, h: p.h };
    let fx = 0;
    let onIce = false;
    const OL = this.layout.obstacles;
    for (let i = this.obsStart; i < OL.length; i++) {
      const o = OL[i] as Obstacle;
      if (o.x > p.x + 700) break;
      if (o.dead) continue;
      if (o.zone) {
        if (!overlaps(box, o)) continue;
        if (o.kind === "puddle" && p.grounded) {
          if (this.slowTimer <= 0) {
            this.sink.sfx("splash");
            for (let k = 0; k < 10; k++)
              this.particles.spawn({
                x: p.x + p.w / 2,
                y: o.y,
                vx: (Math.random() - 0.3) * 220,
                vy: -150 - Math.random() * 200,
                gravity: 1400,
                life: 0.6,
                size: 3 + Math.random() * 2,
                color: "#9fd8ff",
                alpha: 0.8,
              });
          }
          this.slowTimer = PUDDLE_TIME;
        } else if (o.kind === "ice" && p.grounded) onIce = true;
        else if (o.kind === "gust" || o.kind === "wind") {
          fx += o.forceX;
          if (!p.grounded && !p.wallRun) p.vy += o.forceY * dt;
          if (Math.random() < 0.3)
            this.particles.spawn({
              x: p.x + Math.random() * 60 - 10,
              y: p.y + p.h,
              vx: o.forceX * 0.5,
              vy: -120 - Math.random() * 120,
              life: 0.5,
              size: 2,
              color: o.kind === "gust" ? "#ffe2b0" : "#ffffff",
              shape: Shape.Line,
              alpha: 0.7,
            });
        }
        continue;
      }
      if (o.hazard) {
        if (overlaps(box, o, 4)) {
          this.hit(o);
          if (this.state !== "playing") return;
          continue;
        }
      }
      // Near-miss tracking for hazards and solid obstacles.
      if (o.hazard || o.solid) {
        if (box.x + box.w > o.x - 10 && box.x < o.x + o.w + 10) o.closest = Math.min(o.closest, boxDistance(box, o));
        if (!o.passed && box.x > o.x + o.w) {
          o.passed = true;
          if (o.closest < NEAR_MISS_DIST) {
            this.stats.nearMisses++;
            this.addCombo("NEAR MISS!");
          }
        }
      }
    }
    if (onIce) p.groundSurface = "ice";
    p.windX += (fx - p.windX) * Math.min(1, dt * 6);
  }

  private updateCollectibles(dt: number) {
    const p = this.player;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const CL = this.layout.collectibles;
    const magnet = this.powers.magnet > 0 && this.state === "playing";
    for (let i = this.colStart; i < CL.length; i++) {
      const c = CL[i] as Collectible;
      if (c.x > p.x + VIEW_W + 300) break;
      if (c.taken) continue;
      if (c.attracted) {
        const dx = cx - c.x;
        const dy = cy - c.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = 900 + p.vx;
        c.x += (dx / d) * sp * dt;
        c.y += (dy / d) * sp * dt;
      } else {
        c.y = c.baseY + Math.sin(this.time * 3 + c.phase) * 4;
        if (magnet && (c.kind === "fish" || c.kind === "gold")) {
          if (Math.hypot(cx - c.x, cy - c.y) < MAGNET_RADIUS) c.attracted = true;
        }
      }
      if (this.state !== "playing") continue;
      const r = c.kind === "fish" || c.kind === "gold" ? PICKUP_RADIUS : PICKUP_RADIUS + 8;
      if (Math.abs(cx - c.x) < r && Math.abs(cy - c.y) < r + 4) this.take(c);
    }
  }

  private take(c: Collectible) {
    c.taken = true;
    const p = this.player;
    if (c.kind === "fish" || c.kind === "gold") {
      const value = c.kind === "gold" ? 5 : 1;
      this.fishCount++;
      this.coins += value;
      this.score += value * 10 * this.mult;
      this.fishStreak++;
      this.fishStreakTimer = 0.45;
      const n = this.lowQuality ? 3 : 6;
      for (let i = 0; i < n; i++)
        this.particles.spawn({
          x: c.x,
          y: c.y,
          vx: (Math.random() - 0.5) * 200,
          vy: (Math.random() - 0.5) * 200,
          life: 0.4,
          size: c.kind === "gold" ? 4 : 3,
          color: c.kind === "gold" ? "#ffd166" : "#bfefff",
          shape: Shape.Star,
          drag: 4,
          additive: true,
        });
      this.sink.sfx(c.kind === "gold" ? "gold" : "fish", 1 + Math.min(this.fishStreak, 12) * 0.045);
      if (c.kind === "gold") this.texts.spawn("+5", c.x, c.y - 10, "#ffd166", 22);
      this.markHint("fish");
    } else if (c.kind === "star") {
      this.starFound = true;
      this.score += 500;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        this.particles.spawn({
          x: c.x,
          y: c.y,
          vx: Math.cos(a) * 300,
          vy: Math.sin(a) * 300,
          life: 0.8,
          size: 6,
          color: "#ffe066",
          shape: Shape.Star,
          drag: 3,
          additive: true,
        });
      }
      this.texts.spawn("HIDDEN STAR!", 0, 0, "#ffe066", 40, true, 1.6);
      this.sink.sfx("star");
    } else {
      const k = c.kind as PowerKind;
      this.powers[k] = POWERUP_DURATION[k];
      const label = { magnet: "MAGNET!", shield: "SHIELD!", speed: "SPEED DASH!", super: "SUPER JUMP!" }[k];
      this.texts.spawn(label, 0, 0, "#ffffff", 36, true, 1.2);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        this.particles.spawn({
          x: c.x,
          y: c.y,
          vx: Math.cos(a) * 240,
          vy: Math.sin(a) * 240,
          life: 0.5,
          size: 5,
          color: "#ffffff",
          shape: Shape.Ring,
          grow: 20,
          drag: 3,
        });
      }
      this.sink.sfx(k === "speed" ? "whoosh" : "power");
      this.markHint("power");
      if (k === "speed") p.invuln = Math.max(p.invuln, 0);
    }
  }

  private addCombo(label: string) {
    this.combo++;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    this.comboTimer = COMBO_TIMEOUT;
    this.mult = 1 + Math.min(this.combo, 8) * 0.5;
    this.comboPop = 1;
    this.score += 25 * this.mult;
    const p = this.player;
    this.texts.spawn(label, p.x + 30, p.y - 24, "#ffd166", 26);
    this.sink.sfx("combo", 1 + Math.min(this.combo, 8) * 0.08);
  }

  private updateVacuum(dt: number) {
    if (!this.vacuum.active || this.state !== "playing") return;
    const p = this.player;
    const v = this.vacuum;
    const speed = this.def.speed * (1 + SPEED_RAMP * this.progress);
    v.x += speed * dt;
    if (p.x - v.x > 520) v.x = p.x - 520;
    if (v.x + 230 >= p.x) {
      if (this.powers.shield > 0 || this.powers.speed > 0 || p.invuln > 0) {
        if (this.powers.shield > 0) {
          this.powers.shield = 0;
          this.texts.spawn("SHIELD SAVED YOU!", p.x, p.y - 30, "#7fe3ff", 24);
          this.sink.sfx("shield");
        }
        v.x = p.x - 520;
        p.invuln = Math.max(p.invuln, 1);
      } else this.die("caught");
    }
    if (Math.random() < 0.5)
      this.particles.spawn({
        x: v.x + 260 + Math.random() * 240,
        y: p.y + p.h - Math.random() * 120,
        vx: -500,
        vy: (Math.random() - 0.5) * 60,
        life: 0.4,
        size: 2,
        color: "#ffffff",
        shape: Shape.Line,
        alpha: 0.6,
      });
  }

  private checkDeath() {
    if (this.state !== "playing") return;
    const p = this.player;
    let lowest = -Infinity;
    const PL = this.layout.platforms;
    for (let i = this.platStart; i < PL.length; i++) {
      const s = PL[i] as Platform;
      if (s.x > p.x + 900) break;
      if (s.dead || s.x + s.w < p.x - 200) continue;
      lowest = Math.max(lowest, s.kind === "crumble" ? s.baseY : s.y);
    }
    if (!Number.isFinite(lowest)) lowest = p.lastFeet;
    const deathY = Math.max(lowest, p.lastFeet) + 320;
    if (p.y > deathY) {
      if (this.powers.shield > 0 || this.powers.speed > 0 || this.def.tutorial) {
        if (this.powers.shield > 0 && this.powers.speed <= 0) this.powers.shield = 0;
        this.respawnSafe();
        this.texts.spawn(this.def.tutorial ? "Oops! Try that again" : "SAVED!", 0, 0, "#ffd166", 34, true, 1.2);
        this.sink.sfx("shield");
      } else this.die("fall");
    }
  }

  /** Place the cat on the next safe platform ahead (used for shields, tutorial and revive). */
  respawnSafe() {
    const p = this.player;
    const PL = this.layout.platforms;
    let target: Platform | null = null;
    for (const s of PL) {
      if (s.dead || s.kind === "crumble" || s.kind === "moving" || s.kind === "awning") continue;
      if (s.x + s.w > p.x + 120 && s.w >= 120) {
        target = s;
        break;
      }
    }
    if (!target) target = PL[PL.length - 1] ?? null;
    if (!target) return;
    let x = Math.max(target.x + 30, Math.min(p.x, target.x + target.w - 220));
    for (const o of this.layout.obstacles) {
      if (o.dead || o.zone) continue;
      if (o.x < x + 260 && o.x + o.w > x - 40 && Math.abs(o.y + o.h - target.y) < 400) x = o.x + o.w + 40;
    }
    // Clear nearby hazards ahead so the respawn is fair.
    for (const o of this.layout.obstacles) {
      if ((o.hazard || o.solid) && !o.dead && o.x > x - 60 && o.x < x + 280) o.dead = true;
    }
    p.x = x;
    p.h = PLAYER_H;
    p.y = target.y - PLAYER_H;
    p.prevX = p.x;
    p.prevY = p.y;
    p.vy = 0;
    p.vx = this.def.speed * 0.6;
    p.sliding = false;
    p.wallRun = false;
    p.wallContact = false;
    p.grounded = true;
    p.ground = target;
    p.groundSurface = target.surface;
    p.jumpsUsed = 0;
    p.lastFeet = target.y;
    p.invuln = 2;
    p.hurt = false;
    p.trail.length = 0;
    this.cam.targetY = target.y - VIEW_H * 0.66;
    if (this.vacuum.active) this.vacuum.x = Math.min(this.vacuum.x, p.x - 520);
  }

  revive() {
    if (this.reviveUsed) return false;
    this.reviveUsed = true;
    this.state = "playing";
    this.deathCause = null;
    this.respawnSafe();
    return true;
  }

  private finish() {
    this.state = "complete";
    this.stateTimer = 0;
    const p = this.player;
    for (let i = 0; i < (this.lowQuality ? 60 : 150); i++) {
      this.particles.spawn({
        x: p.x + (Math.random() - 0.2) * VIEW_W * 0.8,
        y: this.cam.y - 20,
        vx: (Math.random() - 0.5) * 200,
        vy: 80 + Math.random() * 200,
        gravity: 160,
        drag: 0.6,
        life: 3 + Math.random() * 1.5,
        size: 6 + Math.random() * 6,
        color: ["#ff6b6b", "#ffd166", "#06d6a0", "#4cc9f0", "#f78cff"][i % 5] as string,
        shape: Shape.Rect,
        vr: (Math.random() - 0.5) * 10,
      });
    }
    this.sink.sfx("complete");
  }

  private updateEndStates(dt: number) {
    const p = this.player;
    this.stateTimer += dt;
    if (this.state === "complete") {
      p.vx *= Math.exp(-2.2 * dt);
      if (!p.grounded) p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL_SPEED);
      if (p.sliding) this.stand(true);
      this.moveAndCollide(dt);
      if (this.stateTimer > 1.8) {
        this.state = "done";
        this.sink.complete();
      }
    } else if (this.state === "dying") {
      p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL_SPEED);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-2 * dt);
      if (this.stateTimer > 1.0) {
        this.state = "dead";
        this.sink.gameOver();
      }
    }
  }

  private updateHints(dt: number) {
    const p = this.player;
    for (const h of this.layout.hints) {
      if (!h.shown && p.x >= h.x) {
        h.shown = true;
        this.activeHint = h;
      }
    }
    const h = this.activeHint;
    if (h && (h.done || p.x > h.until)) {
      this.hintAlpha = Math.max(0, this.hintAlpha - dt * 3);
      if (this.hintAlpha <= 0) this.activeHint = null;
    } else if (h) this.hintAlpha = Math.min(1, this.hintAlpha + dt * 4);
    const slow = h && !h.done && h.slowmo && p.x > h.slowFrom && p.x < h.until;
    this.timeScale += ((slow ? 0.42 : 1) - this.timeScale) * Math.min(1, dt * 10);
  }

  private markHint(action: HintAction) {
    for (const h of this.layout.hints) if (h.shown && !h.done && h.action === action) h.done = true;
  }

  private updateSquash(dt: number) {
    const p = this.player;
    const k = 180;
    const d = 14;
    p.squashVX += (-(p.squashX - 1) * k - p.squashVX * d) * dt;
    p.squashVY += (-(p.squashY - 1) * k - p.squashVY * d) * dt;
    p.squashX += p.squashVX * dt;
    p.squashY += p.squashVY * dt;
    p.squashX = Math.max(0.6, Math.min(1.5, finite(p.squashX, 1)));
    p.squashY = Math.max(0.6, Math.min(1.5, finite(p.squashY, 1)));
  }

  private updateCamera(dt: number) {
    const p = this.player;
    const c = this.cam;
    const look = Math.max(0, p.vx - this.def.speed) * 0.25;
    const tx = p.x - VIEW_W * 0.28 + look;
    c.x += (tx - c.x) * (1 - Math.exp(-14 * dt));
    if (this.state === "playing" || this.state === "complete") {
      if (p.grounded) c.targetY = p.y + p.h - VIEW_H * 0.66;
      else {
        if (p.y < c.targetY + 150) c.targetY = p.y - 150;
        const feet = p.y + p.h;
        if (feet > c.targetY + VIEW_H - 110 && feet < p.lastFeet + 160) c.targetY = feet - VIEW_H + 110;
      }
    }
    c.y += (c.targetY - c.y) * (1 - Math.exp(-5 * dt));
    c.trauma = Math.max(0, c.trauma - dt * 1.6);
  }

  addTrauma(a: number) {
    this.cam.trauma = Math.min(1, this.cam.trauma + a);
  }

  private updateWeather(dt: number) {
    this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.world.weather === "rain") {
      this.nextThunder -= dt;
      if (this.nextThunder <= 0) {
        this.flash = 1;
        this.nextThunder = 5 + ((this.time * 7.31) % 5);
        this.sink.sfx("thunder");
      }
    }
  }

  /** Recycle: skip entities that are far behind the camera. */
  private advanceWindows() {
    const behind = this.cam.x - 700;
    const PL = this.layout.platforms;
    while (this.platStart < PL.length - 1) {
      const s = PL[this.platStart] as Platform;
      if (s.x + s.w < behind) this.platStart++;
      else break;
    }
    const OL = this.layout.obstacles;
    while (this.obsStart < OL.length) {
      const o = OL[this.obsStart] as Obstacle;
      if (o.x + o.w < behind && o.baseX + o.w < behind) this.obsStart++;
      else break;
    }
    const CL = this.layout.collectibles;
    while (this.colStart < CL.length) {
      const c = CL[this.colStart] as Collectible;
      if (c.x < behind && (c.taken || !c.attracted)) this.colStart++;
      else break;
    }
  }

  get windows() {
    return { plat: this.platStart, obs: this.obsStart, col: this.colStart };
  }

  /** NaN / runaway guards: never let bad numbers into the simulation. */
  private sanity() {
    const p = this.player;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.vx) || !Number.isFinite(p.vy)) {
      p.x = finite(p.prevX, this.layout.spawnX);
      p.y = finite(p.prevY, this.layout.spawnY - PLAYER_H);
      p.vx = this.def.speed;
      p.vy = 0;
      p.windX = 0;
      this.respawnSafe();
    }
    if (!Number.isFinite(this.cam.x) || !Number.isFinite(this.cam.y)) {
      this.cam.x = p.x - VIEW_W * 0.3;
      this.cam.y = p.y - VIEW_H * 0.6;
      this.cam.targetY = this.cam.y;
    }
  }
}

const MAX_HOLD_BOUNCE = 1; // bounces don't get the low "held" gravity
