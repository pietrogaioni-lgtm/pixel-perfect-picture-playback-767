import type { Surface } from "./types";

export type Weather = "sun" | "neon" | "rain" | "snow" | "sand" | "sky";

export interface MusicDef {
  bpm: number;
  root: number; // midi note
  scale: number[]; // semitone offsets
  progression: number[]; // scale degrees per bar
  lead: OscillatorType;
  bass: OscillatorType;
  swing: number;
  seed: number;
}

export interface WorldDef {
  id: number;
  name: string;
  tagline: string;
  weather: Weather;
  sky: [string, string, string];
  sun: string;
  far: string;
  mid: string;
  near: string;
  bodies: string[];
  bodyDark: string;
  trim: string;
  windowOff: string;
  windowOn: string;
  roof: string;
  accent: string;
  accent2: string;
  grade: string; // full screen colour grade overlay
  vignette: number;
  fog: string;
  surface: Surface;
  music: MusicDef;
}

export const WORLDS: WorldDef[] = [
  {
    id: 0,
    name: "Sunny Suburbs",
    tagline: "Warm tiles, lazy pigeons and plenty of fish.",
    weather: "sun",
    sky: ["#6ec6ff", "#a8e0ff", "#fff1d0"],
    sun: "#fff3b0",
    far: "#9cc9df",
    mid: "#7fb2c9",
    near: "#5d8fa8",
    bodies: ["#e9876a", "#f2b880", "#7cc6b5", "#e7a4a0"],
    bodyDark: "#a65a48",
    trim: "#fff6e6",
    windowOff: "#4f7d96",
    windowOn: "#ffe9a8",
    roof: "#c96a52",
    accent: "#ff8a3d",
    accent2: "#3fb59a",
    grade: "rgba(255, 220, 160, 0.06)",
    vignette: 0.22,
    fog: "rgba(255, 244, 220, 0.35)",
    surface: "normal",
    music: {
      bpm: 112,
      root: 60,
      scale: [0, 2, 4, 7, 9],
      progression: [0, 3, 4, 2],
      lead: "triangle",
      bass: "sine",
      swing: 0.08,
      seed: 11,
    },
  },
  {
    id: 1,
    name: "Neon City Night",
    tagline: "Glowing signs, humming wires, moving lifts.",
    weather: "neon",
    sky: ["#0d0b2e", "#2b1a5c", "#a1366f"],
    sun: "#ffe0f0",
    far: "#241c4f",
    mid: "#1b1640",
    near: "#120f2e",
    bodies: ["#2c2466", "#33275e", "#1f2f5c", "#3a2350"],
    bodyDark: "#141033",
    trim: "#3cf2ff",
    windowOff: "#221d4a",
    windowOn: "#ffd36b",
    roof: "#191440",
    accent: "#ff4fb8",
    accent2: "#3cf2ff",
    grade: "rgba(60, 20, 120, 0.12)",
    vignette: 0.42,
    fog: "rgba(160, 60, 160, 0.18)",
    surface: "normal",
    music: {
      bpm: 124,
      root: 57,
      scale: [0, 3, 5, 7, 10],
      progression: [0, 5, 3, 4],
      lead: "square",
      bass: "sawtooth",
      swing: 0,
      seed: 23,
    },
  },
  {
    id: 2,
    name: "Rainy Harbor",
    tagline: "Slick roofs, cheeky gulls and rolling thunder.",
    weather: "rain",
    sky: ["#3c5468", "#5f7a8c", "#9fb3b8"],
    sun: "#e6f0f2",
    far: "#536b7a",
    mid: "#435a69",
    near: "#334754",
    bodies: ["#5b7486", "#8a6a58", "#6e7f6a", "#7b6f8a"],
    bodyDark: "#33424e",
    trim: "#d8e4e8",
    windowOff: "#2c3b47",
    windowOn: "#ffd98a",
    roof: "#3b4b57",
    accent: "#ffb23d",
    accent2: "#8fd3e8",
    grade: "rgba(40, 80, 110, 0.12)",
    vignette: 0.38,
    fog: "rgba(180, 200, 210, 0.3)",
    surface: "wet",
    music: {
      bpm: 96,
      root: 62,
      scale: [0, 2, 3, 7, 9],
      progression: [0, 3, 0, 4],
      lead: "triangle",
      bass: "triangle",
      swing: 0.12,
      seed: 37,
    },
  },
  {
    id: 3,
    name: "Snowy Old Town",
    tagline: "Frosty chimneys, icy tiles and falling icicles.",
    weather: "snow",
    sky: ["#4b5c9a", "#9aa6d6", "#f3d8e4"],
    sun: "#fff4e6",
    far: "#aab3d9",
    mid: "#8892c2",
    near: "#6670a6",
    bodies: ["#a7674f", "#d9c3a5", "#8d5a6a", "#6b7fa8"],
    bodyDark: "#5c3d36",
    trim: "#ffffff",
    windowOff: "#3d466e",
    windowOn: "#ffcf7a",
    roof: "#f4f7ff",
    accent: "#ff7a6b",
    accent2: "#8ad6ff",
    grade: "rgba(140, 160, 255, 0.08)",
    vignette: 0.3,
    fog: "rgba(240, 240, 255, 0.35)",
    surface: "normal",
    music: {
      bpm: 104,
      root: 65,
      scale: [0, 2, 4, 6, 7, 9, 11],
      progression: [0, 4, 5, 3],
      lead: "sine",
      bass: "triangle",
      swing: 0.05,
      seed: 41,
    },
  },
  {
    id: 4,
    name: "Desert Bazaar Rooftops",
    tagline: "Sunset winds, rope bridges and bouncy awnings.",
    weather: "sand",
    sky: ["#ff9a5a", "#ffc27a", "#ffe6b0"],
    sun: "#fff0c0",
    far: "#e8a46c",
    mid: "#d48a58",
    near: "#b56c44",
    bodies: ["#e4b47c", "#d98f5c", "#f0cc94", "#c97e5a"],
    bodyDark: "#9a5a3a",
    trim: "#fff2d6",
    windowOff: "#7a4630",
    windowOn: "#ffd27a",
    roof: "#c98552",
    accent: "#e2453c",
    accent2: "#2fa7a0",
    grade: "rgba(255, 140, 60, 0.1)",
    vignette: 0.34,
    fog: "rgba(255, 210, 150, 0.35)",
    surface: "sand",
    music: {
      bpm: 116,
      root: 64,
      scale: [0, 1, 4, 5, 7, 8, 10],
      progression: [0, 0, 6, 0],
      lead: "sawtooth",
      bass: "sine",
      swing: 0.1,
      seed: 53,
    },
  },
  {
    id: 5,
    name: "Sky Fortress",
    tagline: "Floating stones, updrafts and one very big vacuum.",
    weather: "sky",
    sky: ["#5aa0f0", "#a9d4ff", "#f4fbff"],
    sun: "#ffffff",
    far: "#c8e2fb",
    mid: "#b0d0f0",
    near: "#e8f4ff",
    bodies: ["#e8e4f2", "#d6dcef", "#efe6d8", "#cfd8ea"],
    bodyDark: "#8f96b8",
    trim: "#ffd166",
    windowOff: "#7b84aa",
    windowOn: "#bfe8ff",
    roof: "#b7bfdc",
    accent: "#ffd166",
    accent2: "#6ad1ff",
    grade: "rgba(200, 230, 255, 0.08)",
    vignette: 0.2,
    fog: "rgba(255, 255, 255, 0.4)",
    surface: "cloud",
    music: {
      bpm: 132,
      root: 67,
      scale: [0, 2, 4, 6, 7, 9, 11],
      progression: [0, 1, 4, 5],
      lead: "triangle",
      bass: "square",
      swing: 0,
      seed: 67,
    },
  },
];

export function worldOf(levelId: number): WorldDef {
  const w = WORLDS[Math.floor((levelId - 1) / 5)];
  return w ?? (WORLDS[0] as WorldDef);
}
