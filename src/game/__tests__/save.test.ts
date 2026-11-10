import { describe, expect, it } from "vitest";
import { DAILY_REWARD } from "../constants";
import { claimDaily, dailyStatus, dayKey, defaultSave, loadSave, sanitizeSave, SAVE_KEY, type KeyValueStorage } from "../save";

function mem(initial: Record<string, string> = {}): KeyValueStorage {
  const m = new Map(Object.entries(initial));
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
}

describe("save system", () => {
  it("corrupted JSON resets to defaults without throwing", () => {
    expect(loadSave(mem({ [SAVE_KEY]: "{not json" }))).toEqual(defaultSave());
  });

  it("storage that throws falls back to defaults", () => {
    const bad: KeyValueStorage = {
      get: () => {
        throw new Error("blocked");
      },
      set: () => {
        throw new Error("blocked");
      },
    };
    expect(loadSave(bad)).toEqual(defaultSave());
  });

  it("garbage fields are repaired individually", () => {
    const s = sanitizeSave({ fish: "lots", unlocked: 999, skin: "golden", ownedSkins: [1, "shadow"], levels: { "3": { stars: [true, "x", true], completed: true } } });
    expect(s.fish).toBe(0);
    expect(s.unlocked).toBe(4); // one past the furthest completed level
    expect(s.skin).toBe("classic"); // not owned
    expect(s.ownedSkins).toEqual(["classic", "shadow"]);
    expect(s.levels["3"]?.stars).toEqual([true, false, true]);
  });
});

describe("daily reward", () => {
  const day1 = new Date(2026, 10, 7, 10, 0, 0);
  const day2 = new Date(2026, 10, 8, 9, 0, 0);

  it("can be claimed once per local day", () => {
    const first = claimDaily(defaultSave(), day1);
    expect(first.amount).toBe(DAILY_REWARD);
    expect(claimDaily(first.save, new Date(2026, 10, 7, 22, 0, 0)).amount).toBe(0);
    expect(claimDaily(first.save, day2).amount).toBeGreaterThan(0);
  });

  it("is not claimable after moving the clock back before the last claim", () => {
    const claimed = claimDaily(defaultSave(), day2).save;
    expect(dailyStatus(claimed.daily, day1).canClaim).toBe(false);
  });

  it("a claim time far in the future is repaired to today, not farmed", () => {
    const daily = { lastDay: "2099-01-01", lastTs: new Date(2099, 0, 1).getTime(), streak: 1 };
    const st = dailyStatus(daily, day1);
    expect(st.canClaim).toBe(false);
    expect(st.repaired?.lastDay).toBe(dayKey(day1));
  });
});
