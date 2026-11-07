import type { SaveData } from "./save";

export type Pattern = "tabby" | "solid" | "calico" | "siamese" | "tuxedo" | "robot" | "gold" | "rainbow" | "snow";
export type Gear = "none" | "headband" | "helmet" | "pirate" | "robot";

export interface SkinColors {
  body: string;
  shade: string;
  belly: string;
  stripe: string;
  earInner: string;
  eye: string;
  nose: string;
}

export interface Achievement {
  id: string;
  label: string;
  check: (s: SaveData) => boolean;
  progress: (s: SaveData) => [number, number];
}

export interface SkinDef {
  id: string;
  name: string;
  price: number | null; // null = achievement only
  achievement: Achievement | null;
  colors: SkinColors;
  pattern: Pattern;
  gear: Gear;
  rare: boolean;
}

export type AccSlot = "hat" | "scarf" | "glasses";

export interface AccessoryDef {
  id: string;
  name: string;
  slot: AccSlot;
  price: number;
  color: string;
  color2: string;
}

const starsTotal = (s: SaveData) =>
  Object.values(s.levels).reduce((n, l) => n + l.stars.filter(Boolean).length, 0);
const completed = (s: SaveData, upTo: number) => {
  let n = 0;
  for (let i = 1; i <= upTo; i++) if (s.levels[String(i)]?.completed) n++;
  return n;
};

export const SKINS: SkinDef[] = [
  {
    id: "classic",
    name: "Classic Orange Tabby",
    price: 0,
    achievement: null,
    colors: { body: "#f39a3b", shade: "#d9792a", belly: "#ffe2bf", stripe: "#c4621c", earInner: "#ffb3a7", eye: "#3a8f3a", nose: "#e96d7a" },
    pattern: "tabby",
    gear: "none",
    rare: false,
  },
  {
    id: "shadow",
    name: "Shadow Black Cat",
    price: 150,
    achievement: null,
    colors: { body: "#2b2b36", shade: "#1b1b24", belly: "#3a3a48", stripe: "#22222c", earInner: "#6c5470", eye: "#ffd23f", nose: "#9a6b80" },
    pattern: "solid",
    gear: "none",
    rare: false,
  },
  {
    id: "snow",
    name: "Snow Cat",
    price: 250,
    achievement: null,
    colors: { body: "#f7f8ff", shade: "#dfe3f2", belly: "#ffffff", stripe: "#e6e9f5", earInner: "#ffc4cf", eye: "#4fa8e8", nose: "#ff9aae" },
    pattern: "snow",
    gear: "none",
    rare: false,
  },
  {
    id: "calico",
    name: "Calico",
    price: 350,
    achievement: null,
    colors: { body: "#fbf3e6", shade: "#e8dcc8", belly: "#ffffff", stripe: "#e0832e", earInner: "#ffb9a8", eye: "#c58b1c", nose: "#e77b86" },
    pattern: "calico",
    gear: "none",
    rare: false,
  },
  {
    id: "siamese",
    name: "Siamese",
    price: 500,
    achievement: null,
    colors: { body: "#f1e2c8", shade: "#dcc6a2", belly: "#fbf2e2", stripe: "#5a3f2e", earInner: "#8a6450", eye: "#4aa3e0", nose: "#5a3f2e" },
    pattern: "siamese",
    gear: "none",
    rare: false,
  },
  {
    id: "tuxedo",
    name: "Tuxedo",
    price: 650,
    achievement: null,
    colors: { body: "#26262e", shade: "#18181e", belly: "#ffffff", stripe: "#1e1e26", earInner: "#e8a0b0", eye: "#7bd16b", nose: "#f0a0b0" },
    pattern: "tuxedo",
    gear: "none",
    rare: false,
  },
  {
    id: "ninja",
    name: "Ninja Cat",
    price: null,
    achievement: {
      id: "world2",
      label: "Clear Neon City Night (level 10)",
      check: (s) => !!s.levels["10"]?.completed,
      progress: (s) => [completed(s, 10), 10],
    },
    colors: { body: "#4a4f63", shade: "#363a4b", belly: "#6a7088", stripe: "#3a3e50", earInner: "#c48a9a", eye: "#ffe066", nose: "#a07080" },
    pattern: "solid",
    gear: "headband",
    rare: false,
  },
  {
    id: "space",
    name: "Space Cat",
    price: 1200,
    achievement: null,
    colors: { body: "#c9cfe0", shade: "#a8b0c8", belly: "#eef1f8", stripe: "#9aa3bd", earInner: "#f2b5c4", eye: "#6b5cff", nose: "#f08aa0" },
    pattern: "tabby",
    gear: "helmet",
    rare: false,
  },
  {
    id: "pirate",
    name: "Pirate Cat",
    price: null,
    achievement: {
      id: "world3",
      label: "Clear Rainy Harbor (level 15)",
      check: (s) => !!s.levels["15"]?.completed,
      progress: (s) => [completed(s, 15), 15],
    },
    colors: { body: "#9a6a44", shade: "#7a5034", belly: "#e7cfa8", stripe: "#5e3a22", earInner: "#e8a890", eye: "#3f8f5f", nose: "#c06a6a" },
    pattern: "tabby",
    gear: "pirate",
    rare: false,
  },
  {
    id: "robot",
    name: "Robot Cat",
    price: 1500,
    achievement: null,
    colors: { body: "#9fb4c7", shade: "#7d93a8", belly: "#d6e2ec", stripe: "#6c8094", earInner: "#ff8f6b", eye: "#3cf2ff", nose: "#ff8f6b" },
    pattern: "robot",
    gear: "robot",
    rare: false,
  },
  {
    id: "golden",
    name: "Golden Cat",
    price: null,
    achievement: {
      id: "stars45",
      label: "Earn 45 stars",
      check: (s) => starsTotal(s) >= 45,
      progress: (s) => [Math.min(45, starsTotal(s)), 45],
    },
    colors: { body: "#ffcf4a", shade: "#e6a91f", belly: "#fff1b8", stripe: "#d99412", earInner: "#ffb36b", eye: "#7a3cff", nose: "#e9796a" },
    pattern: "gold",
    gear: "none",
    rare: true,
  },
  {
    id: "rainbow",
    name: "Rainbow Cat",
    price: null,
    achievement: {
      id: "allclear",
      label: "Clear all 30 levels",
      check: (s) => completed(s, 30) >= 30,
      progress: (s) => [completed(s, 30), 30],
    },
    colors: { body: "#ff7eb6", shade: "#e05f98", belly: "#fff0f8", stripe: "#7a5cff", earInner: "#ffd1e6", eye: "#2b2b8f", nose: "#ff5c8a" },
    pattern: "rainbow",
    gear: "none",
    rare: true,
  },
];

export const ACCESSORIES: AccessoryDef[] = [
  { id: "party", name: "Party Hat", slot: "hat", price: 120, color: "#ff5c8a", color2: "#ffd166" },
  { id: "beret", name: "Beret", slot: "hat", price: 180, color: "#d64045", color2: "#8a1c22" },
  { id: "tophat", name: "Top Hat", slot: "hat", price: 300, color: "#26262e", color2: "#d64045" },
  { id: "crown", name: "Tiny Crown", slot: "hat", price: 600, color: "#ffd166", color2: "#ff5c8a" },
  { id: "redscarf", name: "Red Scarf", slot: "scarf", price: 100, color: "#e63946", color2: "#b71f2c" },
  { id: "stripescarf", name: "Striped Scarf", slot: "scarf", price: 160, color: "#3fb59a", color2: "#fff6e6" },
  { id: "shades", name: "Cool Shades", slot: "glasses", price: 140, color: "#1b1b24", color2: "#5a6a8a" },
  { id: "hearts", name: "Heart Glasses", slot: "glasses", price: 220, color: "#ff5c8a", color2: "#ffd1e6" },
];

export function getSkin(id: string): SkinDef {
  return SKINS.find((s) => s.id === id) ?? (SKINS[0] as SkinDef);
}

export function getAccessory(id: string | null): AccessoryDef | null {
  if (!id) return null;
  return ACCESSORIES.find((a) => a.id === id) ?? null;
}

/** Skins whose achievement is met but are not yet owned. */
export function newlyEarnedSkins(s: SaveData): SkinDef[] {
  return SKINS.filter((k) => k.achievement && !s.ownedSkins.includes(k.id) && k.achievement.check(s));
}

export function gearHidesHat(g: Gear): boolean {
  return g === "helmet" || g === "pirate" || g === "robot";
}
