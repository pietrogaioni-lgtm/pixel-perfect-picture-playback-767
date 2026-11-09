import { REVIVE_COST, VIEW_H, VIEW_W } from "./constants";
import { Run, type EngineSink, type SfxName } from "./engine";
import { emitGameEvent } from "./hooks";
import { Input } from "./input";
import { getLevel, LEVEL_COUNT } from "./levels";
import { FixedLoop } from "./loop";
import { Renderer, type Look } from "./render/renderer";
import { AudioEngine, type UiSfx } from "./audio";
import { getSaveStore, type SaveData, type Settings } from "./save";
import { newlyEarnedSkins } from "./skins";

export type RunScreen = "playing" | "countdown" | "paused" | "gameover" | "complete" | "menu";

export interface CompleteResult {
  levelId: number;
  stars: [boolean, boolean, boolean];
  newStars: [boolean, boolean, boolean];
  fish: number;
  totalFish: number;
  coins: number;
  distance: number;
  best: number;
  score: number;
  bestScore: number;
  newBest: boolean;
  unlockedSkins: string[];
}

export interface OverResult {
  levelId: number;
  distance: number;
  best: number;
  coins: number;
  canRevive: boolean;
  reviveCost: number;
  wallet: number;
  cause: string;
}

export interface AppCallbacks {
  onScreen: (s: RunScreen) => void;
  onComplete: (r: CompleteResult) => void;
  onGameOver: (r: OverResult) => void;
}

let activeApp: GameApp | null = null;

/**
 * Owns the canvas, the single game loop, input, audio and the current Run.
 * Only one instance can be alive (guards against React StrictMode double mounts).
 */
export class GameApp {
  private renderer: Renderer;
  private input: Input;
  readonly audio = new AudioEngine();
  private loop: FixedLoop;
  private run: Run | null = null;
  private mode: RunScreen = "menu";
  private countdown = 0;
  private menuTime = 0;
  private menuWorld = 0;
  private look: Look = { skin: "classic", hat: null, scarf: null, glasses: null };
  private settings: Settings = { music: true, sfx: true, shake: true, quality: "high" };
  private debug = false;
  private banked = false;
  private ro: ResizeObserver | null = null;
  private destroyed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private frame: HTMLElement,
    private container: HTMLElement,
    private cb: AppCallbacks,
  ) {
    if (activeApp) activeApp.destroy();
    activeApp = this;
    this.renderer = new Renderer(canvas);
    this.input = new Input(frame, {
      onPause: () => this.togglePause(),
      onDebug: () => {
        this.debug = !this.debug;
      },
      onGesture: () => this.audio.unlock(),
    });
    this.loop = new FixedLoop(
      (dt) => this.update(dt),
      (alpha, fdt) => this.draw(alpha, fdt),
      () => (this.mode === "playing" && this.run ? this.run.timeScale : 1),
    );
  }

  start() {
    this.input.attach();
    window.addEventListener("resize", this.onResize);
    window.addEventListener("orientationchange", this.onResize);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("blur", this.onBlur);
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.onResize());
      this.ro.observe(this.container);
    }
    this.onResize();
    this.loop.start();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loop.stop();
    this.input.detach();
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("orientationchange", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("blur", this.onBlur);
    this.ro?.disconnect();
    this.audio.destroy();
    this.run = null;
    if (activeApp === this) activeApp = null;
  }

  // ------------------------------------------------------------ settings
  setLook(look: Look) {
    this.look = look;
  }
  setSettings(s: Settings) {
    const qualityChanged = s.quality !== this.settings.quality;
    this.settings = s;
    this.audio.setMusic(s.music);
    this.audio.setSfx(s.sfx);
    if (qualityChanged) this.onResize();
  }
  setMenuWorld(w: number) {
    this.menuWorld = w;
    if (this.mode === "menu") this.audio.playMusic(w);
  }
  uiSfx(name: UiSfx) {
    this.audio.unlock();
    this.audio.sfx(name);
  }

  // ------------------------------------------------------------ flow
  startLevel(id: number) {
    this.bankRun();
    const def = getLevel(Math.max(1, Math.min(LEVEL_COUNT, id)));
    const sink: EngineSink = {
      sfx: (n: SfxName, p?: number) => this.audio.sfx(n, p),
      gameOver: () => this.onRunOver(),
      complete: () => this.onRunComplete(),
    };
    // A brand-new Run is a complete reset: no leftover obstacles, particles, timers, power-ups.
    this.run = new Run(def, sink, { lowQuality: this.settings.quality === "low" });
    this.banked = false;
    this.input.reset();
    this.audio.unlock();
    this.audio.playMusic(def.world);
    this.audio.setDuck(1);
    this.setMode("countdown");
    this.countdown = 3;
    this.lastCount = 4;
    this.loop.resetClock();
    getSaveStore().update((s) => ({ ...s, stats: { ...s.stats, runs: s.stats.runs + 1 } }));
    emitGameEvent({ type: "game_started", level: def.id });
  }

  restart() {
    if (this.run) this.startLevel(this.run.def.id);
  }

  pause() {
    if (this.mode === "playing" || this.mode === "countdown") {
      this.setMode("paused");
      this.input.reset();
      this.audio.setDuck(0.35);
    }
  }

  resume() {
    if (this.mode !== "paused") return;
    this.countdown = 3;
    this.lastCount = 4;
    this.input.reset();
    this.audio.setDuck(1);
    this.setMode("countdown");
    this.loop.resetClock();
  }

  togglePause() {
    if (this.mode === "playing" || this.mode === "countdown") this.pause();
    else if (this.mode === "paused") this.resume();
  }

  quitToMenu() {
    this.bankRun();
    this.run = null;
    this.input.reset();
    this.audio.setDuck(1);
    this.audio.playMusic(this.menuWorld);
    this.setMode("menu");
  }

  /** Spend fish to continue once per attempt. */
  revive(): boolean {
    const run = this.run;
    if (!run || run.reviveUsed || this.mode !== "gameover") return false;
    const store = getSaveStore();
    const wallet = store.get().fish + run.coins;
    if (wallet < REVIVE_COST) return false;
    let cost = REVIVE_COST;
    const fromRun = Math.min(run.coins, cost);
    run.coins -= fromRun;
    cost -= fromRun;
    if (cost > 0) store.update((s) => ({ ...s, fish: s.fish - cost }));
    run.revive();
    emitGameEvent({ type: "reward", kind: "revive", amount: REVIVE_COST });
    this.countdown = 3;
    this.lastCount = 4;
    this.input.reset();
    this.audio.setDuck(1);
    this.setMode("countdown");
    this.loop.resetClock();
    return true;
  }

  private setMode(m: RunScreen) {
    this.mode = m;
    this.input.enabled = m === "playing" || m === "countdown";
    this.cb.onScreen(m);
  }

  /** Bank the fish collected during the attempt exactly once. */
  private bankRun() {
    const run = this.run;
    if (!run || this.banked) return;
    this.banked = true;
    const coins = run.coins;
    const stats = run.stats;
    const lvl = run.def.id;
    const dist = run.distance;
    getSaveStore().update((s) => {
      const prev = s.levels[String(lvl)] ?? { stars: [false, false, false] as [boolean, boolean, boolean], best: 0, bestScore: 0, completed: false };
      return {
        ...s,
        fish: s.fish + coins,
        levels: { ...s.levels, [String(lvl)]: { ...prev, best: Math.max(prev.best, Math.floor(dist)) } },
        stats: {
          ...s.stats,
          totalFish: s.stats.totalFish + coins,
          jumps: s.stats.jumps + stats.jumps,
          bestCombo: Math.max(s.stats.bestCombo, stats.maxCombo),
        },
      };
    });
  }

  private onRunOver() {
    const run = this.run;
    if (!run) return;
    const save = getSaveStore().get();
    const best = Math.max(save.levels[String(run.def.id)]?.best ?? 0, Math.floor(run.distance));
    this.audio.setDuck(0.35);
    this.setMode("gameover");
    emitGameEvent({ type: "game_over", level: run.def.id, distance: Math.floor(run.distance), cause: run.deathCause ?? "hit" });
    this.cb.onGameOver({
      levelId: run.def.id,
      distance: Math.floor(run.distance),
      best,
      coins: run.coins,
      canRevive: !run.reviveUsed,
      reviveCost: REVIVE_COST,
      wallet: save.fish + run.coins,
      cause: run.deathCause ?? "hit",
    });
  }

  private onRunComplete() {
    const run = this.run;
    if (!run) return;
    const id = run.def.id;
    const fishStar = run.fishCount >= Math.ceil(run.layout.totalFish * 0.8);
    const earned: [boolean, boolean, boolean] = [true, fishStar, run.starFound];
    const bonus = Math.floor(run.stats.maxCombo / 3) * 5;
    run.coins += bonus;
    const store = getSaveStore();
    const before = store.get();
    const prev = before.levels[String(id)];
    const prevStars = prev?.stars ?? [false, false, false];
    const prevBestScore = prev?.bestScore ?? 0;
    const score = Math.floor(run.score);
    this.bankRun();
    let unlocked: string[] = [];
    store.update((s) => {
      const cur = s.levels[String(id)] ?? { stars: [false, false, false] as [boolean, boolean, boolean], best: 0, bestScore: 0, completed: false };
      const stars: [boolean, boolean, boolean] = [cur.stars[0] || earned[0], cur.stars[1] || earned[1], cur.stars[2] || earned[2]];
      const next: SaveData = {
        ...s,
        unlocked: Math.max(s.unlocked, Math.min(LEVEL_COUNT, id + 1)),
        levels: {
          ...s.levels,
          [String(id)]: { stars, best: Math.max(cur.best, Math.floor(run.distance)), bestScore: Math.max(cur.bestScore, score), completed: true },
        },
      };
      const earnedSkins = newlyEarnedSkins(next);
      unlocked = earnedSkins.map((k) => k.id);
      return { ...next, ownedSkins: [...next.ownedSkins, ...unlocked] };
    });
    const after = store.get().levels[String(id)];
    this.audio.setDuck(0.5);
    this.setMode("complete");
    emitGameEvent({ type: "level_complete", level: id, stars: earned.filter(Boolean).length, fish: run.fishCount });
    this.cb.onComplete({
      levelId: id,
      stars: after?.stars ?? earned,
      newStars: [earned[0] && !prevStars[0], earned[1] && !prevStars[1], earned[2] && !prevStars[2]],
      fish: run.fishCount,
      totalFish: run.layout.totalFish,
      coins: run.coins,
      distance: Math.floor(run.distance),
      best: after?.best ?? Math.floor(run.distance),
      score,
      bestScore: Math.max(prevBestScore, score),
      newBest: score > prevBestScore,
      unlockedSkins: unlocked,
    });
  }

  // ------------------------------------------------------------ loop
  private lastCount = 4;

  private update(dt: number) {
    if (this.mode === "menu") {
      this.menuTime += dt;
      return;
    }
    const run = this.run;
    if (!run) return;
    if (this.mode === "countdown") {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n !== this.lastCount && n > 0) {
        this.lastCount = n;
        this.audio.sfx("count", n === 1 ? 1.5 : 1);
      }
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.input.reset();
        this.setMode("playing");
      }
      return;
    }
    if (this.mode === "paused") return;
    if (this.mode === "playing") {
      run.update(dt, this.input.frame());
    } else {
      // result screens: keep confetti / birds alive in the background
      run.update(dt, { jumpPressed: false, jumpHeld: false, slidePressed: false, slideHeld: false });
    }
  }

  private draw(_alpha: number, _fdt: number) {
    const high = this.settings.quality === "high";
    if (this.mode === "menu" || !this.run) {
      this.renderer.drawAttract(this.menuTime, this.menuWorld, this.look, high);
      return;
    }
    const run = this.run;
    const alpha = this.mode === "playing" ? _alpha : 1;
    this.renderer.drawRun(run, alpha, {
      look: this.look,
      shake: this.settings.shake,
      high,
      touch: this.input.lastDevice === "touch",
      countdown: this.mode === "countdown" ? this.countdown : 0,
      debug: this.debug
        ? [
            `FPS ${this.loop.fps}  UPS ${this.loop.ups}`,
            `entities ${run.entityCount()}  particles ${run.particles.count()}`,
            `state ${run.state}  mode ${this.mode}`,
            `x ${run.player.x.toFixed(0)}  vx ${run.player.vx.toFixed(0)}  vy ${run.player.vy.toFixed(0)}`,
            `grounded ${run.player.grounded}  jumps ${run.player.jumpsUsed}  ts ${run.timeScale.toFixed(2)}`,
          ]
        : null,
    });
  }

  // ------------------------------------------------------------ environment
  private onResize = () => {
    const r = this.container.getBoundingClientRect();
    const W = Math.max(1, r.width);
    const H = Math.max(1, r.height);
    const s = Math.min(W / VIEW_W, H / VIEW_H);
    const cssW = Math.floor(VIEW_W * s);
    const cssH = Math.floor(VIEW_H * s);
    this.frame.style.width = `${cssW}px`;
    this.frame.style.height = `${cssH}px`;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.renderer.resize(cssW, cssH, this.settings.quality === "high");
  };

  private onVisibility = () => {
    if (document.hidden) {
      this.pause();
      this.audio.suspend();
    } else {
      this.audio.resume();
      this.loop.resetClock();
    }
  };

  private onBlur = () => {
    this.pause();
  };

  get screen() {
    return this.mode;
  }
}

export function requestFullscreen() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  const doc = document as Document & { webkitExitFullscreen?: () => void; webkitFullscreenElement?: Element };
  try {
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else doc.webkitExitFullscreen?.();
    } else if (el.requestFullscreen) void el.requestFullscreen();
    else el.webkitRequestFullscreen?.();
  } catch {
    /* not supported */
  }
}

export function fullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}
