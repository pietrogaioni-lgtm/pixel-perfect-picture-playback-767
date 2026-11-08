import { VIEW_H, VIEW_W } from "../constants";
import type { Run } from "../engine";
import { hash01 } from "../rng";
import type { Collectible, Obstacle, Platform } from "../types";
import type { WorldDef } from "../worlds";
import { drawFish, starPath } from "./cat";

const patternCache = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern>>();

function windowPattern(ctx: CanvasRenderingContext2D, w: WorldDef, style: number): CanvasPattern | null {
  let m = patternCache.get(ctx);
  if (!m) {
    m = new Map();
    patternCache.set(ctx, m);
  }
  const key = `${w.id}:${style}`;
  const hit = m.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 140;
  const g = c.getContext("2d");
  if (!g) return null;
  for (let i = 0; i < 4; i++) {
    const x = (i % 2) * 64 + 18;
    const y = Math.floor(i / 2) * 70 + 16;
    const lit = hash01(i * 3 + style * 7 + w.id) > (w.weather === "neon" || w.weather === "snow" ? 0.35 : 0.6);
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.fillRect(x - 3, y - 3, 30, 40);
    g.fillStyle = lit ? w.windowOn : w.windowOff;
    if (w.weather === "sand") {
      g.beginPath();
      g.roundRect(x, y, 24, 34, [12, 12, 0, 0]);
      g.fill();
    } else g.fillRect(x, y, 24, 34);
    g.fillStyle = w.trim;
    g.globalAlpha = 0.85;
    if (w.weather !== "sand" && w.weather !== "neon") {
      g.fillRect(x + 11, y, 2, 34);
      g.fillRect(x, y + 16, 24, 2);
      g.fillRect(x - 4, y + 34, 32, 4);
    }
    g.globalAlpha = 1;
    if (lit) {
      g.fillStyle = "rgba(255,255,255,0.25)";
      g.fillRect(x + 2, y + 2, 8, 12);
    }
  }
  const p = ctx.createPattern(c, "repeat");
  if (p) m.set(key, p);
  return p;
}

export function drawPlatforms(ctx: CanvasRenderingContext2D, run: Run, camX: number, camY: number, alpha: number, high: boolean) {
  const w = run.world;
  const L = run.layout.platforms;
  const right = camX + VIEW_W + 40;
  const bottom = camY + VIEW_H + 40;
  const t = run.time;
  for (let i = run.windows.plat; i < L.length; i++) {
    const p = L[i] as Platform;
    if (p.x > right) break;
    if (p.dead || p.x + p.w < camX - 40) continue;
    const y = p.prevY + (p.y - p.prevY) * alpha;
    if (p.kind === "building") drawBuilding(ctx, p, y, bottom, w, t, high);
    else if (p.kind === "float") drawIsland(ctx, p, y, w, t);
    else drawPlank(ctx, p, y, w, t, high);
  }
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Platform, top: number, bottom: number, w: WorldDef, t: number, high: boolean) {
  const x = b.x;
  const h = Math.max(0, bottom - top);
  const body = w.bodies[b.style % w.bodies.length] ?? w.bodyDark;
  ctx.fillStyle = body;
  ctx.fillRect(x, top, b.w, h);
  // windows
  const pat = windowPattern(ctx, w, b.style);
  if (pat && b.w > 60) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 14, top + 40, b.w - 28, h);
    ctx.clip();
    ctx.translate(x + ((b.w - 28) % 64) / 2, top + 24);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, b.w, h);
    ctx.restore();
  }
  // edge shading for depth
  const gl = ctx.createLinearGradient(x, 0, x + 26, 0);
  gl.addColorStop(0, "rgba(255,255,255,0.18)");
  gl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(x, top, 26, h);
  const gr = ctx.createLinearGradient(x + b.w - 34, 0, x + b.w, 0);
  gr.addColorStop(0, "rgba(0,0,0,0)");
  gr.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = gr;
  ctx.fillRect(x + b.w - 34, top, 34, h);
  // ground-level darkening
  const gd = ctx.createLinearGradient(0, top + 120, 0, top + 520);
  gd.addColorStop(0, "rgba(0,0,0,0)");
  gd.addColorStop(1, "rgba(10,10,30,0.35)");
  ctx.fillStyle = gd;
  ctx.fillRect(x, top + 120, b.w, Math.max(0, h - 120));

  // wall-run wall marking
  if (b.wall) {
    ctx.fillStyle = w.accent;
    ctx.globalAlpha = 0.85;
    for (let yy = top + 40; yy < top + 300; yy += 40) {
      ctx.beginPath();
      ctx.moveTo(x + 8, yy + 14);
      ctx.lineTo(x + 18, yy);
      ctx.lineTo(x + 28, yy + 14);
      ctx.lineTo(x + 22, yy + 14);
      ctx.lineTo(x + 18, yy + 8);
      ctx.lineTo(x + 14, yy + 14);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Roof surface (2.5D band) + parapet
  ctx.fillStyle = w.roof;
  ctx.fillRect(x - 4, top - 8, b.w + 8, 14);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(x - 4, top - 8, b.w + 8, 3);
  ctx.fillStyle = w.trim;
  ctx.fillRect(x - 6, top + 6, b.w + 12, 6);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(x - 6, top + 12, b.w + 12, 4);

  switch (w.weather) {
    case "snow": {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(x - 8, top + 2);
      for (let k = 0; k <= b.w + 16; k += 22) ctx.quadraticCurveTo(x - 8 + k + 11, top - 16, x - 8 + k + 22, top - 6);
      ctx.lineTo(x + b.w + 8, top + 4);
      ctx.closePath();
      ctx.fill();
      for (let k = 10; k < b.w; k += 46) {
        const len = 6 + hash01(k + b.id) * 14;
        ctx.fillStyle = "rgba(220,240,255,0.9)";
        ctx.beginPath();
        ctx.moveTo(x + k, top + 14);
        ctx.lineTo(x + k + 3, top + 14 + len);
        ctx.lineTo(x + k + 6, top + 14);
        ctx.fill();
      }
      break;
    }
    case "neon": {
      ctx.save();
      if (high) {
        ctx.shadowColor = w.trim;
        ctx.shadowBlur = 14;
      }
      ctx.fillStyle = b.style % 2 ? w.accent : w.trim;
      ctx.fillRect(x - 4, top + 6, b.w + 8, 3);
      ctx.restore();
      break;
    }
    case "rain": {
      const sheen = ctx.createLinearGradient(x, 0, x + b.w, 0);
      const ph = ((t * 0.2 + b.id * 0.13) % 1) * 0.8;
      sheen.addColorStop(0, "rgba(255,255,255,0)");
      sheen.addColorStop(Math.min(0.99, ph + 0.1), "rgba(255,255,255,0.35)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(x - 4, top - 8, b.w + 8, 4);
      break;
    }
    case "sand": {
      ctx.fillStyle = w.trim;
      for (let k = 0; k < b.w; k += 28) ctx.fillRect(x + k, top - 14, 14, 8);
      if (b.style % 2 === 0 && b.w > 220) {
        ctx.fillStyle = w.accent;
        ctx.fillRect(x + 40, top + 18, 50, 70);
        ctx.fillStyle = w.accent2;
        for (let k = 0; k < 5; k++) ctx.fillRect(x + 40, top + 26 + k * 12, 50, 3);
      }
      break;
    }
    case "sky": {
      ctx.fillStyle = w.accent;
      ctx.fillRect(x - 6, top + 6, b.w + 12, 3);
      // cloud skirt
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      for (let k = 0; k < b.w + 40; k += 50) {
        ctx.beginPath();
        ctx.arc(x - 20 + k, top + 330 + Math.sin(t + k) * 4, 46, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "sun": {
      if (b.style === 1 && b.w > 260) {
        // rooftop garden
        ctx.fillStyle = "#4caf6a";
        for (let k = 30; k < 120; k += 22) {
          ctx.beginPath();
          ctx.arc(x + b.w - k - 30, top - 10, 10, Math.PI, 0);
          ctx.fill();
        }
      }
      break;
    }
  }
}

function drawIsland(ctx: CanvasRenderingContext2D, p: Platform, top: number, w: WorldDef, t: number) {
  const x = p.x;
  ctx.fillStyle = w.bodyDark;
  ctx.beginPath();
  ctx.moveTo(x - 4, top + 6);
  ctx.lineTo(x + p.w + 4, top + 6);
  ctx.lineTo(x + p.w - 24, top + p.h * 0.7);
  ctx.lineTo(x + p.w * 0.55, top + p.h + 30);
  ctx.lineTo(x + p.w * 0.35, top + p.h + 10);
  ctx.lineTo(x + 20, top + p.h * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = w.bodies[p.style % w.bodies.length] ?? w.roof;
  ctx.beginPath();
  ctx.roundRect(x - 4, top - 6, p.w + 8, 26, 10);
  ctx.fill();
  ctx.fillStyle = w.accent;
  ctx.fillRect(x + 6, top + 14, p.w - 12, 3);
  ctx.fillStyle = "rgba(106,209,255,0.8)";
  ctx.beginPath();
  ctx.moveTo(x + p.w * 0.5, top + p.h + 20 + Math.sin(t * 2 + p.id) * 4);
  ctx.lineTo(x + p.w * 0.5 - 8, top + p.h - 6);
  ctx.lineTo(x + p.w * 0.5 + 8, top + p.h - 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let k = 0; k < p.w; k += 60) {
    ctx.beginPath();
    ctx.arc(x + k + 20, top + p.h * 0.55 + Math.sin(t * 1.5 + k) * 3, 22, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlank(ctx: CanvasRenderingContext2D, p: Platform, top: number, w: WorldDef, t: number, high: boolean) {
  const x = p.x;
  switch (p.kind) {
    case "crumble": {
      const shake = p.crumbleState === 1 ? Math.sin(t * 70) * 2 : 0;
      const n = Math.max(2, Math.floor(p.w / 40));
      const tw = p.w / n;
      for (let k = 0; k < n; k++) {
        const drop = p.crumbleState === 2 ? k * 6 : 0;
        ctx.fillStyle = k % 2 ? w.roof : w.bodyDark;
        ctx.fillRect(x + k * tw + shake, top - 6 + drop, tw - 2, p.h);
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + k * tw + 6 + shake, top - 4 + drop);
        ctx.lineTo(x + k * tw + tw / 2 + shake, top + 8 + drop);
        ctx.lineTo(x + k * tw + tw - 8 + shake, top + 2 + drop);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(x + shake, top - 6, p.w, 3);
      break;
    }
    case "moving": {
      ctx.strokeStyle = "rgba(200,200,220,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 20, top - 6);
      ctx.lineTo(x + 20, top - 800);
      ctx.moveTo(x + p.w - 20, top - 6);
      ctx.lineTo(x + p.w - 20, top - 800);
      ctx.stroke();
      ctx.fillStyle = "#3b3f5c";
      ctx.beginPath();
      ctx.roundRect(x, top - 6, p.w, p.h, 6);
      ctx.fill();
      ctx.save();
      if (high) {
        ctx.shadowColor = w.accent2;
        ctx.shadowBlur = 12;
      }
      ctx.fillStyle = w.accent2;
      ctx.fillRect(x + 6, top - 6, p.w - 12, 3);
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = Math.sin(t * 6 + k) > 0 ? w.accent : w.accent2;
        ctx.fillRect(x + 20 + k * ((p.w - 40) / 3) - 3, top + 6, 6, 4);
      }
      ctx.restore();
      break;
    }
    case "bridge": {
      ctx.strokeStyle = "#7a5230";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, top - 34);
      ctx.quadraticCurveTo(x + p.w / 2, top - 6, x + p.w, top - 34);
      ctx.stroke();
      const n = Math.floor(p.w / 22);
      for (let k = 0; k <= n; k++) {
        const px = x + (k / n) * p.w;
        const sag = Math.sin((k / n) * Math.PI) * 8;
        ctx.fillStyle = k % 2 ? "#b07a4a" : "#9a6638";
        ctx.fillRect(px - 9, top - 4 + sag, 18, 10);
        ctx.strokeStyle = "rgba(122,82,48,0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, top - 4 + sag);
        ctx.lineTo(px, top - 30 + sag * 2);
        ctx.stroke();
      }
      break;
    }
    case "awning": {
      ctx.fillStyle = "#6b4a2e";
      ctx.fillRect(x + 6, top, 6, 200);
      ctx.fillRect(x + p.w - 12, top, 6, 200);
      const squash = Math.max(0, Math.sin(t * 3)) * 0;
      const n = 6;
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = k % 2 ? "#fff2d6" : w.accent;
        ctx.beginPath();
        const x0 = x + (k / n) * p.w;
        const x1 = x + ((k + 1) / n) * p.w;
        ctx.moveTo(x0, top - 6 + squash);
        ctx.quadraticCurveTo((x0 + x1) / 2, top - 22, x1, top - 6 + squash);
        ctx.lineTo(x1, top + 14);
        ctx.quadraticCurveTo((x0 + x1) / 2, top + 22, x0, top + 14);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    default: {
      ctx.fillStyle = "#9a6638";
      ctx.fillRect(x, top - 6, p.w, p.h);
    }
  }
}

const SIGN_WORDS = ["FISH", "MEOW", "CAFE", "NAPS", "YARN", "MILK", "PURR"];

export function drawObstacles(ctx: CanvasRenderingContext2D, run: Run, camX: number, alpha: number, high: boolean) {
  const w = run.world;
  const L = run.layout.obstacles;
  const right = camX + VIEW_W + 220;
  const t = run.time;
  for (let i = run.windows.obs; i < L.length; i++) {
    const o = L[i] as Obstacle;
    if (o.baseX > right + 400) break;
    if (o.dead) continue;
    const x = o.prevX + (o.x - o.prevX) * alpha;
    const y = o.prevY + (o.y - o.prevY) * alpha;
    if (x > right || x + o.w < camX - 220) continue;
    drawObstacle(ctx, o, x, y, w, t, high);
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, x: number, y: number, w: WorldDef, t: number, high: boolean) {
  const h = o.h;
  switch (o.kind) {
    case "chimney": {
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(x + o.w / 2 + 8, y + h, o.w * 0.7, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = w.weather === "snow" ? "#9c5a48" : w.weather === "sky" ? "#c9c3dc" : "#b8573f";
      ctx.fillRect(x, y + 8, o.w, h - 8);
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1;
      for (let yy = y + 18; yy < y + h; yy += 10) {
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x + o.w, yy);
        ctx.stroke();
      }
      ctx.fillStyle = "#6e3a2c";
      ctx.fillRect(x - 5, y, o.w + 10, 10);
      if (w.weather === "snow") {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.roundRect(x - 6, y - 6, o.w + 12, 9, 4);
        ctx.fill();
      }
      // steam
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.6 + k / 3 + o.id * 0.1) % 1;
        ctx.fillStyle = `rgba(255,255,255,${0.4 * (1 - ph)})`;
        ctx.beginPath();
        ctx.arc(x + o.w / 2 - ph * 30, y - 8 - ph * 70, 8 + ph * 16, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "ac": {
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(x + o.w / 2 + 8, y + h, o.w * 0.65, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c7d3dc";
      ctx.beginPath();
      ctx.roundRect(x, y, o.w, h, 6);
      ctx.fill();
      ctx.fillStyle = "#9fb0bc";
      ctx.fillRect(x + 6, y + 6, o.w * 0.45, h - 12);
      ctx.strokeStyle = "#7f909c";
      ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 10 + k * 7);
        ctx.lineTo(x + o.w * 0.45 + 4, y + 10 + k * 7);
        ctx.stroke();
      }
      const cx = x + o.w * 0.75;
      const cy = y + h / 2;
      ctx.fillStyle = "#5c6b78";
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c7d3dc";
      ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        const a = t * 14 + (k * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13);
        ctx.stroke();
      }
      break;
    }
    case "crate": {
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(x + o.w / 2 + 8, y + h, o.w * 0.65, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      const boxes: [number, number][] =
        o.state === 2 ? [[x, y], [x, y + 50]] : o.state === 1 ? [[x, y], [x + 54, y]] : [[x, y]];
      for (const [bx, by] of boxes) {
        ctx.fillStyle = "#c98b4b";
        ctx.fillRect(bx, by, 50, 50);
        ctx.strokeStyle = "#8a5a2b";
        ctx.lineWidth = 4;
        ctx.strokeRect(bx + 2, by + 2, 46, 46);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx + 4, by + 4);
        ctx.lineTo(bx + 46, by + 46);
        ctx.moveTo(bx + 46, by + 4);
        ctx.lineTo(bx + 4, by + 46);
        ctx.stroke();
        if (w.weather === "snow") {
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.roundRect(bx - 2, by - 5, 54, 8, 4);
          ctx.fill();
        }
      }
      break;
    }
    case "antenna": {
      ctx.strokeStyle = "#5a6070";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + 7, y + h);
      ctx.lineTo(x + 7, y);
      ctx.stroke();
      ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        const yy = y + 12 + k * 18;
        const ww = 26 - k * 6;
        ctx.beginPath();
        ctx.moveTo(x + 7 - ww, yy);
        ctx.lineTo(x + 7 + ww, yy);
        ctx.stroke();
      }
      const on = Math.sin(t * 5 + o.id) > 0;
      ctx.save();
      if (high && on) {
        ctx.shadowColor = "#ff4d4d";
        ctx.shadowBlur = 16;
      }
      ctx.fillStyle = on ? "#ff4d4d" : "#7a2a2a";
      ctx.beginPath();
      ctx.arc(x + 7, y - 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "laundry": {
      ctx.strokeStyle = "#6b5040";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x - 10, y + h + 30);
      ctx.lineTo(x - 10, y - 14);
      ctx.moveTo(x + o.w + 10, y + h + 30);
      ctx.lineTo(x + o.w + 10, y - 14);
      ctx.stroke();
      ctx.strokeStyle = "#f2eadf";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 8);
      ctx.quadraticCurveTo(x + o.w / 2, y + 4, x + o.w + 10, y - 8);
      ctx.stroke();
      const colors = [w.accent, w.accent2, "#ffd166", "#ffffff", "#ff8fab"];
      for (let k = 0; k < 5; k++) {
        const cx = x + 14 + k * ((o.w - 28) / 4);
        const sway = Math.sin(t * 3 + k) * 3;
        ctx.save();
        ctx.translate(cx, y - 2 + Math.sin((k / 4) * Math.PI) * 6);
        ctx.rotate(sway * 0.03);
        ctx.fillStyle = colors[k % colors.length] as string;
        if (k % 2 === 0) {
          ctx.beginPath();
          ctx.moveTo(-14, 0);
          ctx.lineTo(14, 0);
          ctx.lineTo(18, 10);
          ctx.lineTo(11, 12);
          ctx.lineTo(11, 40);
          ctx.lineTo(-11, 40);
          ctx.lineTo(-11, 12);
          ctx.lineTo(-18, 10);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(-6, 0, 10, 30);
          ctx.fillRect(-6, 24, 18, 8);
        }
        ctx.restore();
      }
      break;
    }
    case "sign": {
      ctx.strokeStyle = "#5a5a66";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 12, y);
      ctx.lineTo(x + 12, y - 600);
      ctx.moveTo(x + o.w - 12, y);
      ctx.lineTo(x + o.w - 12, y - 600);
      ctx.stroke();
      const swing = Math.sin(t * 2 + o.id) * 0.02;
      ctx.save();
      ctx.translate(x + o.w / 2, y);
      ctx.rotate(swing);
      ctx.fillStyle = w.weather === "neon" ? "#1b1640" : "#3b2a20";
      ctx.beginPath();
      ctx.roundRect(-o.w / 2, 0, o.w, h, 10);
      ctx.fill();
      const word = SIGN_WORDS[o.id % SIGN_WORDS.length] as string;
      ctx.font = "700 24px Fredoka, 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (w.weather === "neon") {
        if (high) {
          ctx.shadowColor = o.id % 2 ? w.accent : w.accent2;
          ctx.shadowBlur = 18;
        }
        ctx.strokeStyle = o.id % 2 ? w.accent : w.accent2;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-o.w / 2 + 5, 5, o.w - 10, h - 10, 8);
        ctx.stroke();
        ctx.fillStyle = Math.sin(t * 9 + o.id) > -0.9 ? (o.id % 2 ? w.accent : w.accent2) : "#555";
      } else {
        ctx.fillStyle = "#ffe6b0";
        ctx.fillRect(-o.w / 2 + 6, 6, o.w - 12, h - 12);
        ctx.fillStyle = "#3b2a20";
      }
      ctx.fillText(word, 0, h / 2 + 1);
      ctx.restore();
      break;
    }
    case "puddle": {
      ctx.fillStyle = "rgba(90,160,220,0.75)";
      ctx.beginPath();
      ctx.ellipse(x + o.w / 2, y + 4, o.w / 2, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      const r = ((t * 0.8 + o.id * 0.3) % 1) * o.w * 0.35;
      ctx.beginPath();
      ctx.ellipse(x + o.w * 0.4, y + 4, r, r * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "ice": {
      ctx.fillStyle = "rgba(190,235,255,0.75)";
      ctx.fillRect(x, y - 4, o.w, 10);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (let k = 10; k < o.w; k += 60) {
        const tw = Math.abs(Math.sin(t * 2 + k));
        ctx.fillRect(x + k, y - 3, 18 * tw + 4, 2);
      }
      break;
    }
    case "pigeon":
    case "seagull": {
      const gull = o.kind === "seagull";
      const flap = Math.sin(t * (gull ? 12 : 18) + o.id);
      const cx = x + o.w / 2;
      const cy = y + h / 2;
      ctx.fillStyle = gull ? "#ffffff" : "#8d93a8";
      ctx.beginPath();
      ctx.ellipse(cx, cy, o.w * 0.45, h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - o.w * 0.38, cy - h * 0.25, h * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = gull ? "#ffb23d" : "#e2a94a";
      ctx.beginPath();
      ctx.moveTo(cx - o.w * 0.6, cy - h * 0.25);
      ctx.lineTo(cx - o.w * 0.75, cy - h * 0.15);
      ctx.lineTo(cx - o.w * 0.58, cy - h * 0.1);
      ctx.fill();
      ctx.fillStyle = "#14101a";
      ctx.beginPath();
      ctx.arc(cx - o.w * 0.42, cy - h * 0.3, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = gull ? "#a9b6c2" : "#6b7088";
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 2);
      ctx.lineTo(cx + o.w * 0.2, cy - 2 - flap * (gull ? 18 : 10));
      ctx.lineTo(cx + o.w * 0.45, cy - flap * (gull ? 12 : 6));
      ctx.closePath();
      ctx.fill();
      if (!gull) {
        ctx.fillStyle = "rgba(120,200,160,0.7)";
        ctx.fillRect(cx - o.w * 0.3, cy - h * 0.05, 6, 3);
      }
      break;
    }
    case "icicle": {
      const beamY = o.baseY - 8;
      ctx.fillStyle = "#6b4a3a";
      ctx.fillRect(o.baseX - 34, beamY, 88, 10);
      ctx.fillRect(o.baseX + 50, beamY, 8, 260);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(o.baseX - 36, beamY - 6, 92, 8, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(200,240,255,0.95)";
      ctx.beginPath();
      if (o.state === 3) {
        ctx.moveTo(x, y + h);
        ctx.lineTo(x + o.w / 2, y);
        ctx.lineTo(x + o.w, y + h);
      } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x + o.w, y);
        ctx.lineTo(x + o.w / 2, y + h);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(x + 4, o.state === 3 ? y + h * 0.4 : y + 4, 3, h * 0.4);
      break;
    }
    case "gust": {
      ctx.strokeStyle = "rgba(255,230,180,0.35)";
      ctx.lineWidth = 3;
      for (let k = 0; k < 6; k++) {
        const ph = (t * 1.2 + k / 6) % 1;
        const cx = x + ph * o.w;
        const cy = y + o.h * (0.3 + 0.1 * k);
        ctx.beginPath();
        ctx.arc(cx, cy, 24 + k * 4, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      break;
    }
    case "wind": {
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let k = 0; k < 12; k++) {
        const ph = (t * 0.9 + hash01(k + o.id)) % 1;
        const cx = x + hash01(k * 3.1 + o.id) * o.w;
        const cy = y + o.h - ph * o.h;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.sin(t * 3 + k) * 4, cy - 34);
      }
      ctx.stroke();
      break;
    }
  }
}

const POWER_COLORS: Record<string, [string, string]> = {
  magnet: ["#ff5c5c", "#ffd1d1"],
  shield: ["#4cc9f0", "#d6f5ff"],
  speed: ["#ffb703", "#fff1c2"],
  super: ["#06d6a0", "#d1fff0"],
};

export function drawPowerIcon(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, r: number) {
  const [c1] = POWER_COLORS[kind] ?? ["#fff", "#fff"];
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = r * 0.22;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (kind === "magnet") {
    ctx.strokeStyle = c1;
    ctx.lineWidth = r * 0.32;
    ctx.beginPath();
    ctx.arc(0, -r * 0.05, r * 0.42, Math.PI, 0, true);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-r * 0.58, -r * 0.1, r * 0.32, r * 0.25);
    ctx.fillRect(r * 0.26, -r * 0.1, r * 0.32, r * 0.25);
  } else if (kind === "shield") {
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(r * 0.45, -r * 0.35);
    ctx.quadraticCurveTo(r * 0.4, r * 0.3, 0, r * 0.6);
    ctx.quadraticCurveTo(-r * 0.4, r * 0.3, -r * 0.45, -r * 0.35);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "speed") {
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.6);
    ctx.lineTo(-r * 0.35, r * 0.08);
    ctx.lineTo(0, r * 0.08);
    ctx.lineTo(-r * 0.1, r * 0.6);
    ctx.lineTo(r * 0.38, -r * 0.1);
    ctx.lineTo(r * 0.02, -r * 0.1);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.6);
    ctx.lineTo(r * 0.45, -r * 0.1);
    ctx.lineTo(-r * 0.45, -r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, r * 0.1);
    ctx.lineTo(r * 0.3, r * 0.2);
    ctx.lineTo(-r * 0.3, r * 0.35);
    ctx.lineTo(r * 0.3, r * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

export function powerColor(kind: string): string {
  return (POWER_COLORS[kind] ?? ["#ffffff"])[0] as string;
}

export function drawCollectibles(ctx: CanvasRenderingContext2D, run: Run, camX: number, high: boolean) {
  const L = run.layout.collectibles;
  const right = camX + VIEW_W + 40;
  const t = run.time;
  for (let i = run.windows.col; i < L.length; i++) {
    const c = L[i] as Collectible;
    if (c.x > right) break;
    if (c.taken || c.x < camX - 40) continue;
    drawCollectible(ctx, c, t, high);
  }
}

function drawCollectible(ctx: CanvasRenderingContext2D, c: Collectible, t: number, high: boolean) {
  if (c.kind === "fish" || c.kind === "gold") {
    const gold = c.kind === "gold";
    if (gold) {
      const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 26);
      g.addColorStop(0, "rgba(255,220,100,0.55)");
      g.addColorStop(1, "rgba(255,220,100,0)");
      ctx.fillStyle = g;
      ctx.fillRect(c.x - 26, c.y - 26, 52, 52);
    }
    drawFish(ctx, c.x, c.y, gold ? 1.15 : 1, gold, Math.sin(t * 6 + c.phase) * 0.15);
    return;
  }
  if (c.kind === "star") {
    const pulse = 1 + Math.sin(t * 5) * 0.08;
    const g = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, 60);
    g.addColorStop(0, "rgba(255,240,120,0.7)");
    g.addColorStop(1, "rgba(255,240,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(c.x - 60, c.y - 60, 120, 120);
    ctx.save();
    if (high) {
      ctx.shadowColor = "#ffe066";
      ctx.shadowBlur = 20;
    }
    ctx.fillStyle = "#ffe066";
    starPath(ctx, c.x, c.y, 22 * pulse, 0.45, t * 1.2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    return;
  }
  // power-up bubble
  const col = powerColor(c.kind);
  const r = 24 + Math.sin(t * 4 + c.phase) * 1.5;
  ctx.save();
  if (high) {
    ctx.shadowColor = col;
    ctx.shadowBlur = 18;
  }
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(c.x - 8, c.y - 10, 8, 5, -0.5, 0, Math.PI * 2);
  ctx.fill();
  drawPowerIcon(ctx, c.kind, c.x, c.y, r * 0.95);
}

export function drawFinish(ctx: CanvasRenderingContext2D, run: Run) {
  const x = run.layout.finishX;
  const p = run.layout.platforms.find((pl) => pl.x <= x && pl.x + pl.w >= x);
  const top = p ? p.y : run.layout.spawnY;
  ctx.fillStyle = "#3b3f5c";
  ctx.fillRect(x - 6, top - 220, 8, 220);
  ctx.fillRect(x + 260, top - 220, 8, 220);
  const sq = 16;
  for (let k = 0; k < 17; k++)
    for (let r = 0; r < 3; r++) {
      ctx.fillStyle = (k + r) % 2 ? "#1e1a22" : "#ffffff";
      ctx.fillRect(x + k * sq, top - 220 + r * sq + Math.sin(run.time * 3 + k * 0.5) * 3, sq, sq);
    }
  ctx.font = "700 26px Fredoka, 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd166";
  ctx.strokeStyle = "#1e1a22";
  ctx.lineWidth = 5;
  ctx.strokeText("FINISH", x + 134, top - 236);
  ctx.fillText("FINISH", x + 134, top - 236);
}

export function drawVacuum(ctx: CanvasRenderingContext2D, run: Run, alpha: number) {
  if (!run.vacuum.active) return;
  const v = run.vacuum;
  const x = v.prevX + (v.x - v.prevX) * alpha;
  const p = run.player;
  const t = run.time;
  const baseY = p.lastFeet - 10 + Math.sin(t * 3) * 6;
  ctx.save();
  // suction cone
  const g = ctx.createLinearGradient(x + 220, 0, x + 520, 0);
  g.addColorStop(0, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x + 230, baseY - 20);
  ctx.lineTo(x + 520, baseY - 160);
  ctx.lineTo(x + 520, baseY + 30);
  ctx.closePath();
  ctx.fill();
  // body
  ctx.fillStyle = "#e5e9f2";
  ctx.beginPath();
  ctx.roundRect(x, baseY - 150, 250, 130, 50);
  ctx.fill();
  ctx.fillStyle = "#d64045";
  ctx.beginPath();
  ctx.roundRect(x + 10, baseY - 150, 230, 40, [40, 40, 6, 6]);
  ctx.fill();
  ctx.fillStyle = "#3b3f5c";
  ctx.fillRect(x + 10, baseY - 34, 240, 18);
  // bristles
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 3;
  for (let k = 0; k < 10; k++) {
    const a = t * 20 + k;
    ctx.beginPath();
    ctx.moveTo(x + 30 + k * 22, baseY - 18);
    ctx.lineTo(x + 30 + k * 22 + Math.cos(a) * 8, baseY - 6);
    ctx.stroke();
  }
  // eyes
  for (const ex of [x + 170, x + 214]) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(ex, baseY - 82, 15, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e1a22";
    ctx.beginPath();
    ctx.arc(ex + 5, baseY - 80, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#1e1a22";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 152, baseY - 108);
  ctx.lineTo(x + 182, baseY - 100);
  ctx.moveTo(x + 232, baseY - 108);
  ctx.lineTo(x + 204, baseY - 100);
  ctx.stroke();
  ctx.fillStyle = Math.sin(t * 8) > 0 ? "#ff4d4d" : "#ffd166";
  ctx.beginPath();
  ctx.arc(x + 60, baseY - 160, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
