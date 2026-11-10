import { describe, expect, it } from "vitest";
import { STEP } from "../constants";
import { Run, type InputFrame } from "../engine";
import { LEVELS } from "../levels";
import { sweepAABB } from "../physics";

const idle: InputFrame = { jumpPressed: false, jumpHeld: false, slidePressed: false, slideHeld: false };

describe("physics", () => {
  it("swept AABB catches a fast box before it tunnels through a thin platform", () => {
    const hit = sweepAABB({ x: 0, y: 0, w: 40, h: 44 }, 0, 400, { x: -10, y: 200, w: 100, h: 4 });
    expect(hit?.ny).toBe(-1);
    expect(hit!.t).toBeCloseTo((200 - 44) / 400, 5);
  });
});

describe("run simulation", () => {
  it("spawns the cat standing on the first platform", () => {
    const r = new Run(LEVELS[0]!);
    r.update(STEP, idle);
    expect(r.player.grounded).toBe(true);
    expect(r.player.y + r.player.h).toBeCloseTo(r.layout.spawnY, 3);
  });

  it("is deterministic and frame-rate independent (fixed step)", () => {
    const a = new Run(LEVELS[2]!);
    const b = new Run(LEVELS[2]!);
    for (let i = 0; i < 120; i++) a.update(STEP, idle);
    for (let i = 0; i < 120; i++) b.update(STEP, idle);
    expect(a.player.x).toBe(b.player.x);
    expect(a.player.y).toBe(b.player.y);
  });

  it("a held jump at the first gap clears it in level 1", () => {
    const r = new Run(LEVELS[0]!);
    const first = r.layout.platforms.find((p) => p.x <= r.layout.spawnX && p.x + p.w > r.layout.spawnX)!;
    const edge = first.x + first.w;
    let jumped = false;
    for (let i = 0; i < 60 * 8 && r.state === "playing"; i++) {
      const p = r.player;
      const press = !jumped && p.grounded && p.x + p.w > edge - 20;
      if (press) jumped = true;
      r.update(STEP, { ...idle, jumpPressed: press, jumpHeld: jumped && p.vy < 0 });
      if (r.player.x > edge + 400) break;
    }
    expect(r.state).toBe("playing");
    expect(r.player.x).toBeGreaterThan(edge + 300);
  });

  it("restarting creates completely fresh state", () => {
    const a = new Run(LEVELS[0]!);
    for (let i = 0; i < 300; i++) a.update(STEP, idle);
    const b = new Run(LEVELS[0]!);
    expect(b.fishCount).toBe(0);
    expect(b.particles.count()).toBe(0);
    expect(b.layout.collectibles.every((c) => !c.taken)).toBe(true);
    expect(b.powers.magnet + b.powers.shield + b.powers.speed + b.powers.super).toBe(0);
  });
});
