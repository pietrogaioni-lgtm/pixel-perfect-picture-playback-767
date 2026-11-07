import { describe, expect, it } from "vitest";
import { generateLevel } from "../levelgen";
import { LEVELS } from "../levels";
import { validateAllLevels } from "../validate";
import { maxJumpReach } from "../physics";

describe("level data", () => {
  it("has 30 levels across 6 worlds of 5", () => {
    expect(LEVELS).toHaveLength(30);
    for (let w = 0; w < 6; w++) expect(LEVELS.filter((l) => l.world === w)).toHaveLength(5);
  });

  it("every level validates as beatable", () => {
    const results = validateAllLevels();
    const bad = results.filter((r) => !r.ok).map((r) => `L${r.levelId}: ${r.problems.slice(0, 3).join("; ")}`);
    expect(bad).toEqual([]);
  });

  it("generation is deterministic for a level's seed", () => {
    const a = generateLevel(LEVELS[4]!);
    const b = generateLevel(LEVELS[4]!);
    expect(a.platforms.map((p) => [p.x, p.y, p.w])).toEqual(b.platforms.map((p) => [p.x, p.y, p.w]));
  });

  it("first platform is always under the cat at spawn", () => {
    for (const def of LEVELS) {
      const l = generateLevel(def);
      const p = l.platforms.find((pl) => pl.x <= l.spawnX && pl.x + pl.w > l.spawnX + 40);
      expect(p?.y).toBe(l.spawnY);
    }
  });

  it("a double jump reaches further than a single jump", () => {
    expect(maxJumpReach(400, 0, { double: true })).toBeGreaterThan(maxJumpReach(400, 0, { double: false }) * 1.3);
  });
});
