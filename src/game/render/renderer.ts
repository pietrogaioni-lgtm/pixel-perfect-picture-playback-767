import { VIEW_H, VIEW_W } from "../constants";
import type { Run } from "../engine";
import { Shape } from "../particles";
import { hash01 } from "../rng";
import { WORLDS, type WorldDef } from "../worlds";
import { drawBackground, drawWeatherFront } from "./background";
import { drawCat, starPath, type CatPose } from "./cat";
import { drawHud, FONT } from "./hud";
import { drawCollectibles, drawFinish, drawObstacles, drawPlatforms, drawVacuum } from "./world";

export interface Look {
  skin: string;
  hat: string | null;
  scarf: string | null;
  glasses: string | null;
}

export interface FrameOpts {
  look: Look;
  shake: boolean;
  high: boolean;
  touch: boolean;
  countdown: number;
  debug: string[] | null;
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private scale = 1;
  private vignettes = new Map<number, CanvasGradient>();
  private key = "0";

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;
  }

  /** cssW/cssH is the letterboxed 16:9 rectangle the canvas occupies. */
  resize(cssW: number, cssH: number, high: boolean) {
    const ratio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    this.dpr = high ? Math.min(ratio, 2) : 1;
    const w = Math.max(1, Math.round(cssW * this.dpr));
    const h = Math.max(1, Math.round(cssH * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.scale = cssW / VIEW_W;
    this.vignettes.clear();
    this.key = `${w}x${h}`;
  }

  private begin() {
    const k = this.dpr * this.scale;
    const ctx = this.ctx;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private vignette(w: WorldDef) {
    let g = this.vignettes.get(w.id);
    if (!g) {
      g = this.ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.72);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(10,6,30,${w.vignette})`);
      this.vignettes.set(w.id, g);
    }
    return g;
  }

  private post(w: WorldDef, flash: number) {
    const ctx = this.ctx;
    ctx.fillStyle = w.grade;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = this.vignette(w);
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (flash > 0) {
      ctx.fillStyle = `rgba(235,245,255,${flash * 0.55})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  drawRun(run: Run, alpha: number, o: FrameOpts) {
    const ctx = this.ctx;
    this.begin();
    const w = run.world;
    const c = run.cam;
    let camX = c.prevX + (c.x - c.prevX) * alpha;
    let camY = c.prevY + (c.y - c.prevY) * alpha;
    if (o.shake && c.trauma > 0) {
      const s = c.trauma * c.trauma * 16;
      camX += (Math.random() * 2 - 1) * s;
      camY += (Math.random() * 2 - 1) * s;
    }
    if (!Number.isFinite(camX) || !Number.isFinite(camY)) {
      camX = 0;
      camY = 0;
    }
    drawBackground(ctx, w, camX, camY, run.time, o.high, this.key);

    ctx.save();
    ctx.translate(-Math.round(camX * 10) / 10, -Math.round(camY * 10) / 10);
    drawObstaclesBehind(ctx, run, camX, alpha, o.high);
    drawPlatforms(ctx, run, camX, camY, alpha, o.high);
    drawFinish(ctx, run);
    drawObstacles(ctx, run, camX, alpha, o.high);
    drawCollectibles(ctx, run, camX, o.high);
    this.drawPlayer(run, alpha, o);
    drawVacuum(ctx, run, alpha);
    this.drawParticles(run);
    this.drawWorldTexts(run);
    ctx.restore();

    drawWeatherFront(ctx, w, camX, run.time, o.high);
    this.speedLines(run);
    this.post(w, run.flash);
    drawHud(ctx, run, { touch: o.touch, countdown: o.countdown, debug: o.debug });
  }

  private drawPlayer(run: Run, alpha: number, o: FrameOpts) {
    const ctx = this.ctx;
    const p = run.player;
    const x = p.prevX + (p.x - p.prevX) * alpha;
    const y = p.prevY + (p.y - p.prevY) * alpha;
    const cx = x + p.w / 2;
    const feet = y + p.h;
    let pose: CatPose = "run";
    if (run.state === "dying" || run.state === "dead") pose = "hurt";
    else if ((run.state === "complete" || run.state === "done") && p.vx < 80 && p.grounded) pose = "victory";
    else if (p.wallRun || (p.wallContact && !p.grounded)) pose = "wall";
    else if (p.ledgeTimer > 0) pose = "ledge";
    else if (p.sliding) pose = "slide";
    else if (p.doubleFlash > 0) pose = "double";
    else if (p.grounded) pose = "run";
    else pose = p.vy < 0 ? "jump" : "fall";

    // shadow
    if (p.grounded || run.state === "complete") {
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(cx, feet + 1, 26, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const base = {
      t: run.time,
      phase: p.anim,
      vy: p.vy,
      squashX: p.squashX,
      squashY: p.squashY,
      flip: 1 - p.doubleFlash / 0.35,
      skin: o.look.skin,
      hat: o.look.hat,
      scarf: o.look.scarf,
      glasses: o.look.glasses,
      speed: p.vx,
    };
    // motion trail
    for (let i = p.trail.length - 1; i >= 1; i--) {
      const tp = p.trail[i];
      if (!tp) continue;
      drawCat(ctx, {
        ...base,
        x: tp.x + p.w / 2,
        y: tp.y + p.h,
        pose,
        alpha: 0.28 * (1 - i / p.trail.length),
        silhouette: run.powers.speed > 0 ? "#ffd166" : run.world.accent2,
      });
    }
    const blink = p.invuln > 0 && run.state === "playing" && p.invuln < 50 && Math.sin(run.time * 40) > 0;
    drawCat(ctx, { ...base, x: cx, y: feet, pose, alpha: blink ? 0.45 : 1 });

    // power-up auras
    if (run.powers.shield > 0) {
      const fl = run.powers.shield < 2 && Math.sin(run.time * 20) > 0 ? 0.3 : 1;
      ctx.save();
      ctx.globalAlpha = 0.85 * fl;
      ctx.strokeStyle = "#7fe3ff";
      ctx.lineWidth = 3;
      ctx.fillStyle = "rgba(127,227,255,0.15)";
      ctx.beginPath();
      ctx.arc(cx, feet - 24, 40 + Math.sin(run.time * 6) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (run.powers.magnet > 0) {
      ctx.strokeStyle = `rgba(255,92,92,${0.25 + 0.15 * Math.sin(run.time * 8)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 10]);
      ctx.beginPath();
      ctx.arc(cx, feet - 24, 70 + ((run.time * 60) % 30), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (run.powers.super > 0 && !p.grounded) {
      ctx.fillStyle = "rgba(6,214,160,0.5)";
      ctx.beginPath();
      ctx.ellipse(cx, feet + 6, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (run.powers.speed > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(cx + 10, feet - 22, 4, cx + 10, feet - 22, 60);
      g.addColorStop(0, "rgba(255,190,60,0.5)");
      g.addColorStop(1, "rgba(255,190,60,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - 50, feet - 82, 120, 120);
      ctx.restore();
    }
  }

  private drawParticles(run: Run) {
    const ctx = this.ctx;
    for (const p of run.particles.items) {
      if (!p.active) continue;
      const a = Math.max(0, (p.life / p.max) * p.alpha);
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = p.additive ? "lighter" : "source-over";
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      switch (p.shape) {
        case Shape.Circle:
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case Shape.Rect:
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
          break;
        case Shape.Star:
          starPath(ctx, p.x, p.y, p.size, 0.45, p.rot);
          ctx.fill();
          break;
        case Shape.Ring:
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case Shape.Line:
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
          ctx.stroke();
          break;
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private drawWorldTexts(run: Run) {
    const ctx = this.ctx;
    for (const t of run.texts.items) {
      if (!t.active || t.screen) continue;
      ctx.globalAlpha = Math.min(1, t.life / 0.3);
      ctx.font = `700 ${t.size}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(24,18,44,0.85)";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  private speedLines(run: Run) {
    const p = run.player;
    const k = run.powers.speed > 0 ? 1 : Math.max(0, (p.vx - run.def.speed * 1.15) / (run.def.speed * 0.4));
    if (k <= 0) return;
    const ctx = this.ctx;
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * Math.min(1, k)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const y = hash01(i * 3.3) * VIEW_H;
      const x = VIEW_W - (((run.time * 2400 + hash01(i * 7.7) * VIEW_W * 2) % (VIEW_W * 1.6)) | 0);
      ctx.moveTo(x, y);
      ctx.lineTo(x + 80 + hash01(i) * 80, y);
    }
    ctx.stroke();
  }

  /** Menu background: endless rooftop run with the chosen cat. */
  drawAttract(t: number, worldId: number, look: Look, high: boolean) {
    const ctx = this.ctx;
    this.begin();
    const w = WORLDS[worldId] ?? (WORLDS[0] as WorldDef);
    const camX = t * 260;
    drawBackground(ctx, w, camX, 45, t, high, this.key);
    const top = 560;
    // simple rooftops
    const seg = 520;
    const start = Math.floor(camX / seg) - 1;
    for (let i = start; i < start + 5; i++) {
      const x = i * seg - camX;
      const body = w.bodies[((i % 4) + 4) % 4] ?? w.bodyDark;
      ctx.fillStyle = body;
      ctx.fillRect(x, top, seg - 30, VIEW_H - top);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      for (let k = 30; k < seg - 60; k += 64) ctx.fillRect(x + k, top + 46, 26, 34);
      ctx.fillStyle = w.roof;
      ctx.fillRect(x - 4, top - 8, seg - 22, 14);
      ctx.fillStyle = w.trim;
      ctx.fillRect(x - 6, top + 6, seg - 18, 6);
    }
    // the cat hops across the seams
    const local = (camX + 360) % seg;
    const air = local > seg - 110 || local < 50;
    let hop = 0;
    if (air) {
      const u = local > seg - 110 ? (local - (seg - 110)) / 160 : (local + 110) / 160;
      hop = Math.sin(Math.min(1, u) * Math.PI) * 70;
    }
    drawCat(ctx, {
      x: 380,
      y: top - hop,
      pose: air ? (hop > 0 && local > seg - 110 ? "jump" : "fall") : "run",
      t,
      phase: t * 2.6,
      vy: air ? (local > seg - 110 ? -300 : 300) : 0,
      squashX: 1,
      squashY: 1,
      flip: 0,
      skin: look.skin,
      hat: look.hat,
      scarf: look.scarf,
      glasses: look.glasses,
      scale: 1.6,
      speed: 400,
    });
    drawWeatherFront(ctx, w, camX, t, high);
    this.post(w, 0);
    ctx.fillStyle = "rgba(20,14,40,0.25)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

/** Laundry poles and sign chains sit behind the buildings' parapets — nothing extra for now. */
function drawObstaclesBehind(_ctx: CanvasRenderingContext2D, _run: Run, _camX: number, _alpha: number, _high: boolean) {}
