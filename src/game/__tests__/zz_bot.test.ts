import { it } from "vitest";
import { STEP } from "../constants";
import { Run } from "../engine";
import { LEVELS } from "../levels";

function bot(r: Run) {
  const p = r.player;
  const feet = p.y + p.h;
  let jump = false, slide = false, hold = false;
  const sp = p.vx;
  // current platform end
  const plats = r.layout.platforms.filter(pl => !pl.dead && pl.x + pl.w > p.x && pl.x < p.x + 900).sort((a,b)=>a.x-b.x);
  const cur = plats.find(pl => pl.x <= p.x + p.w && pl.x + pl.w >= p.x && Math.abs(pl.y - feet) < 4);
  if (cur) {
    const edge = cur.x + cur.w;
    const next = plats.find(pl => pl.x > edge - 1);
    const gap = next ? next.x - edge : 0;
    if (p.grounded && edge - (p.x + p.w) < 18 && edge - (p.x + p.w) > -10) jump = true;
    void gap;
  }
  for (const o of r.layout.obstacles) {
    if (o.dead || o.zone) continue;
    const dx = o.x - (p.x + p.w);
    if (dx < -o.w || dx > 200) continue;
    if ((o.kind === "sign" || o.kind === "laundry") && dx < 90 && dx > -o.w) slide = true;
    else if ((o.solid || o.hazard) && o.kind !== "sign" && o.kind !== "laundry" && dx < sp * 0.22 && dx > 0) jump = true;
  }
  if (!p.grounded && p.vy > 0 && p.jumpsUsed === 1) {
    // double jump if nothing below
    const below = plats.find(pl => pl.x <= p.x + p.w + sp*0.3 && pl.x + pl.w >= p.x && pl.y >= feet - 5 && pl.y - feet < 260);
    if (!below) jump = true;
  }
  hold = !p.grounded && p.vy < 0 || p.wallContact;
  if (p.wallContact && !p.wallRun) jump = true;
  return { jumpPressed: jump, jumpHeld: hold || jump, slidePressed: slide, slideHeld: slide };
}

it("bot", () => {
  for (const def of LEVELS) {
    const r = new Run(def);
    let n = 0;
    while ((r.state === "playing" || r.state === "complete") && n < 60 * 240) { r.update(STEP, bot(r)); n++; }
    console.log(def.id, r.state, "dist", Math.floor(r.distance), "/", def.distance, r.deathCause ?? "", "x", Math.floor(r.player.x), "fish", r.fishCount, "/", r.layout.totalFish);
  }
});
