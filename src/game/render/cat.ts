import { getAccessory, getSkin, gearHidesHat, type AccessoryDef, type SkinDef } from "../skins";

export type CatPose = "run" | "jump" | "fall" | "double" | "slide" | "wall" | "ledge" | "hurt" | "victory" | "idle";

export interface CatDrawOpts {
  x: number; // feet centre
  y: number; // feet
  pose: CatPose;
  t: number; // time (s)
  phase: number; // run cycle 0..1 repeating
  vy: number;
  squashX: number;
  squashY: number;
  flip: number; // 0..1 progress of double-jump flip
  skin: string;
  hat: string | null;
  scarf: string | null;
  glasses: string | null;
  alpha?: number;
  scale?: number;
  speed?: number; // for scarf/tail flutter
  silhouette?: string | null; // draw as flat colour (motion trail)
}

function limb(ctx: CanvasRenderingContext2D, px: number, py: number, ang: number, len: number, color: string, paw: string, w = 6.5) {
  const ex = px + Math.sin(ang) * len;
  const ey = py + Math.cos(ang) * len;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.fillStyle = paw;
  ctx.beginPath();
  ctx.ellipse(ex + 1, ey, 4.2, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function rainbow(t: number, k: number) {
  return `hsl(${Math.floor((t * 90 + k * 50) % 360)}, 85%, 62%)`;
}

export function drawCat(ctx: CanvasRenderingContext2D, o: CatDrawOpts) {
  const skin: SkinDef = getSkin(o.skin);
  const c = skin.colors;
  const sil = o.silhouette ?? null;
  const col = (v: string) => sil ?? v;
  const scale = o.scale ?? 1;
  const t = o.t;
  const ph = o.phase * Math.PI * 2;

  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.translate(o.x, o.y);
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Pose parameters.
  let rot = 0;
  let bob = 0;
  let fl1 = 0; // front near leg angle (radians from straight down, + = backwards)
  let fl2 = 0;
  let bl1 = 0;
  let bl2 = 0;
  let headDy = 0;
  let tailLift = Math.max(-14, Math.min(14, -o.vy * 0.012));
  let sx = o.squashX;
  let sy = o.squashY;
  let pivotY = -20;
  let hurt = false;
  switch (o.pose) {
    case "run": {
      const s = Math.sin(ph);
      fl1 = -s * 0.95;
      fl2 = -Math.sin(ph + 0.6) * 0.95;
      bl1 = Math.sin(ph + 0.2) * 0.95;
      bl2 = Math.sin(ph + 0.8) * 0.95;
      bob = -Math.abs(Math.cos(ph)) * 3;
      rot = Math.sin(ph * 2) * 0.03;
      break;
    }
    case "jump":
      fl1 = -1.1;
      fl2 = -0.9;
      bl1 = 1.2;
      bl2 = 1.0;
      rot = -0.22;
      break;
    case "double":
      fl1 = -0.6;
      fl2 = -0.4;
      bl1 = 0.6;
      bl2 = 0.4;
      rot = -o.flip * Math.PI * 2;
      break;
    case "fall":
      fl1 = -0.5;
      fl2 = -0.3;
      bl1 = 0.4;
      bl2 = 0.2;
      rot = 0.14;
      break;
    case "slide":
      fl1 = -1.45;
      fl2 = -1.3;
      bl1 = 1.45;
      bl2 = 1.3;
      sx *= 1.12;
      sy *= 0.62;
      headDy = 6;
      pivotY = -4;
      break;
    case "wall": {
      const s = Math.sin(ph * 1.6);
      fl1 = -s * 1;
      fl2 = s * 1;
      bl1 = s * 1;
      bl2 = -s * 1;
      rot = -Math.PI / 2 + 0.15;
      pivotY = -22;
      break;
    }
    case "ledge":
      fl1 = -2.2;
      fl2 = -2.0;
      bl1 = 0.3;
      bl2 = 0.5;
      rot = -0.45;
      break;
    case "hurt":
      fl1 = -1.6;
      fl2 = 1.6;
      bl1 = -1.4;
      bl2 = 1.4;
      rot = t * 9;
      hurt = true;
      break;
    case "victory":
      fl1 = -2.4 + Math.sin(t * 10) * 0.4;
      fl2 = -0.5;
      bl1 = 0.2;
      bl2 = -0.1;
      rot = -0.3;
      bob = -Math.abs(Math.sin(t * 5)) * 8;
      tailLift = 10;
      break;
    case "idle":
      fl1 = 0.1;
      fl2 = -0.1;
      bl1 = 1.4;
      bl2 = 1.5;
      rot = -0.42;
      bob = Math.sin(t * 2) * 0.8;
      tailLift = 6;
      break;
  }

  // Squash & stretch around the feet, rotation around the body centre.
  ctx.translate(0, bob);
  ctx.scale(sx, sy);
  ctx.translate(0, pivotY);
  ctx.rotate(rot);
  ctx.translate(0, -pivotY);

  const body = col(c.body);
  const shade = col(c.shade);
  const paw = col(skin.pattern === "tuxedo" || skin.pattern === "calico" ? "#ffffff" : skin.pattern === "siamese" ? c.stripe : c.belly);
  const legFar = col(skin.pattern === "siamese" ? c.stripe : c.shade);
  const legNear = col(skin.pattern === "siamese" ? c.stripe : skin.pattern === "rainbow" ? rainbow(t, 2) : c.body);

  // ---- tail (secondary motion)
  const wave = Math.sin(t * 7 + o.phase * 4) * 5;
  ctx.strokeStyle = col(skin.pattern === "siamese" ? c.stripe : skin.pattern === "rainbow" ? rainbow(t, 4) : c.body);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-20, -26);
  ctx.bezierCurveTo(-34, -28 - tailLift * 0.4, -42, -38 - tailLift, -34 + wave, -52 - tailLift);
  ctx.stroke();
  if (skin.pattern === "tabby" && !sil) {
    ctx.strokeStyle = c.stripe;
    ctx.lineWidth = 7;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.moveTo(-20, -26);
    ctx.bezierCurveTo(-34, -28 - tailLift * 0.4, -42, -38 - tailLift, -34 + wave, -52 - tailLift);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---- far legs
  limb(ctx, 12, -16, fl2, 15, legFar, paw);
  limb(ctx, -13, -16, bl2, 15, legFar, paw);

  // ---- body
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(-2, -23, 23, 13.5, 0, 0, Math.PI * 2);
  ctx.closePath();
  if (skin.pattern === "gold" && !sil) {
    const g = ctx.createLinearGradient(-25, -36, 20, -10);
    g.addColorStop(0, "#fff3b0");
    g.addColorStop(0.5, c.body);
    g.addColorStop(1, c.shade);
    ctx.fillStyle = g;
  } else if (skin.pattern === "rainbow" && !sil) {
    const g = ctx.createLinearGradient(-25, 0, 22, 0);
    for (let i = 0; i < 5; i++) g.addColorStop(i / 4, rainbow(t, i));
    ctx.fillStyle = g;
  } else ctx.fillStyle = body;
  ctx.fill();
  if (!sil) {
    ctx.clip();
    // belly
    ctx.fillStyle = skin.pattern === "tuxedo" ? "#ffffff" : c.belly;
    ctx.beginPath();
    ctx.ellipse(2, -12, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // back shading
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.beginPath();
    ctx.ellipse(-4, -36, 24, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (skin.pattern === "tabby") {
      ctx.strokeStyle = c.stripe;
      ctx.lineWidth = 3.2;
      for (let i = 0; i < 4; i++) {
        const sx2 = -16 + i * 8;
        ctx.beginPath();
        ctx.moveTo(sx2, -37);
        ctx.quadraticCurveTo(sx2 + 3, -30, sx2 - 1, -24);
        ctx.stroke();
      }
    } else if (skin.pattern === "calico") {
      ctx.fillStyle = "#e0832e";
      ctx.beginPath();
      ctx.ellipse(-12, -32, 10, 8, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2f2a2a";
      ctx.beginPath();
      ctx.ellipse(6, -34, 8, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (skin.pattern === "robot") {
      ctx.strokeStyle = c.stripe;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8, -37);
      ctx.lineTo(-8, -10);
      ctx.moveTo(6, -37);
      ctx.lineTo(6, -10);
      ctx.stroke();
      ctx.fillStyle = c.stripe;
      for (const [rx, ry] of [
        [-15, -30],
        [-1, -30],
        [13, -28],
      ] as const) {
        ctx.beginPath();
        ctx.arc(rx, ry, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (skin.pattern === "gold") {
      const sh = ((t * 0.8) % 1.6) - 0.3;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.ellipse(-25 + sh * 50, -26, 4, 16, 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (skin.pattern === "siamese") {
      const g = ctx.createRadialGradient(-22, -24, 2, -22, -24, 18);
      g.addColorStop(0, "rgba(90,63,46,0.7)");
      g.addColorStop(1, "rgba(90,63,46,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-30, -40, 30, 30);
    }
  }
  ctx.restore();

  // ---- scarf (behind head, over body)
  const scarf: AccessoryDef | null = getAccessory(o.scarf);
  if (scarf && !sil) {
    const flutter = Math.sin(t * 14) * 3;
    const trail = Math.min(1, (o.speed ?? 300) / 400);
    ctx.fillStyle = scarf.color2;
    ctx.beginPath();
    ctx.moveTo(8, -30);
    ctx.quadraticCurveTo(-6, -34 + flutter, -18 * trail - 4, -30 + flutter * 1.5);
    ctx.lineTo(-16 * trail - 4, -24 + flutter);
    ctx.quadraticCurveTo(-4, -26, 8, -24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = scarf.color;
    ctx.beginPath();
    ctx.ellipse(13, -27, 9, 5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    if (scarf.id === "stripescarf") {
      ctx.strokeStyle = scarf.color2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(9, -32);
      ctx.lineTo(12, -22);
      ctx.moveTo(15, -31);
      ctx.lineTo(18, -23);
      ctx.stroke();
    }
  }

  // ---- head
  const hx = 20;
  const hy = -35 + headDy;
  const earWob = Math.sin(t * 9) * 0.6 + Math.max(-3, Math.min(3, o.vy * 0.004));
  const earCol = col(skin.pattern === "siamese" ? c.stripe : skin.pattern === "rainbow" ? rainbow(t, 1) : c.body);
  ctx.fillStyle = earCol;
  ctx.beginPath();
  ctx.moveTo(hx - 10, hy - 6);
  ctx.lineTo(hx - 8 - earWob, hy - 21);
  ctx.lineTo(hx - 1, hy - 11);
  ctx.closePath();
  ctx.moveTo(hx + 1, hy - 11);
  ctx.lineTo(hx + 8 - earWob, hy - 22);
  ctx.lineTo(hx + 12, hy - 5);
  ctx.closePath();
  ctx.fill();
  if (!sil) {
    ctx.fillStyle = c.earInner;
    ctx.beginPath();
    ctx.moveTo(hx - 8, hy - 8);
    ctx.lineTo(hx - 7 - earWob, hy - 17);
    ctx.lineTo(hx - 3, hy - 11);
    ctx.closePath();
    ctx.moveTo(hx + 3, hy - 11);
    ctx.lineTo(hx + 8 - earWob, hy - 18);
    ctx.lineTo(hx + 10, hy - 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(hx, hy, 14, 13, 0, 0, Math.PI * 2);
  if (skin.pattern === "gold" && !sil) {
    const g = ctx.createLinearGradient(hx - 14, hy - 13, hx + 14, hy + 13);
    g.addColorStop(0, "#fff3b0");
    g.addColorStop(1, c.shade);
    ctx.fillStyle = g;
  } else ctx.fillStyle = skin.pattern === "rainbow" && !sil ? rainbow(t, 0) : body;
  ctx.fill();
  if (!sil) {
    ctx.clip();
    if (skin.pattern === "tabby") {
      ctx.strokeStyle = c.stripe;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy - 13);
      ctx.lineTo(hx - 1, hy - 7);
      ctx.moveTo(hx + 4, hy - 13);
      ctx.lineTo(hx + 3, hy - 7);
      ctx.moveTo(hx - 8, hy - 11);
      ctx.lineTo(hx - 5, hy - 6);
      ctx.stroke();
    } else if (skin.pattern === "calico") {
      ctx.fillStyle = "#2f2a2a";
      ctx.beginPath();
      ctx.ellipse(hx - 8, hy - 8, 8, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (skin.pattern === "siamese") {
      const g = ctx.createRadialGradient(hx + 9, hy + 3, 1, hx + 9, hy + 3, 12);
      g.addColorStop(0, "rgba(90,63,46,0.95)");
      g.addColorStop(1, "rgba(90,63,46,0)");
      ctx.fillStyle = g;
      ctx.fillRect(hx - 14, hy - 13, 28, 26);
    }
    // muzzle
    ctx.fillStyle = skin.pattern === "tuxedo" || skin.pattern === "calico" ? "#ffffff" : c.belly;
    ctx.beginPath();
    ctx.ellipse(hx + 8, hy + 5, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (!sil) {
    // eyes
    if (hurt) {
      ctx.strokeStyle = "#2a2230";
      ctx.lineWidth = 2;
      for (const ex of [hx + 2, hx + 10]) {
        ctx.beginPath();
        ctx.moveTo(ex - 2.5, hy - 4.5);
        ctx.lineTo(ex + 2.5, hy + 0.5);
        ctx.moveTo(ex + 2.5, hy - 4.5);
        ctx.lineTo(ex - 2.5, hy + 0.5);
        ctx.stroke();
      }
    } else {
      const blink = Math.sin(t * 1.3) > 0.985 || o.pose === "victory";
      for (const ex of [hx + 2, hx + 10]) {
        if (blink) {
          ctx.strokeStyle = "#2a2230";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ex, hy - 2, 2.6, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();
        } else {
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.ellipse(ex, hy - 2, 3.2, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = skin.gear === "robot" ? c.eye : c.eye;
          ctx.beginPath();
          ctx.ellipse(ex + 0.8, hy - 1.6, 2.2, 3.1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#14101a";
          ctx.beginPath();
          ctx.ellipse(ex + 1.1, hy - 1.4, 1, 2.3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(ex + 1.6, hy - 3, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // nose, mouth, whiskers
    ctx.fillStyle = c.nose;
    ctx.beginPath();
    ctx.moveTo(hx + 12, hy + 2);
    ctx.lineTo(hx + 16, hy + 2);
    ctx.lineTo(hx + 14, hy + 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(40,30,40,0.7)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(hx + 14, hy + 4.5);
    ctx.quadraticCurveTo(hx + 13, hy + 7.5, hx + 10.5, hy + 6.5);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(hx + 15, hy + 4);
    ctx.lineTo(hx + 26, hy + 2);
    ctx.moveTo(hx + 15, hy + 5);
    ctx.lineTo(hx + 26, hy + 6.5);
    ctx.stroke();
    // cheek blush
    ctx.fillStyle = "rgba(255,120,140,0.25)";
    ctx.beginPath();
    ctx.ellipse(hx + 4, hy + 5, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- gear (skin-specific)
  if (!sil) drawGear(ctx, skin, hx, hy, t);

  // ---- glasses
  const glasses = getAccessory(o.glasses);
  if (glasses && !sil && skin.gear !== "helmet") {
    if (glasses.id === "shades") {
      ctx.fillStyle = glasses.color;
      ctx.beginPath();
      ctx.roundRect(hx - 2, hy - 6, 8, 6, 2);
      ctx.roundRect(hx + 7, hy - 6, 8, 6, 2);
      ctx.fill();
      ctx.strokeStyle = glasses.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hx + 6, hy - 4);
      ctx.lineTo(hx + 7, hy - 4);
      ctx.moveTo(hx - 2, hy - 4);
      ctx.lineTo(hx - 10, hy - 6);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(hx, hy - 5, 2, 1.5);
      ctx.fillRect(hx + 9, hy - 5, 2, 1.5);
    } else {
      ctx.fillStyle = glasses.color;
      for (const gx of [hx + 2, hx + 11]) {
        ctx.beginPath();
        ctx.moveTo(gx, hy + 1);
        ctx.bezierCurveTo(gx - 6, hy - 3, gx - 3, hy - 8, gx, hy - 5);
        ctx.bezierCurveTo(gx + 3, hy - 8, gx + 6, hy - 3, gx, hy + 1);
        ctx.fill();
      }
      ctx.strokeStyle = glasses.color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(hx + 5, hy - 4);
      ctx.lineTo(hx + 8, hy - 4);
      ctx.stroke();
    }
  }

  // ---- hat
  const hat = getAccessory(o.hat);
  if (hat && !sil && !gearHidesHat(skin.gear)) drawHat(ctx, hat, hx, hy, t);

  // ---- near legs
  limb(ctx, 13, -15, fl1, 15, legNear, paw, 7);
  limb(ctx, -12, -15, bl1, 15, legNear, paw, 7);

  ctx.restore();
}

function drawGear(ctx: CanvasRenderingContext2D, skin: SkinDef, hx: number, hy: number, t: number) {
  switch (skin.gear) {
    case "headband": {
      ctx.fillStyle = "#e63946";
      ctx.beginPath();
      ctx.roundRect(hx - 14, hy - 10, 28, 5, 2);
      ctx.fill();
      const w = Math.sin(t * 12) * 3;
      ctx.beginPath();
      ctx.moveTo(hx - 13, hy - 9);
      ctx.quadraticCurveTo(hx - 24, hy - 12 + w, hx - 32, hy - 6 + w);
      ctx.lineTo(hx - 30, hy - 3 + w);
      ctx.quadraticCurveTo(hx - 22, hy - 7, hx - 13, hy - 6);
      ctx.fill();
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(hx + 4, hy - 7.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "helmet": {
      ctx.strokeStyle = "rgba(200,230,255,0.9)";
      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(180,220,255,0.18)";
      ctx.beginPath();
      ctx.arc(hx + 1, hy - 3, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hx + 1, hy - 3, 16, Math.PI * 1.15, Math.PI * 1.45);
      ctx.stroke();
      ctx.fillStyle = "#e0e5f2";
      ctx.beginPath();
      ctx.roundRect(hx - 12, hy + 14, 26, 6, 3);
      ctx.fill();
      ctx.strokeStyle = "#a8b0c8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hx + 1, hy - 24);
      ctx.lineTo(hx + 1, hy - 31);
      ctx.stroke();
      ctx.fillStyle = Math.sin(t * 6) > 0 ? "#ff5c8a" : "#ffd166";
      ctx.beginPath();
      ctx.arc(hx + 1, hy - 32, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "pirate": {
      ctx.fillStyle = "#1e1a22";
      ctx.beginPath();
      ctx.moveTo(hx - 17, hy - 9);
      ctx.quadraticCurveTo(hx, hy - 30, hx + 17, hy - 9);
      ctx.quadraticCurveTo(hx, hy - 14, hx - 17, hy - 9);
      ctx.fill();
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hx - 16, hy - 10);
      ctx.quadraticCurveTo(hx, hy - 15, hx + 16, hy - 10);
      ctx.stroke();
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(hx, hy - 18, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // eyepatch
      ctx.fillStyle = "#1e1a22";
      ctx.beginPath();
      ctx.ellipse(hx + 10, hy - 2, 4, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1e1a22";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(hx + 6, hy - 4);
      ctx.lineTo(hx - 12, hy - 8);
      ctx.stroke();
      break;
    }
    case "robot": {
      ctx.strokeStyle = "#6c8094";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy - 12);
      ctx.lineTo(hx - 5, hy - 24);
      ctx.stroke();
      ctx.fillStyle = Math.sin(t * 5) > 0 ? "#3cf2ff" : "#ff8f6b";
      ctx.beginPath();
      ctx.arc(hx - 5, hy - 25, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(60,242,255,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx - 6, hy + 9);
      ctx.lineTo(hx + 4, hy + 10);
      ctx.stroke();
      ctx.fillStyle = "#6c8094";
      ctx.beginPath();
      ctx.arc(hx - 11, hy + 1, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "none":
      break;
  }
}

function drawHat(ctx: CanvasRenderingContext2D, hat: AccessoryDef, hx: number, hy: number, t: number) {
  ctx.save();
  ctx.translate(hx + 1, hy - 11);
  ctx.rotate(0.12);
  switch (hat.id) {
    case "party": {
      ctx.fillStyle = hat.color;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(0, -22);
      ctx.lineTo(8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = hat.color2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-5, -6);
      ctx.lineTo(4, -9);
      ctx.moveTo(-3, -13);
      ctx.lineTo(2, -15);
      ctx.stroke();
      ctx.fillStyle = hat.color2;
      ctx.beginPath();
      ctx.arc(0, -23, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "beret": {
      ctx.fillStyle = hat.color;
      ctx.beginPath();
      ctx.ellipse(-1, -3, 14, 6, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hat.color2;
      ctx.fillRect(-1, -11, 2, 4);
      break;
    }
    case "tophat": {
      ctx.fillStyle = hat.color;
      ctx.beginPath();
      ctx.roundRect(-13, -2, 26, 4, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-8, -20, 16, 19, 2);
      ctx.fill();
      ctx.fillStyle = hat.color2;
      ctx.fillRect(-8, -6, 16, 3);
      break;
    }
    case "crown": {
      ctx.fillStyle = hat.color;
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(-9, -9);
      ctx.lineTo(-4.5, -4);
      ctx.lineTo(0, -12);
      ctx.lineTo(4.5, -4);
      ctx.lineTo(9, -9);
      ctx.lineTo(9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hat.color2;
      ctx.beginPath();
      ctx.arc(0, -3, 1.8, 0, Math.PI * 2);
      ctx.fill();
      const tw = (Math.sin(t * 4) + 1) / 2;
      ctx.fillStyle = `rgba(255,255,255,${0.4 + tw * 0.5})`;
      ctx.beginPath();
      ctx.arc(-6, -6, 1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

/** Small fish icon used for collectibles, HUD and UI previews. */
export function drawFish(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, gold: boolean, wiggle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(wiggle);
  const body = gold ? "#ffcf3f" : "#7fc8f8";
  const dark = gold ? "#e09b12" : "#3f8fd0";
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(-15, -7);
  ctx.lineTo(-14, 0);
  ctx.lineTo(-15, 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(-1, -3, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#15202b";
  ctx.beginPath();
  ctx.arc(5.5, -1.5, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner = 0.45, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * inner;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
