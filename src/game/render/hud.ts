import { POWERUP_DURATION, VIEW_H, VIEW_W } from "../constants";
import type { Run } from "../engine";
import type { PowerKind } from "../types";
import { drawFish, starPath } from "./cat";
import { drawPowerIcon, powerColor } from "./world";

export const FONT = "Fredoka, 'Trebuchet MS', system-ui, sans-serif";

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 16) {
  ctx.fillStyle = "rgba(24, 18, 44, 0.5)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "left",
  weight = 700,
  outline = 0,
) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (outline > 0) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = "rgba(24,18,44,0.85)";
    ctx.lineJoin = "round";
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

export interface HudOpts {
  touch: boolean;
  countdown: number;
  debug: string[] | null;
}

export function drawHud(ctx: CanvasRenderingContext2D, run: Run, o: HudOpts) {
  const w = run.world;
  const p = run.player;
  // --- progress panel
  panel(ctx, 18, 16, 320, 78);
  const lvl = run.def;
  text(ctx, `${lvl.world + 1}-${((lvl.id - 1) % 5) + 1}  ${lvl.name}`, 34, 36, 17, "#ffffff", "left", 600);
  text(ctx, `${Math.floor(run.distance)} m`, 322, 36, 18, "#ffd166", "right", 700);
  const bx = 34;
  const by = 60;
  const bw = 270;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, 12, 6);
  ctx.fill();
  ctx.fillStyle = w.accent;
  ctx.beginPath();
  ctx.roundRect(bx, by, Math.max(12, bw * run.progress), 12, 6);
  ctx.fill();
  // flag
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(bx + bw + 6, by - 8, 2, 22);
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.moveTo(bx + bw + 8, by - 8);
  ctx.lineTo(bx + bw + 20, by - 3);
  ctx.lineTo(bx + bw + 8, by + 2);
  ctx.fill();
  // marker
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(bx + bw * run.progress, by + 6, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = w.accent;
  ctx.beginPath();
  ctx.arc(bx + bw * run.progress, by + 6, 4, 0, Math.PI * 2);
  ctx.fill();

  // --- fish + star
  panel(ctx, 18, 102, 200, 44, 14);
  drawFish(ctx, 44, 124, 1.1, false);
  text(ctx, `${run.fishCount}`, 66, 125, 22, "#ffffff", "left", 700);
  ctx.font = `700 22px ${FONT}`;
  const fw = ctx.measureText(`${run.fishCount}`).width;
  text(ctx, `/ ${run.layout.totalFish}`, 72 + fw, 126, 15, "rgba(255,255,255,0.65)", "left", 600);
  ctx.save();
  ctx.fillStyle = run.starFound ? "#ffe066" : "rgba(255,255,255,0.15)";
  ctx.strokeStyle = run.starFound ? "#ffffff" : "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  starPath(ctx, 194, 124, 13);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // --- power-up timers
  let px = 18;
  for (const k of ["magnet", "shield", "speed", "super"] as PowerKind[]) {
    const rem = run.powers[k];
    if (rem <= 0) continue;
    const frac = rem / POWERUP_DURATION[k];
    panel(ctx, px, 154, 132, 40, 20);
    const col = powerColor(k);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(px + 20, 174, 15, 0, Math.PI * 2);
    ctx.fill();
    drawPowerIcon(ctx, k, px + 20, 174, 14);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.roundRect(px + 42, 169, 78, 10, 5);
    ctx.fill();
    const blink = rem < 1.5 && Math.sin(run.time * 20) > 0;
    ctx.fillStyle = blink ? "#ffffff" : col;
    ctx.beginPath();
    ctx.roundRect(px + 42, 169, Math.max(6, 78 * frac), 10, 5);
    ctx.fill();
    px += 140;
  }

  // --- score (left of the pause button)
  text(ctx, "SCORE", VIEW_W - 104, 30, 13, "rgba(255,255,255,0.8)", "right", 600, 4);
  text(ctx, Math.floor(run.score).toLocaleString("en-US"), VIEW_W - 104, 54, 26, "#ffffff", "right", 700, 6);

  // --- combo
  if (run.combo > 0) {
    const s = 1 + run.comboPop * 0.45;
    ctx.save();
    ctx.translate(VIEW_W / 2, 58);
    ctx.scale(s, s);
    text(ctx, `x${run.mult.toFixed(1)}`, 0, 0, 40, "#ffd166", "center", 700, 8);
    ctx.restore();
    text(ctx, `COMBO ${run.combo}`, VIEW_W / 2, 92, 15, "#ffffff", "center", 600, 4);
    ctx.strokeStyle = "rgba(255,209,102,0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(VIEW_W / 2, 58, 40, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * run.comboTimer) / 4);
    ctx.stroke();
  }

  // --- screen-space pop texts
  let sy = VIEW_H * 0.34;
  for (const t of run.texts.items) {
    if (!t.active || !t.screen) continue;
    const k = 1 - t.life / t.max;
    const sc = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.5);
    ctx.save();
    ctx.globalAlpha = Math.min(1, t.life / 0.3);
    ctx.translate(VIEW_W / 2, sy);
    ctx.scale(sc, sc);
    text(ctx, t.text, 0, 0, t.size, t.color, "center", 700, 9);
    ctx.restore();
    sy += t.size + 14;
  }

  // --- tutorial hint
  const h = run.activeHint;
  if (h && run.hintAlpha > 0) {
    const s = o.touch ? h.touchText : h.text;
    ctx.save();
    ctx.globalAlpha = run.hintAlpha;
    ctx.font = `700 26px ${FONT}`;
    const tw = ctx.measureText(s).width;
    const y = 232 + Math.sin(run.time * 4) * 3;
    ctx.fillStyle = "rgba(255,248,235,0.95)";
    ctx.beginPath();
    ctx.roundRect(VIEW_W / 2 - tw / 2 - 30, y - 30, tw + 60, 60, 30);
    ctx.fill();
    ctx.strokeStyle = w.accent;
    ctx.lineWidth = 4;
    ctx.stroke();
    text(ctx, s, VIEW_W / 2, y + 1, 26, "#2a2140", "center", 700);
    ctx.restore();
  }

  // --- touch zone guide at the very start
  if (o.touch && run.time < 4 && run.state === "playing") {
    const a = Math.min(1, (4 - run.time) / 1) * 0.6;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 0, VIEW_W / 2 - 2, VIEW_H);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(VIEW_W / 2 + 2, 0, VIEW_W / 2, VIEW_H);
    text(ctx, "TAP: SLIDE", VIEW_W * 0.25, VIEW_H - 60, 28, "#ffffff", "center", 700, 6);
    text(ctx, "TAP: JUMP", VIEW_W * 0.75, VIEW_H - 60, 28, "#ffffff", "center", 700, 6);
    ctx.restore();
  }

  // --- vacuum warning
  if (run.vacuum.active && run.state === "playing") {
    const gap = p.x - run.vacuum.x - 230;
    if (gap < 260) {
      const a = 0.5 + 0.5 * Math.sin(run.time * 12);
      const g = ctx.createLinearGradient(0, 0, 160, 0);
      g.addColorStop(0, `rgba(255,60,60,${0.45 * a})`);
      g.addColorStop(1, "rgba(255,60,60,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 160, VIEW_H);
      text(ctx, "RUN!", 70, VIEW_H / 2, 34, "#ffffff", "center", 700, 7);
    }
  }

  // --- countdown
  if (o.countdown > 0) {
    const n = Math.ceil(o.countdown);
    const k = o.countdown - Math.floor(o.countdown);
    ctx.fillStyle = "rgba(20,16,40,0.35)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(VIEW_W / 2, VIEW_H / 2);
    const sc = 0.8 + k * 0.6;
    ctx.scale(sc, sc);
    ctx.globalAlpha = Math.min(1, k * 2 + 0.2);
    text(ctx, String(n), 0, 0, 150, "#ffd166", "center", 700, 16);
    ctx.restore();
  }

  // --- debug overlay (F3)
  if (o.debug) {
    panel(ctx, 18, VIEW_H - 24 - o.debug.length * 20, 300, o.debug.length * 20 + 12, 10);
    o.debug.forEach((line, i) => {
      ctx.font = `500 14px ui-monospace, Menlo, monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#b8ffb8";
      ctx.fillText(line, 30, VIEW_H - 8 - (o.debug!.length - i) * 20 + 4);
    });
  }
}
