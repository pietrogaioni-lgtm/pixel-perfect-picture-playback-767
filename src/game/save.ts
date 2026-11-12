/**
import { platformStorage } from "./platform";
 * Versioned save system. Storage access is always wrapped in try/catch and falls back
 * to in-memory state, and corrupted data resets field-by-field to safe defaults.
 */
import { DAILY_REWARD } from "./constants";

export const SAVE_KEY = "whisker-rooftops-save";
export const SAVE_VERSION = 1;

export interface LevelProgress {
  stars: [boolean, boolean, boolean];
  best: number; // metres
  bestScore: number;
  completed: boolean;
}

export interface Settings {
  music: boolean;
  sfx: boolean;
  shake: boolean;
  quality: "high" | "low";
}

export interface SaveData {
  version: number;
  fish: number;
  unlocked: number;
  levels: Record<string, LevelProgress>;
  ownedSkins: string[];
  skin: string;
  ownedAcc: string[];
  hat: string | null;
  scarf: string | null;
  glasses: string | null;
  settings: Settings;
  daily: { lastDay: string; lastTs: number; streak: number };
  stats: { totalFish: number; jumps: number; runs: number; bestCombo: number };
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    fish: 0,
    unlocked: 1,
    levels: {},
    ownedSkins: ["classic"],
    skin: "classic",
    ownedAcc: [],
    hat: null,
    scarf: null,
    glasses: null,
    settings: { music: true, sfx: true, shake: true, quality: "high" },
    daily: { lastDay: "", lastTs: 0, streak: 0 },
    stats: { totalFish: 0, jumps: 0, runs: 0, bestCombo: 0 },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number, min = 0, max = 1e12) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : d;
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const str = (v: unknown, d: string) => (typeof v === "string" && v.length < 64 ? v : d);
const strOrNull = (v: unknown) => (typeof v === "string" && v.length < 64 ? v : null);
const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 100) : []);

/** Accepts anything (parsed JSON, garbage, null) and always returns a valid SaveData. */
export function sanitizeSave(raw: unknown): SaveData {
  const d = defaultSave();
  if (!isObj(raw)) return d;
  const out = defaultSave();
  out.fish = Math.floor(num(raw["fish"], d.fish));
  const un = raw["unlocked"];
  out.unlocked = typeof un === "number" && Number.isInteger(un) && un >= 1 && un <= 30 ? un : 1;
  if (isObj(raw["levels"])) {
    for (const [k, v] of Object.entries(raw["levels"])) {
      const id = Number(k);
      if (!Number.isInteger(id) || id < 1 || id > 30 || !isObj(v)) continue;
      const st = Array.isArray(v["stars"]) ? v["stars"] : [];
      out.levels[String(id)] = {
        stars: [st[0] === true, st[1] === true, st[2] === true],
        best: num(v["best"], 0),
        bestScore: num(v["bestScore"], 0),
        completed: bool(v["completed"], false),
      };
    }
  }
  out.ownedSkins = Array.from(new Set(["classic", ...strArr(raw["ownedSkins"])]));
  out.skin = str(raw["skin"], "classic");
  if (!out.ownedSkins.includes(out.skin)) out.skin = "classic";
  out.ownedAcc = Array.from(new Set(strArr(raw["ownedAcc"])));
  for (const slot of ["hat", "scarf", "glasses"] as const) {
    const v = strOrNull(raw[slot]);
    out[slot] = v && out.ownedAcc.includes(v) ? v : null;
  }
  const s = isObj(raw["settings"]) ? raw["settings"] : {};
  out.settings = {
    music: bool(s["music"], true),
    sfx: bool(s["sfx"], true),
    shake: bool(s["shake"], true),
    quality: s["quality"] === "low" ? "low" : "high",
  };
  const dl = isObj(raw["daily"]) ? raw["daily"] : {};
  out.daily = { lastDay: str(dl["lastDay"], ""), lastTs: num(dl["lastTs"], 0), streak: Math.floor(num(dl["streak"], 0, 0, 10000)) };
  const stt = isObj(raw["stats"]) ? raw["stats"] : {};
  out.stats = {
    totalFish: num(stt["totalFish"], 0),
    jumps: num(stt["jumps"], 0),
    runs: num(stt["runs"], 0),
    bestCombo: num(stt["bestCombo"], 0),
  };
  // Unlocks are at least one past the furthest completed level.
  for (let i = 1; i <= 30; i++) if (out.levels[String(i)]?.completed) out.unlocked = Math.max(out.unlocked, Math.min(30, i + 1));
  return out;
}

export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** localStorage when available, otherwise (or when it throws) an in-memory map. */
export function createSafeStorage(): KeyValueStorage {
  const memory = new Map<string, string>();
  // On CrazyGames, saves go through their data module (synced to the player's account).
  const cg = platformStorage();
  if (cg) {
    return {
      get(key) {
        try {
          const v = cg.getItem(key);
          if (v !== null && v !== undefined) return v;
        } catch {
          /* fall through */
        }
        // first launch on the platform: pick up an existing local save
        try {
          const v = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
          if (v !== null) return v;
        } catch {
          /* blocked */
        }
        return memory.get(key) ?? null;
      },
      set(key, value) {
        memory.set(key, value);
        try {
          cg.setItem(key, value);
        } catch {
          /* keep the in-memory copy */
        }
      },
    };
  }
  const ls = (): Storage | null => {
    try {
      if (typeof window === "undefined") return null;
      const s = window.localStorage;
      return s ?? null;
    } catch {
      return null;
    }
  };
  return {
    get(key) {
      try {
        const s = ls();
        if (s) {
          const v = s.getItem(key);
          if (v !== null) return v;
        }
      } catch {
        /* storage blocked */
      }
      return memory.get(key) ?? null;
    },
    set(key, value) {
      memory.set(key, value);
      try {
        ls()?.setItem(key, value);
      } catch {
        /* quota / private mode: keep the in-memory copy */
      }
    },
  };
}

export function loadSave(storage: KeyValueStorage): SaveData {
  try {
    const raw = storage.get(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed: unknown = JSON.parse(raw);
    if (isObj(parsed) && typeof parsed["version"] === "number" && parsed["version"] > SAVE_VERSION) {
      // Save from a newer version: keep what we understand.
      return sanitizeSave(parsed);
    }
    return sanitizeSave(parsed);
  } catch {
    return defaultSave();
  }
}

export function writeSave(storage: KeyValueStorage, data: SaveData) {
  try {
    storage.set(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- daily reward

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TWO_DAYS = 2 * 24 * 3600 * 1000;

/**
 * Daily reward rules (safe against clock changes):
 *  - claimable once per local calendar day
 *  - never claimable if the clock is earlier than the last claim time (clock moved back)
 *  - a last-claim time more than 2 days in the future is treated as a clock error:
 *    it is reset to "claimed today", so moving the clock forward can't be farmed.
 */
export function dailyStatus(daily: SaveData["daily"], now: Date): { canClaim: boolean; repaired: SaveData["daily"] | null } {
  const t = now.getTime();
  if (!Number.isFinite(t)) return { canClaim: false, repaired: null };
  if (daily.lastTs > t + TWO_DAYS) {
    return { canClaim: false, repaired: { lastDay: dayKey(now), lastTs: t, streak: daily.streak } };
  }
  const canClaim = dayKey(now) !== daily.lastDay && t >= daily.lastTs;
  return { canClaim, repaired: null };
}

export function claimDaily(save: SaveData, now: Date): { save: SaveData; amount: number } {
  const st = dailyStatus(save.daily, now);
  if (!st.canClaim) return { save: st.repaired ? { ...save, daily: st.repaired } : save, amount: 0 };
  const yesterday = new Date(now.getTime());
  yesterday.setDate(yesterday.getDate() - 1);
  const streak = save.daily.lastDay === dayKey(yesterday) ? save.daily.streak + 1 : 1;
  const amount = DAILY_REWARD + Math.min(streak - 1, 6) * 10;
  return {
    save: { ...save, fish: save.fish + amount, daily: { lastDay: dayKey(now), lastTs: now.getTime(), streak } },
    amount,
  };
}

// ---------------------------------------------------------------- store

type Listener = () => void;

export class SaveStore {
  private data: SaveData;
  private listeners = new Set<Listener>();
  constructor(private storage: KeyValueStorage) {
    this.data = loadSave(storage);
  }
  get = (): SaveData => this.data;
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  update(fn: (s: SaveData) => SaveData) {
    try {
      this.data = sanitizeSave(fn(this.data));
    } catch (e) {
      console.warn("save update failed", e);
      return;
    }
    writeSave(this.storage, this.data);
    for (const l of this.listeners) l();
  }
  reset() {
    this.update(() => defaultSave());
  }
}

let store: SaveStore | null = null;
export function getSaveStore(): SaveStore {
  if (!store) store = new SaveStore(createSafeStorage());
  return store;
}
