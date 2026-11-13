/**
 * Canvas-painted textures for the first-person 3D view. Everything is generated at runtime
 * (no image files), cached per world, and shares the 2D game's palette.
 */
import * as THREE from "three";
import { hash01 } from "../rng";
import type { WorldDef } from "../worlds";

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");
  return [c, g];
}

function tex(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat = true) {
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas(w, h);
  paint(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

export function disposeTextures() {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}

const night = (w: WorldDef) => w.weather === "neon" || w.weather === "snow";

/** One tile = 4 m x 4 m: two window columns, two floors. */
export function facadeTexture(w: WorldDef, style: number, emissive = false) {
  return tex(`facade:${w.id}:${style}:${emissive ? 1 : 0}`, 256, 256, (g) => {
    const body = w.bodies[style % w.bodies.length] ?? w.bodyDark;
    g.fillStyle = emissive ? "#000" : body;
    g.fillRect(0, 0, 256, 256);
    if (!emissive) {
      // bricks / panels
      g.fillStyle = "rgba(0,0,0,0.06)";
      for (let y = 0; y < 256; y += 16) {
        g.fillRect(0, y, 256, 1.5);
        for (let x = (y / 16) % 2 ? 0 : 16; x < 256; x += 32) g.fillRect(x, y, 1.5, 16);
      }
      // string course between floors
      g.fillStyle = w.trim;
      g.globalAlpha = 0.7;
      g.fillRect(0, 122, 256, 8);
      g.fillRect(0, 250, 256, 6);
      g.globalAlpha = 1;
      g.fillStyle = "rgba(0,0,0,0.15)";
      g.fillRect(0, 130, 256, 5);
    }
    for (let i = 0; i < 4; i++) {
      const x = (i % 2) * 128 + 36;
      const y = Math.floor(i / 2) * 128 + 24;
      const lit = hash01(i * 3 + style * 7 + w.id) > (night(w) ? 0.3 : 0.62);
      const arch = w.weather === "sand";
      const shape = (dx: number, dy: number, ww: number, hh: number) => {
        g.beginPath();
        if (arch) g.roundRect(dx, dy, ww, hh, [ww / 2, ww / 2, 0, 0]);
        else g.rect(dx, dy, ww, hh);
      };
      if (emissive) {
        if (lit) {
          g.fillStyle = w.windowOn;
          shape(x, y, 56, 80);
          g.fill();
        }
        continue;
      }
      g.fillStyle = "rgba(0,0,0,0.25)";
      shape(x - 6, y - 6, 68, 92);
      g.fill();
      g.fillStyle = w.trim;
      shape(x - 4, y - 4, 64, 88);
      g.fill();
      const glass = g.createLinearGradient(0, y, 0, y + 80);
      glass.addColorStop(0, lit ? w.windowOn : w.windowOff);
      glass.addColorStop(1, lit ? "#ffb35c" : "#1c2340");
      g.fillStyle = glass;
      shape(x, y, 56, 80);
      g.fill();
      g.save();
      shape(x, y, 56, 80);
      g.clip();
      if (lit) {
        g.fillStyle = "rgba(255,255,255,0.2)";
        g.fillRect(x, y, 12, 80);
        g.fillRect(x + 44, y, 12, 80);
      } else {
        g.fillStyle = "rgba(255,255,255,0.22)";
        g.beginPath();
        g.moveTo(x + 8, y + 80);
        g.lineTo(x + 32, y);
        g.lineTo(x + 46, y);
        g.lineTo(x + 22, y + 80);
        g.fill();
      }
      g.restore();
      if (!arch && w.weather !== "neon") {
        g.fillStyle = w.trim;
        g.fillRect(x + 26, y, 4, 80);
        g.fillRect(x, y + 36, 56, 4);
      }
      g.fillStyle = w.trim;
      g.fillRect(x - 10, y + 80, 76, 8);
      g.fillStyle = "rgba(0,0,0,0.2)";
      g.fillRect(x - 8, y + 88, 72, 5);
      if (w.weather === "sun" && hash01(i * 5 + style * 3) > 0.55) {
        g.fillStyle = "#8a5a3c";
        g.fillRect(x - 4, y + 70, 64, 14);
        const cols = ["#ff6b8a", "#ffd166", "#ff8fab"];
        for (let k = 0; k < 7; k++) {
          g.fillStyle = "#4caf6a";
          g.beginPath();
          g.arc(x + 2 + k * 8.5, y + 68, 6, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = cols[k % 3] as string;
          g.beginPath();
          g.arc(x + 2 + k * 8.5, y + 65, 3, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  });
}

/** Rooftop walking surface: 2 m tile. */
export function roofTexture(w: WorldDef) {
  return tex(`roof:${w.id}`, 128, 128, (g) => {
    const snow = w.weather === "snow";
    g.fillStyle = snow ? "#f4f8ff" : w.weather === "sky" ? "#f2f4ff" : w.roof;
    g.fillRect(0, 0, 128, 128);
    // tar seams / tiles
    g.fillStyle = snow ? "rgba(150,170,220,0.18)" : "rgba(0,0,0,0.12)";
    for (let y = 0; y < 128; y += 32) g.fillRect(0, y, 128, 2);
    for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 ? 0 : 32; x < 128; x += 64) g.fillRect(x, y, 2, 32);
    for (let k = 0; k < 220; k++) {
      g.fillStyle = hash01(k * 1.3) > 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
      g.fillRect(hash01(k * 2.1) * 128, hash01(k * 3.7) * 128, 2, 2);
    }
  });
}

export function woodTexture() {
  return tex("wood", 128, 128, (g) => {
    g.fillStyle = "#b07a4a";
    g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 32) {
      g.fillStyle = y % 64 ? "#a06c3e" : "#ba8554";
      g.fillRect(0, y, 128, 30);
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(0, y + 30, 128, 2);
      g.strokeStyle = "rgba(90,50,20,0.25)";
      g.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(0, y + 6 + k * 8);
        g.bezierCurveTo(40, y + 2 + k * 8, 80, y + 12 + k * 8, 128, y + 6 + k * 8);
        g.stroke();
      }
    }
  });
}

export function crateTexture() {
  return tex("crate", 128, 128, (g) => {
    g.fillStyle = "#c08a52";
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#9a6638";
    g.fillRect(0, 0, 128, 14);
    g.fillRect(0, 114, 128, 14);
    g.fillRect(0, 0, 14, 128);
    g.fillRect(114, 0, 14, 128);
    g.save();
    g.translate(64, 64);
    g.rotate(Math.PI / 4);
    g.fillRect(-80, -8, 160, 16);
    g.restore();
    g.fillStyle = "rgba(0,0,0,0.2)";
    g.fillRect(14, 14, 100, 3);
    g.fillStyle = "#6b4a2e";
    for (const [x, y] of [[7, 7], [121, 7], [7, 121], [121, 121]]) {
      g.beginPath();
      g.arc(x as number, y as number, 3, 0, Math.PI * 2);
      g.fill();
    }
  }, false);
}

export function brickTexture() {
  return tex("brick", 128, 128, (g) => {
    g.fillStyle = "#b5503a";
    g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 16) {
      for (let x = (y / 16) % 2 ? -16 : 0; x < 128; x += 32) {
        g.fillStyle = hash01(x * 0.3 + y * 1.7) > 0.5 ? "#c4614a" : "#a64532";
        g.fillRect(x + 1, y + 1, 30, 14);
      }
    }
  });
}

export function metalTexture() {
  return tex("metal", 128, 128, (g) => {
    g.fillStyle = "#cfd5de";
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#9aa3b2";
    g.fillRect(6, 6, 116, 116);
    g.fillStyle = "#2b3140";
    g.beginPath();
    g.arc(64, 64, 46, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#9aa3b2";
    g.lineWidth = 5;
    for (let r = 14; r < 46; r += 10) {
      g.beginPath();
      g.arc(64, 64, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = "#cfd5de";
    for (let k = 0; k < 3; k++) {
      g.save();
      g.translate(64, 64);
      g.rotate((k * Math.PI * 2) / 3);
      g.beginPath();
      g.ellipse(0, -20, 9, 20, 0.3, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }, false);
}

export function stripesTexture(w: WorldDef) {
  return tex(`stripes:${w.id}`, 128, 16, (g) => {
    for (let k = 0; k < 4; k++) {
      g.fillStyle = k % 2 ? "#fff2d6" : w.accent;
      g.fillRect(k * 32, 0, 32, 16);
    }
  });
}

export function chevronTexture(w: WorldDef) {
  return tex(`chev:${w.id}`, 128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = w.accent;
    g.globalAlpha = 0.9;
    g.beginPath();
    g.moveTo(14, 96);
    g.lineTo(64, 34);
    g.lineTo(114, 96);
    g.lineTo(88, 96);
    g.lineTo(64, 66);
    g.lineTo(40, 96);
    g.closePath();
    g.fill();
  });
}

export function checkerTexture() {
  return tex("checker", 256, 64, (g) => {
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 4; y++) {
        g.fillStyle = (x + y) % 2 ? "#1e1a22" : "#ffffff";
        g.fillRect(x * 16, y * 16, 16, 16);
      }
  }, false);
}

const SIGN_WORDS = ["FISH", "MEOW", "CAFE", "NAPS", "YARN", "MILK", "PURR"];

export function signTexture(w: WorldDef, id: number) {
  const word = SIGN_WORDS[id % SIGN_WORDS.length] as string;
  const neon = w.weather === "neon";
  return tex(`sign:${w.id}:${word}:${id % 2}`, 256, 96, (g) => {
    g.fillStyle = neon ? "#1b1640" : "#3b2a20";
    g.beginPath();
    g.roundRect(0, 0, 256, 96, 16);
    g.fill();
    const c = id % 2 ? w.accent : w.accent2;
    if (neon) {
      g.strokeStyle = c;
      g.lineWidth = 6;
      g.shadowColor = c;
      g.shadowBlur = 16;
      g.beginPath();
      g.roundRect(10, 10, 236, 76, 12);
      g.stroke();
      g.fillStyle = c;
    } else {
      g.fillStyle = "#ffe6b0";
      g.fillRect(10, 10, 236, 76);
      g.fillStyle = "#3b2a20";
    }
    g.font = "700 54px Fredoka, 'Trebuchet MS', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(word, 128, 52);
  }, false);
}

export function finishTexture() {
  return tex("finish", 512, 128, (g) => {
    for (let x = 0; x < 32; x++)
      for (let y = 0; y < 2; y++) {
        g.fillStyle = (x + y) % 2 ? "#1e1a22" : "#ffffff";
        g.fillRect(x * 16, y * 16, 16, 16);
        g.fillRect(x * 16, 96 + y * 16, 16, 16);
      }
    g.fillStyle = "#ff8a3d";
    g.fillRect(0, 32, 512, 64);
    g.font = "700 56px Fredoka, 'Trebuchet MS', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 8;
    g.strokeStyle = "#1e1a22";
    g.strokeText("FINISH", 256, 66);
    g.fillStyle = "#ffd166";
    g.fillText("FINISH", 256, 66);
  }, false);
}

/** Soft round glow used for the sun, power-up halos and lamp blooms. */
export function glowTexture(color: string) {
  return tex(`glow:${color}`, 128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, color);
    r.addColorStop(0.35, color);
    r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  }, false);
}

/** A texture from an arbitrary 2D painter (power-up icons etc.). */
export function paintedTexture(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  return tex(key, w, h, (g) => paint(g), false);
}
