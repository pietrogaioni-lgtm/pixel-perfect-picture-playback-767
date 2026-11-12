import { VIEW_H, VIEW_W } from "../constants";
import { hash01 } from "../rng";
import { WORLDS, type WorldDef } from "../worlds";

const LW = 2048;
const LH = 520;

interface Layers {
  far: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  near: HTMLCanvasElement;
}

const cache = new Map<string, Layers>();

/** Pixel density the cached layers/clouds are painted at (set from the renderer's output scale). */
let RES = 1;
export function setBackgroundResolution(r: number) {
  const next = Math.max(1, Math.min(2, Math.round(r * 4) / 4));
  if (next !== RES) {
    RES = next;
    cache.clear();
    cloudCache.clear();
  }
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w * RES);
  c.height = Math.ceil(h * RES);
  return c;
}

/** Atmospheric perspective: lighten silhouettes toward the horizon and add a sun-side rim. */
function shadeLayer(ctx: CanvasRenderingContext2D, top: string, bottom: string) {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const g = ctx.createLinearGradient(0, 0, 0, LH);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LW, LH);
  ctx.restore();
}

/** Draw `fn` at x, and wrapped copies so the layer tiles seamlessly. */
function wrap(fn: (ox: number) => void) {
  fn(0);
  fn(-LW);
  fn(LW);
}

function drawFar(ctx: CanvasRenderingContext2D, w: WorldDef) {
  ctx.fillStyle = w.far;
  const base = LH;
  const H = (i: number, a: number, b: number) => a + hash01(i * 13.7 + w.id * 101) * (b - a);
  switch (w.weather) {
    case "sun": {
      ctx.beginPath();
      ctx.moveTo(0, base);
      for (let x = 0; x <= LW; x += 16) ctx.lineTo(x, base - 150 - Math.sin((x / LW) * Math.PI * 6) * 40 - Math.sin((x / LW) * Math.PI * 14) * 14);
      ctx.lineTo(LW, base);
      ctx.fill();
      for (let i = 0; i < 26; i++) {
        const x = (i / 26) * LW;
        const hh = H(i, 30, 60);
        wrap((ox) => {
          ctx.fillRect(ox + x, base - 160 - hh, 40, hh + 40);
          ctx.beginPath();
          ctx.moveTo(ox + x - 6, base - 160 - hh);
          ctx.lineTo(ox + x + 20, base - 185 - hh);
          ctx.lineTo(ox + x + 46, base - 160 - hh);
          ctx.fill();
        });
      }
      break;
    }
    case "neon": {
      for (let i = 0; i < 34; i++) {
        const x = (i / 34) * LW + H(i, -10, 10);
        const bw = H(i + 3, 40, 90);
        const bh = H(i + 7, 160, 420);
        wrap((ox) => {
          ctx.fillStyle = w.far;
          ctx.fillRect(ox + x, base - bh, bw, bh);
          if (H(i + 9, 0, 1) > 0.6) ctx.fillRect(ox + x + bw / 2 - 1, base - bh - 40, 2, 40);
          for (let wy = base - bh + 12; wy < base - 10; wy += 14)
            for (let wx = 6; wx < bw - 6; wx += 10)
              if (hash01(wx * 3.1 + wy * 7.7 + i) > 0.72) {
                ctx.fillStyle = hash01(wx + wy) > 0.5 ? "rgba(255,90,200,0.55)" : "rgba(90,240,255,0.5)";
                ctx.fillRect(ox + x + wx, wy, 4, 5);
              }
        });
      }
      break;
    }
    case "rain": {
      ctx.fillRect(0, base - 90, LW, 90);
      for (let i = 0; i < 6; i++) {
        const x = (i / 6) * LW + 80;
        wrap((ox) => {
          ctx.fillStyle = w.far;
          // crane
          ctx.fillRect(ox + x, base - 330, 12, 260);
          ctx.fillRect(ox + x - 60, base - 330, 220, 10);
          ctx.fillRect(ox + x + 140, base - 320, 3, 90);
          // ship
          ctx.beginPath();
          ctx.moveTo(ox + x + 160, base - 90);
          ctx.lineTo(ox + x + 340, base - 90);
          ctx.lineTo(ox + x + 320, base - 60);
          ctx.lineTo(ox + x + 180, base - 60);
          ctx.fill();
          ctx.fillRect(ox + x + 200, base - 130, 60, 40);
        });
      }
      wrap((ox) => {
        ctx.fillStyle = w.far;
        ctx.fillRect(ox + 1500, base - 300, 30, 240);
        ctx.fillRect(ox + 1490, base - 320, 50, 24);
      });
      break;
    }
    case "snow": {
      for (let i = 0; i < 9; i++) {
        const x = (i / 9) * LW;
        const hh = H(i, 200, 330);
        wrap((ox) => {
          ctx.fillStyle = w.far;
          ctx.beginPath();
          ctx.moveTo(ox + x - 200, base);
          ctx.lineTo(ox + x + 40, base - hh);
          ctx.lineTo(ox + x + 300, base);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.75)";
          ctx.beginPath();
          ctx.moveTo(ox + x + 40, base - hh);
          ctx.lineTo(ox + x - 15, base - hh + 60);
          ctx.lineTo(ox + x + 20, base - hh + 48);
          ctx.lineTo(ox + x + 45, base - hh + 66);
          ctx.lineTo(ox + x + 92, base - hh + 56);
          ctx.closePath();
          ctx.fill();
        });
      }
      for (let i = 0; i < 5; i++) {
        const x = (i / 5) * LW + 200;
        wrap((ox) => {
          ctx.fillStyle = w.mid;
          ctx.fillRect(ox + x, base - 200, 26, 200);
          ctx.beginPath();
          ctx.moveTo(ox + x - 4, base - 200);
          ctx.lineTo(ox + x + 13, base - 260);
          ctx.lineTo(ox + x + 30, base - 200);
          ctx.fill();
        });
      }
      break;
    }
    case "sand": {
      ctx.beginPath();
      ctx.moveTo(0, base);
      for (let x = 0; x <= LW; x += 16) ctx.lineTo(x, base - 110 - Math.sin((x / LW) * Math.PI * 4) * 35 - Math.cos((x / LW) * Math.PI * 10) * 12);
      ctx.lineTo(LW, base);
      ctx.fill();
      for (let i = 0; i < 12; i++) {
        const x = (i / 12) * LW + 40;
        const hh = H(i, 60, 140);
        wrap((ox) => {
          ctx.fillStyle = w.far;
          ctx.fillRect(ox + x, base - 110 - hh, 70, hh);
          ctx.beginPath();
          ctx.arc(ox + x + 35, base - 110 - hh, 34, Math.PI, 0);
          ctx.fill();
          if (i % 3 === 0) {
            ctx.fillRect(ox + x + 90, base - 110 - hh - 80, 16, hh + 80);
            ctx.beginPath();
            ctx.arc(ox + x + 98, base - 110 - hh - 80, 10, Math.PI, 0);
            ctx.fill();
          }
        });
      }
      break;
    }
    case "sky": {
      for (let i = 0; i < 7; i++) {
        const x = (i / 7) * LW + 60;
        const y = H(i, 120, 300);
        const iw = H(i + 2, 120, 220);
        wrap((ox) => {
          ctx.fillStyle = w.far;
          ctx.beginPath();
          ctx.moveTo(ox + x, y);
          ctx.lineTo(ox + x + iw, y);
          ctx.lineTo(ox + x + iw * 0.6, y + 70);
          ctx.lineTo(ox + x + iw * 0.4, y + 70);
          ctx.closePath();
          ctx.fill();
          ctx.fillRect(ox + x + iw * 0.3, y - 70, 20, 70);
          ctx.beginPath();
          ctx.moveTo(ox + x + iw * 0.3 - 6, y - 70);
          ctx.lineTo(ox + x + iw * 0.3 + 10, y - 100);
          ctx.lineTo(ox + x + iw * 0.3 + 26, y - 70);
          ctx.fill();
        });
      }
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 40; i++) {
        const x = (i / 40) * LW;
        wrap((ox) => {
          ctx.beginPath();
          ctx.arc(ox + x, base - 40 + Math.sin(i) * 14, 70 + hash01(i) * 40, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      break;
    }
  }
}

function drawMid(ctx: CanvasRenderingContext2D, w: WorldDef) {
  const base = LH;
  let x = 0;
  let i = 0;
  while (x < LW) {
    const bw = 90 + hash01(i * 3.3 + w.id) * 130;
    const bh = 110 + hash01(i * 5.1 + w.id * 3) * 190;
    const gx = x;
    wrap((ox) => {
      ctx.fillStyle = w.mid;
      const X = ox + gx;
      const top = base - bh;
      if (w.weather === "sky") {
        ctx.fillRect(X + 10, top, bw - 20, bh);
        for (let k = 0; k < bw - 20; k += 16) ctx.fillRect(X + 10 + k, top - 10, 9, 10);
        ctx.beginPath();
        ctx.moveTo(X + bw / 2 - 18, top - 10);
        ctx.lineTo(X + bw / 2, top - 60);
        ctx.lineTo(X + bw / 2 + 18, top - 10);
        ctx.fill();
      } else {
        ctx.fillRect(X, top, bw - 8, bh);
        if (w.weather === "sun" || w.weather === "snow") {
          ctx.beginPath();
          ctx.moveTo(X - 8, top);
          ctx.lineTo(X + (bw - 8) / 2, top - 40);
          ctx.lineTo(X + bw, top);
          ctx.fill();
          if (w.weather === "snow") {
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.beginPath();
            ctx.moveTo(X - 8, top);
            ctx.lineTo(X + (bw - 8) / 2, top - 40);
            ctx.lineTo(X + bw, top);
            ctx.lineTo(X + bw - 10, top + 6);
            ctx.lineTo(X + (bw - 8) / 2, top - 30);
            ctx.lineTo(X + 2, top + 6);
            ctx.fill();
          }
        } else if (w.weather === "rain") {
          for (let k = 0; k < bw - 8; k += 30) {
            ctx.beginPath();
            ctx.moveTo(X + k, top);
            ctx.lineTo(X + k + 30, top - 18);
            ctx.lineTo(X + k + 30, top);
            ctx.fill();
          }
        } else if (w.weather === "sand") {
          if (i % 2 === 0) {
            ctx.beginPath();
            ctx.arc(X + (bw - 8) / 2, top, (bw - 8) * 0.32, Math.PI, 0);
            ctx.fill();
          }
        } else if (w.weather === "neon") {
          if (i % 2 === 0) {
            ctx.fillStyle = i % 4 === 0 ? w.accent : w.accent2;
            ctx.globalAlpha = 0.85;
            ctx.fillRect(X + 10, top + 16, Math.min(70, bw - 30), 16);
            ctx.globalAlpha = 1;
          }
        }
      }
      // sun-side rim and shaded side give the skyline volume
      if (w.weather !== "sky") {
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        ctx.fillRect(X, top, 6, bh);
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(X + bw - 22, top, 14, bh);
        // skyline props: water towers, antennas, vents (scenery only)
        const prop = hash01(i * 7.3 + w.id * 2);
        ctx.fillStyle = w.mid;
        if ((w.weather === "sun" || w.weather === "rain") && prop > 0.55 && bw > 120) {
          const tx = X + bw * 0.55;
          ctx.fillRect(tx + 4, top - 52, 3, 30);
          ctx.fillRect(tx + 27, top - 52, 3, 30);
          ctx.beginPath();
          ctx.roundRect(tx, top - 80, 34, 34, 4);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(tx - 3, top - 80);
          ctx.lineTo(tx + 17, top - 96);
          ctx.lineTo(tx + 37, top - 80);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.10)";
          ctx.fillRect(tx, top - 80, 5, 34);
        } else if (prop > 0.3 && w.weather !== "sand") {
          ctx.fillRect(X + bw * 0.3, top - 46, 3, 46);
          ctx.fillRect(X + bw * 0.3 - 8, top - 34, 19, 2);
          ctx.fillRect(X + bw * 0.62, top - 16, 18, 16);
          if (w.weather === "neon") {
            ctx.fillStyle = "rgba(255,80,80,0.9)";
            ctx.fillRect(X + bw * 0.3 - 1, top - 50, 5, 5);
          }
        }
      }
      // windows
      for (let wy = top + 40; wy < base - 20; wy += 34)
        for (let wx = 16; wx < bw - 26; wx += 26) {
          const lit = hash01(wx * 1.7 + wy * 2.3 + i * 11 + w.id) > (w.weather === "neon" || w.weather === "snow" ? 0.45 : 0.7);
          ctx.fillStyle = lit ? w.windowOn : w.windowOff;
          ctx.globalAlpha = lit ? 0.75 : 0.5;
          if (w.weather === "sand") {
            ctx.beginPath();
            ctx.roundRect(X + wx, wy, 11, 16, [6, 6, 0, 0]);
            ctx.fill();
          } else ctx.fillRect(X + wx, wy, 11, 15);
          ctx.globalAlpha = 1;
        }
    });
    x += bw;
    i++;
  }
}

function drawNear(ctx: CanvasRenderingContext2D, w: WorldDef) {
  const base = LH;
  for (let i = 0; i < 18; i++) {
    const x = (i / 18) * LW + hash01(i * 9.1 + w.id) * 60;
    const s = 0.8 + hash01(i * 4.4) * 0.6;
    wrap((ox) => {
      const X = ox + x;
      ctx.fillStyle = w.near;
      ctx.strokeStyle = w.near;
      switch (w.weather) {
        case "sun":
          if (i % 3 === 0) {
            ctx.fillRect(X, base - 170 * s, 6, 170 * s);
            ctx.fillRect(X - 20, base - 160 * s, 46, 5);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(X - 20, base - 158 * s);
            ctx.quadraticCurveTo(X + 50, base - 130 * s, X + LW / 6 - 20, base - 158 * s);
            ctx.stroke();
          } else {
            ctx.fillRect(X - 4, base - 60 * s, 8, 60 * s);
            for (const [dx, dy, r] of [
              [0, -80, 34],
              [-24, -62, 26],
              [24, -62, 26],
            ] as const) {
              ctx.beginPath();
              ctx.arc(X + dx * s, base + dy * s, r * s, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          break;
        case "neon":
          if (i % 2 === 0) {
            ctx.fillRect(X, base - 150 * s, 5, 150 * s);
            ctx.fillRect(X - 50, base - 210 * s, 110, 60 * s);
            ctx.fillStyle = i % 4 === 0 ? "rgba(255,79,184,0.55)" : "rgba(60,242,255,0.5)";
            ctx.fillRect(X - 44, base - 204 * s, 98, 48 * s);
          } else {
            ctx.fillRect(X - 20, base - 120 * s, 40, 50 * s);
            ctx.fillRect(X - 16, base - 70 * s, 4, 70 * s);
            ctx.fillRect(X + 12, base - 70 * s, 4, 70 * s);
          }
          break;
        case "rain":
          ctx.fillRect(X, base - 180 * s, 5, 180 * s);
          ctx.fillRect(X, base - 180 * s, 26, 5);
          ctx.fillStyle = "rgba(255,217,138,0.5)";
          ctx.beginPath();
          ctx.arc(X + 24, base - 170 * s, 7, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "snow": {
          ctx.fillRect(X - 3, base - 30 * s, 6, 30 * s);
          for (let k = 0; k < 3; k++) {
            const ty = base - (30 + k * 34) * s;
            const tw = (44 - k * 10) * s;
            ctx.fillStyle = w.near;
            ctx.beginPath();
            ctx.moveTo(X - tw, ty);
            ctx.lineTo(X, ty - 50 * s);
            ctx.lineTo(X + tw, ty);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.beginPath();
            ctx.moveTo(X - tw * 0.5, ty - 25 * s);
            ctx.lineTo(X, ty - 50 * s);
            ctx.lineTo(X + tw * 0.5, ty - 25 * s);
            ctx.fill();
          }
          break;
        }
        case "sand":
          if (i % 2 === 0) {
            ctx.lineWidth = 7 * s;
            ctx.beginPath();
            ctx.moveTo(X, base);
            ctx.quadraticCurveTo(X + 10, base - 90 * s, X + 4, base - 160 * s);
            ctx.stroke();
            for (let k = 0; k < 6; k++) {
              const a = (k / 6) * Math.PI * 2;
              ctx.beginPath();
              ctx.ellipse(X + 4 + Math.cos(a) * 26 * s, base - 160 * s + Math.sin(a) * 8 * s, 30 * s, 7 * s, a, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            ctx.beginPath();
            ctx.moveTo(X - 50 * s, base);
            ctx.lineTo(X, base - 70 * s);
            ctx.lineTo(X + 50 * s, base);
            ctx.fill();
          }
          break;
        case "sky":
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.arc(X + k * 30 * s, base - 30 - hash01(i + k) * 30, (36 + k * 8) * s, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
      }
    });
  }
}

export function getLayers(worldId: number): Layers {
  const key = `${worldId}:${RES}`;
  const c = cache.get(key);
  if (c) return c;
  // keep memory bounded: only the most recent couple of worlds stay cached
  if (cache.size >= 2) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  const w = WORLDS[worldId] ?? (WORLDS[0] as WorldDef);
  const far = makeCanvas(LW, LH);
  const mid = makeCanvas(LW, LH);
  const near = makeCanvas(LW, LH);
  const fc = far.getContext("2d");
  const mc = mid.getContext("2d");
  const nc = near.getContext("2d");
  const night = w.weather === "neon" || w.weather === "snow";
  if (fc) {
    fc.scale(RES, RES);
    drawFar(fc, w);
    shadeLayer(fc, night ? "rgba(255,255,255,0)" : "rgba(255,255,255,0.04)", night ? "rgba(140,170,255,0.16)" : "rgba(255,255,255,0.26)");
  }
  if (mc) {
    mc.scale(RES, RES);
    drawMid(mc, w);
    shadeLayer(mc, "rgba(255,255,255,0.06)", night ? "rgba(120,150,255,0.12)" : "rgba(255,255,255,0.16)");
  }
  if (nc) {
    nc.scale(RES, RES);
    drawNear(nc, w);
    shadeLayer(nc, "rgba(255,255,255,0.05)", "rgba(0,0,0,0.06)");
  }
  const layers = { far, mid, near };
  cache.set(key, layers);
  return layers;
}

function drawLayer(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, camX: number, f: number, y: number, fill: string) {
  const off = (((camX * f) % LW) + LW) % LW;
  ctx.drawImage(img, -off, y, LW, LH);
  if (LW - off < VIEW_W) ctx.drawImage(img, LW - off, y, LW, LH);
  if (y + LH < VIEW_H) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, y + LH - 1, VIEW_W, VIEW_H - (y + LH) + 1);
  }
}

const CLOUD_W = 260;
const CLOUD_H = 120;
const cloudCache = new Map<string, HTMLCanvasElement>();

/** A puffy cartoon cloud: merged circles, flat-ish base, lit top and a cool shaded underside. */
function getCloud(w: WorldDef, variant: number): HTMLCanvasElement {
  const key = `${w.id}:${variant}`;
  const hit = cloudCache.get(key);
  if (hit) return hit;
  const c = makeCanvas(CLOUD_W, CLOUD_H);
  const g = c.getContext("2d");
  if (g) {
    g.scale(RES, RES);
    const rain = w.weather === "rain";
    const sand = w.weather === "sand";
    const base = rain ? "#8c9cab" : sand ? "#fff1dc" : "#ffffff";
    const shade = rain ? "#64758a" : sand ? "#f0c9a0" : w.weather === "snow" ? "#c9d3f2" : "#cfe0f5";
    const puffs: [number, number, number][] = [];
    const cx = CLOUD_W / 2;
    const baseY = CLOUD_H * 0.78;
    const count = 4 + (variant % 3);
    for (let k = 0; k < count; k++) {
      const u = k / (count - 1);
      const px = cx + (u - 0.5) * (CLOUD_W * 0.62);
      const bump = Math.sin(u * Math.PI);
      const r = 20 + bump * (24 + hash01(variant * 11 + k) * 14);
      puffs.push([px, baseY - r * 0.75 - bump * 6, r]);
    }
    const shapePath = () => {
      g.beginPath();
      for (const [px, py, r] of puffs) {
        g.moveTo(px + r, py);
        g.arc(px, py, r, 0, Math.PI * 2);
      }
      g.moveTo(cx - CLOUD_W * 0.36, baseY);
      g.roundRect(cx - CLOUD_W * 0.36, baseY - 26, CLOUD_W * 0.72, 26, 13);
    };
    // body
    shapePath();
    g.fillStyle = base;
    g.fill();
    // underside shading + top highlight, clipped to the cloud
    g.save();
    shapePath();
    g.clip();
    const grad = g.createLinearGradient(0, baseY - 70, 0, baseY);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(1, shade);
    g.fillStyle = grad;
    g.fillRect(0, baseY - 70, CLOUD_W, 72);
    g.fillStyle = rain ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)";
    for (const [px, py, r] of puffs) {
      g.beginPath();
      g.arc(px - r * 0.25, py - r * 0.3, r * 0.55, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  cloudCache.set(key, c);
  return c;
}

const skyCache = new Map<string, CanvasGradient>();

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: WorldDef,
  camX: number,
  camY: number,
  t: number,
  high: boolean,
  key: string,
) {
  // Sky
  let g = skyCache.get(key + w.id);
  if (!g) {
    g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, w.sky[0]);
    g.addColorStop(0.55, w.sky[1]);
    g.addColorStop(1, w.sky[2]);
    skyCache.set(key + w.id, g);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const cy = camY - 45;

  // Stars at night
  if (w.weather === "neon" || w.weather === "snow") {
    for (let i = 0; i < 70; i++) {
      const sx = (hash01(i * 3.7) * VIEW_W * 1.2 - camX * 0.02) % VIEW_W;
      const x = sx < 0 ? sx + VIEW_W : sx;
      const y = hash01(i * 9.1) * VIEW_H * 0.45;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.8 + hash01(i) * 2) + i));
      ctx.fillStyle = `rgba(255,255,255,${(w.weather === "snow" ? 0.4 : 0.8) * tw})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // Sun / moon with glow
  const sunX = VIEW_W * 0.74;
  const sunY = (w.weather === "sand" ? 300 : w.weather === "neon" ? 120 : 130) - cy * 0.04;
  const sunR = w.weather === "sand" ? 90 : w.weather === "rain" ? 60 : 54;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR * 3.4);
  glow.addColorStop(0, w.weather === "rain" ? "rgba(255,255,255,0.25)" : "rgba(255,250,220,0.55)");
  glow.addColorStop(1, "rgba(255,250,220,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - sunR * 3.4, sunY - sunR * 3.4, sunR * 6.8, sunR * 6.8);
  // horizon light band
  const hb = ctx.createLinearGradient(0, VIEW_H * 0.45, 0, VIEW_H);
  hb.addColorStop(0, "rgba(255,255,255,0)");
  hb.addColorStop(1, w.weather === "neon" ? "rgba(255,80,200,0.16)" : "rgba(255,248,230,0.22)");
  ctx.fillStyle = hb;
  ctx.fillRect(0, VIEW_H * 0.45, VIEW_W, VIEW_H * 0.55);
  if (w.weather !== "rain") {
    if (high) {
      const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.9, sunX, sunY, sunR * 1.35);
      halo.addColorStop(0, "rgba(255,255,255,0.35)");
      halo.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR * 1.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = w.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    if (w.weather !== "neon") {
      const inner = ctx.createRadialGradient(sunX - sunR * 0.3, sunY - sunR * 0.3, 0, sunX, sunY, sunR);
      inner.addColorStop(0, "rgba(255,255,255,0.55)");
      inner.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fill();
    }
    if (w.weather === "neon") {
      ctx.fillStyle = w.sky[1];
      ctx.beginPath();
      ctx.arc(sunX + 18, sunY - 10, sunR * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Light rays
  if (high && (w.weather === "sun" || w.weather === "sand" || w.weather === "sky")) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      const a = 1.9 + i * 0.22 + Math.sin(t * 0.2 + i) * 0.03;
      ctx.fillStyle = "rgba(255,240,200,0.045)";
      ctx.beginPath();
      ctx.moveTo(sunX, sunY);
      ctx.lineTo(sunX + Math.cos(a) * 1600, sunY + Math.sin(a) * 1600);
      ctx.lineTo(sunX + Math.cos(a + 0.07) * 1600, sunY + Math.sin(a + 0.07) * 1600);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Drifting clouds: two depth bands of soft, shaded puffs
  if (w.weather !== "neon") {
    const n = high ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const farBand = i % 3 === 0;
      const speed = (farBand ? 4 : 8) + hash01(i * 2.1) * 12;
      const span = VIEW_W + 520;
      const x = ((((hash01(i * 5.3) * span - camX * (farBand ? 0.025 : 0.06) - t * speed) % span) + span) % span) - 260;
      const y = (farBand ? 70 : 50) + hash01(i * 7.9) * (farBand ? 120 : 220) - cy * (farBand ? 0.03 : 0.06);
      const sc = (farBand ? 0.55 : 0.8) + hash01(i * 1.3) * (farBand ? 0.35 : 0.7);
      const img = getCloud(w, i % 4);
      const cw = CLOUD_W * sc;
      const ch = CLOUD_H * sc;
      ctx.globalAlpha = farBand ? 0.55 : w.weather === "rain" ? 0.85 : 0.95;
      ctx.drawImage(img, x - cw / 2, y - ch * 0.62, cw, ch);
    }
    ctx.globalAlpha = 1;
  }

  // Sunny birds
  if (w.weather === "sun" || w.weather === "sand") {
    ctx.strokeStyle = "rgba(60,70,90,0.55)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const x = ((t * (30 + i * 6) + i * 300) % (VIEW_W + 200)) - 100;
      const y = 120 + i * 30 + Math.sin(t + i) * 10;
      const f = Math.sin(t * 8 + i) * 5;
      ctx.beginPath();
      ctx.moveTo(x - 8, y - f);
      ctx.quadraticCurveTo(x - 3, y - 2, x, y);
      ctx.quadraticCurveTo(x + 3, y - 2, x + 8, y - f);
      ctx.stroke();
    }
  }

  const L = getLayers(w.id);
  drawLayer(ctx, L.far, camX, 0.1, VIEW_H - LH + 80 - cy * 0.08, w.far);
  // horizon haze
  const hz = ctx.createLinearGradient(0, VIEW_H - 260, 0, VIEW_H);
  hz.addColorStop(0, "rgba(0,0,0,0)");
  hz.addColorStop(1, w.fog);
  ctx.fillStyle = hz;
  ctx.fillRect(0, VIEW_H - 260, VIEW_W, 260);
  drawLayer(ctx, L.mid, camX, 0.25, VIEW_H - LH + 150 - cy * 0.18, w.mid);
  // blinking windows on the mid layer for neon/snow
  if (w.weather === "neon") {
    for (let i = 0; i < 8; i++) {
      const on = Math.sin(t * (1 + i * 0.37) + i * 2) > 0.2;
      if (!on) continue;
      const x = ((hash01(i * 4.4) * VIEW_W * 1.5 - camX * 0.25) % VIEW_W + VIEW_W) % VIEW_W;
      ctx.fillStyle = i % 2 ? "rgba(255,79,184,0.5)" : "rgba(60,242,255,0.5)";
      ctx.fillRect(x, VIEW_H - 230 + hash01(i) * 80 - cy * 0.18, 26, 6);
    }
  }
  drawLayer(ctx, L.near, camX, 0.45, VIEW_H - LH + 230 - cy * 0.32, w.near);
  const hz2 = ctx.createLinearGradient(0, VIEW_H - 160, 0, VIEW_H);
  hz2.addColorStop(0, "rgba(0,0,0,0)");
  hz2.addColorStop(1, w.fog);
  ctx.fillStyle = hz2;
  ctx.fillRect(0, VIEW_H - 160, VIEW_W, 160);
}

export function drawWeatherFront(ctx: CanvasRenderingContext2D, w: WorldDef, camX: number, t: number, high: boolean) {
  const n = high ? 1 : 0.45;
  if (w.weather === "rain") {
    ctx.strokeStyle = "rgba(200,225,240,0.45)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const count = Math.floor(150 * n);
    for (let i = 0; i < count; i++) {
      const sp = 900 + hash01(i) * 500;
      const x = ((((hash01(i * 3.3) * (VIEW_W + 200) - t * 220 - camX * 0.8) % (VIEW_W + 200)) + VIEW_W + 200) % (VIEW_W + 200)) - 100;
      const y = (((hash01(i * 7.1) * VIEW_H + t * sp) % (VIEW_H + 40)) + VIEW_H + 40) % (VIEW_H + 40) - 20;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 6, y + 18);
    }
    ctx.stroke();
  } else if (w.weather === "snow") {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const count = Math.floor(130 * n);
    for (let i = 0; i < count; i++) {
      const s = 1 + hash01(i * 1.9) * 2.5;
      const x = (((hash01(i * 3.3) * (VIEW_W + 100) + Math.sin(t + i) * 20 - camX * (0.3 + s * 0.15)) % (VIEW_W + 100)) + VIEW_W + 100) % (VIEW_W + 100) - 50;
      const y = (((hash01(i * 7.1) * VIEW_H + t * (40 + s * 25)) % (VIEW_H + 20)) + VIEW_H + 20) % (VIEW_H + 20) - 10;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (w.weather === "sand") {
    ctx.strokeStyle = "rgba(255,225,170,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const count = Math.floor(60 * n);
    for (let i = 0; i < count; i++) {
      const x = ((((hash01(i * 3.3) * (VIEW_W + 300) - t * 380 - camX * 0.6) % (VIEW_W + 300)) + VIEW_W + 300) % (VIEW_W + 300)) - 150;
      const y = hash01(i * 7.1) * VIEW_H + Math.sin(t * 2 + i) * 12;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30, y - 2);
    }
    ctx.stroke();
  } else if (w.weather === "neon" || w.weather === "sky") {
    const count = Math.floor(28 * n);
    for (let i = 0; i < count; i++) {
      const x = (((hash01(i * 3.3) * (VIEW_W + 100) - camX * 0.7) % (VIEW_W + 100)) + VIEW_W + 100) % (VIEW_W + 100) - 50;
      const y = (((hash01(i * 7.1) * VIEW_H - t * 20) % VIEW_H) + VIEW_H) % VIEW_H;
      const a = 0.25 + 0.25 * Math.sin(t * 2 + i);
      ctx.fillStyle = w.weather === "neon" ? (i % 2 ? `rgba(255,79,184,${a})` : `rgba(60,242,255,${a})`) : `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
