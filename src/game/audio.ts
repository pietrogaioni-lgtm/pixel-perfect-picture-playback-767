/**
 * Web Audio only: procedural music per world and synthesized sound effects.
 * The AudioContext is created on the first user gesture (autoplay policies).
 */
import type { SfxName } from "./engine";
import { Rng } from "./rng";
import { WORLDS, type MusicDef } from "./worlds";

export type UiSfx = "click" | "buy" | "deny" | "reward" | "count";

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface Pattern {
  lead: number[]; // scale index or -1, 64 steps
  bass: number[]; // scale degree per bar
}

function buildPattern(m: MusicDef): Pattern {
  const r = new Rng(m.seed);
  const bar = () => {
    const out: number[] = [];
    let idx = r.int(3, 6);
    for (let s = 0; s < 16; s++) {
      const p = s % 4 === 0 ? 0.75 : s % 2 === 0 ? 0.45 : 0.15;
      if (r.chance(p)) {
        idx = Math.max(0, Math.min(m.scale.length * 2 - 1, idx + r.int(-2, 2)));
        out.push(idx);
      } else out.push(-1);
    }
    return out;
  };
  const a = bar();
  const b = bar();
  const a2 = a.slice(0, 12).concat(bar().slice(12));
  return { lead: [...a, ...a2, ...b, ...a], bass: m.progression };
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicOn = true;
  private sfxOn = true;
  private world = -1;
  private wantWorld = -1;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;
  private pattern: Pattern | null = null;
  private lastPlayed = new Map<string, number>();
  private userSuspended = false;
  private duck = 1;

  /** Call from a user gesture handler. Safe to call repeatedly. */
  unlock() {
    try {
      if (!this.ctx) {
        const Ctor: typeof AudioContext | undefined =
          typeof window !== "undefined"
            ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
            : undefined;
        if (!Ctor) return;
        const ctx = new Ctor();
        this.ctx = ctx;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        this.master = ctx.createGain();
        this.master.gain.value = 0.9;
        this.musicGain = ctx.createGain();
        this.musicGain.gain.value = this.musicOn ? 0.55 : 0;
        this.sfxGain = ctx.createGain();
        this.sfxGain.gain.value = this.sfxOn ? 0.8 : 0;
        this.musicGain.connect(this.master);
        this.sfxGain.connect(this.master);
        this.master.connect(comp);
        comp.connect(ctx.destination);
        const len = ctx.sampleRate;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        if (this.wantWorld >= 0) this.playMusic(this.wantWorld);
      }
      if (this.ctx.state === "suspended" && !this.userSuspended) void this.ctx.resume();
    } catch (e) {
      console.warn("audio unavailable", e);
    }
  }

  get ready() {
    return !!this.ctx;
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(on ? 0.55 * this.duck : 0, this.ctx.currentTime, 0.05);
  }
  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.sfxGain && this.ctx) this.sfxGain.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }
  /** Quieter music while paused / on result screens. */
  setDuck(d: number) {
    this.duck = d;
    if (this.musicGain && this.ctx && this.musicOn) this.musicGain.gain.setTargetAtTime(0.55 * d, this.ctx.currentTime, 0.2);
  }

  /** Tab hidden / shown. */
  suspend() {
    this.userSuspended = true;
    try {
      void this.ctx?.suspend();
    } catch {
      /* ignore */
    }
  }
  resume() {
    this.userSuspended = false;
    try {
      if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      /* ignore */
    }
  }

  playMusic(world: number) {
    this.wantWorld = world;
    if (!this.ctx) return;
    if (this.world === world && this.timer) return;
    this.stopMusic();
    const w = WORLDS[world];
    if (!w) return;
    this.world = world;
    this.pattern = buildPattern(w.music);
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.world = -1;
  }

  destroy() {
    this.stopMusic();
    try {
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
  }

  private schedule() {
    const ctx = this.ctx;
    const w = WORLDS[this.world];
    if (!ctx || !w || !this.pattern || ctx.state !== "running") return;
    const m = w.music;
    const stepDur = 60 / m.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const s = this.step % 64;
      const barIdx = Math.floor(s / 16);
      const inBar = s % 16;
      const swing = inBar % 4 === 2 ? m.swing * stepDur : 0;
      const t = this.nextTime + swing;
      const deg = this.pattern.bass[barIdx % this.pattern.bass.length] ?? 0;
      const rootOf = (d: number, oct: number) => {
        const n = m.scale.length;
        const sc = m.scale[((d % n) + n) % n] ?? 0;
        return m.root + sc + 12 * (Math.floor(d / n) + oct);
      };
      // Bass
      if (inBar === 0 || inBar === 8 || inBar === 11) this.tone(m.bass, midiHz(rootOf(deg, -2)), t, stepDur * 2.5, 0.16, this.musicGain);
      // Pad chord on the bar
      if (inBar === 0) {
        for (const k of [0, 2, 4]) this.tone("triangle", midiHz(rootOf(deg + k, -1)), t, stepDur * 15, 0.035, this.musicGain, 0.25);
      }
      // Lead
      const li = this.pattern.lead[s] ?? -1;
      if (li >= 0) {
        const vol = m.lead === "square" || m.lead === "sawtooth" ? 0.045 : 0.085;
        this.tone(m.lead, midiHz(rootOf(li + deg, 0)), t, stepDur * 1.6, vol, this.musicGain);
      }
      // Drums
      if (inBar === 0 || inBar === 8) this.kick(t);
      if (inBar === 4 || inBar === 12) this.noiseHit(t, 0.12, 1800, "bandpass", 0.09, this.musicGain);
      if (inBar % 2 === 0) this.noiseHit(t, 0.03, 7000, "highpass", 0.035, this.musicGain);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private tone(
    type: OscillatorType,
    freq: number,
    t: number,
    dur: number,
    vol: number,
    out: GainNode | null,
    attack = 0.006,
    endFreq?: number,
  ) {
    const ctx = this.ctx;
    if (!ctx || !out) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noiseHit(t: number, dur: number, freq: number, type: BiquadFilterType, vol: number, out: GainNode | null, endFreq?: number) {
    const ctx = this.ctx;
    if (!ctx || !out || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (endFreq !== undefined) f.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private kick(t: number) {
    this.tone("sine", 150, t, 0.16, 0.35, this.musicGain, 0.002, 42);
  }

  private throttle(name: string, gap: number): boolean {
    const ctx = this.ctx;
    if (!ctx) return false;
    const last = this.lastPlayed.get(name) ?? -1;
    if (ctx.currentTime - last < gap) return false;
    this.lastPlayed.set(name, ctx.currentTime);
    return true;
  }

  sfx(name: SfxName | UiSfx, pitch = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn || ctx.state !== "running") return;
    if (!this.throttle(name, name === "fish" ? 0.03 : 0.05)) return;
    const t = ctx.currentTime + 0.005;
    const out = this.sfxGain;
    const p = pitch;
    switch (name) {
      case "jump":
        this.tone("square", 330 * p, t, 0.14, 0.09, out, 0.004, 720 * p);
        break;
      case "double":
        this.tone("triangle", 660 * p, t, 0.08, 0.16, out);
        this.tone("triangle", 990 * p, t + 0.06, 0.12, 0.14, out);
        break;
      case "land":
        this.noiseHit(t, 0.08, 500 * p, "lowpass", 0.25, out);
        this.tone("sine", 130, t, 0.09, 0.2, out, 0.002, 60);
        break;
      case "fish":
        this.tone("sine", 1250 * p, t, 0.09, 0.14, out, 0.003, 1900 * p);
        this.tone("triangle", 2500 * p, t + 0.02, 0.06, 0.05, out);
        break;
      case "gold":
        [0, 4, 7, 12].forEach((s, i) => this.tone("triangle", midiHz(79 + s), t + i * 0.045, 0.12, 0.13, out));
        break;
      case "star":
        [0, 4, 7, 11, 14, 19].forEach((s, i) => this.tone("sine", midiHz(84 + s), t + i * 0.06, 0.25, 0.12, out));
        break;
      case "power":
        [0, 5, 9, 12, 17].forEach((s, i) => this.tone("sawtooth", midiHz(64 + s), t + i * 0.05, 0.12, 0.05, out));
        this.tone("sine", 400, t, 0.4, 0.12, out, 0.01, 1200);
        break;
      case "whoosh":
        this.noiseHit(t, 0.45, 400, "bandpass", 0.35, out, 3200);
        this.tone("sawtooth", 200, t, 0.35, 0.04, out, 0.01, 900);
        break;
      case "hit":
        this.tone("sawtooth", 320 * p, t, 0.32, 0.16, out, 0.004, 70);
        this.noiseHit(t, 0.2, 900, "lowpass", 0.25, out);
        break;
      case "shield":
        this.tone("triangle", 1000, t, 0.3, 0.14, out, 0.004, 300);
        this.noiseHit(t, 0.2, 3000, "highpass", 0.1, out);
        break;
      case "slide":
        this.noiseHit(t, 0.28, 2500, "bandpass", 0.16, out, 700);
        break;
      case "wallrun":
        for (let i = 0; i < 4; i++) this.tone("square", 420 + i * 90, t + i * 0.05, 0.04, 0.05, out);
        break;
      case "bounce":
        this.tone("sine", 180, t, 0.35, 0.25, out, 0.004, 720);
        this.tone("triangle", 360, t + 0.02, 0.25, 0.08, out, 0.004, 1100);
        break;
      case "splash":
        this.noiseHit(t, 0.28, 1200, "bandpass", 0.25, out, 400);
        break;
      case "smash":
        this.noiseHit(t, 0.25, 1400 * p, "lowpass", 0.3, out, 200);
        this.tone("square", 160 * p, t, 0.15, 0.08, out, 0.002, 50);
        break;
      case "combo":
        this.tone("triangle", 880 * p, t, 0.08, 0.12, out);
        this.tone("triangle", 1320 * p, t + 0.05, 0.1, 0.1, out);
        break;
      case "complete":
        [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => {
          this.tone("triangle", midiHz(72 + s), t + i * 0.11, 0.3, 0.14, out);
          this.tone("square", midiHz(60 + s), t + i * 0.11, 0.2, 0.03, out);
        });
        break;
      case "crumble":
        this.noiseHit(t, 0.45, 380, "lowpass", 0.3, out, 120);
        break;
      case "thunder":
        this.noiseHit(t, 1.8, 260, "lowpass", 0.35, out, 60);
        break;
      case "click":
        this.tone("sine", 900, t, 0.05, 0.12, out, 0.002, 1300);
        break;
      case "count":
        this.tone("triangle", 660 * p, t, 0.16, 0.14, out);
        break;
      case "buy":
        [0, 7, 12, 16].forEach((s, i) => this.tone("triangle", midiHz(76 + s), t + i * 0.06, 0.15, 0.13, out));
        break;
      case "deny":
        this.tone("square", 180, t, 0.12, 0.08, out);
        this.tone("square", 140, t + 0.12, 0.16, 0.08, out);
        break;
      case "reward":
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone("sine", midiHz(72 + s), t + i * 0.05, 0.2, 0.12, out));
        break;
    }
  }
}
