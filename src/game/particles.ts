export const Shape = {
  Circle: 0,
  Rect: 1,
  Star: 2,
  Ring: 3,
  Line: 4,
} as const;
export type Shape = (typeof Shape)[keyof typeof Shape];

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: string;
  shape: Shape;
  gravity: number;
  drag: number;
  rot: number;
  vr: number;
  alpha: number;
  additive: boolean;
}

export interface SpawnOpts {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  life?: number;
  size?: number;
  grow?: number;
  color?: string;
  shape?: Shape;
  gravity?: number;
  drag?: number;
  rot?: number;
  vr?: number;
  alpha?: number;
  additive?: boolean;
}

/** Fixed-capacity particle pool. When full, the oldest slot is recycled. */
export class ParticlePool {
  readonly items: Particle[] = [];
  private cursor = 0;
  constructor(public cap: number) {
    for (let i = 0; i < cap; i++) {
      this.items.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        max: 1,
        size: 4,
        grow: 0,
        color: "#fff",
        shape: Shape.Circle,
        gravity: 0,
        drag: 0,
        rot: 0,
        vr: 0,
        alpha: 1,
        additive: false,
      });
    }
  }

  spawn(o: SpawnOpts) {
    let p: Particle | undefined;
    for (let n = 0; n < this.cap; n++) {
      const idx = (this.cursor + n) % this.cap;
      const c = this.items[idx];
      if (c && !c.active) {
        p = c;
        this.cursor = (idx + 1) % this.cap;
        break;
      }
    }
    if (!p) {
      p = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % this.cap;
    }
    if (!p) return;
    p.active = true;
    p.x = o.x;
    p.y = o.y;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? 0;
    p.life = o.life ?? 0.6;
    p.max = p.life;
    p.size = o.size ?? 4;
    p.grow = o.grow ?? 0;
    p.color = o.color ?? "#ffffff";
    p.shape = o.shape ?? Shape.Circle;
    p.gravity = o.gravity ?? 0;
    p.drag = o.drag ?? 0;
    p.rot = o.rot ?? 0;
    p.vr = o.vr ?? 0;
    p.alpha = o.alpha ?? 1;
    p.additive = o.additive ?? false;
  }

  update(dt: number) {
    for (const p of this.items) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dt;
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.size = Math.max(0, p.size + p.grow * dt);
    }
  }

  clear() {
    for (const p of this.items) p.active = false;
  }

  count(): number {
    let n = 0;
    for (const p of this.items) if (p.active) n++;
    return n;
  }
}

export interface FloatText {
  active: boolean;
  text: string;
  x: number;
  y: number;
  life: number;
  max: number;
  color: string;
  size: number;
  screen: boolean; // screen space (centre pops) vs world space
}

export class TextPool {
  readonly items: FloatText[] = [];
  constructor(cap: number) {
    for (let i = 0; i < cap; i++)
      this.items.push({ active: false, text: "", x: 0, y: 0, life: 0, max: 1, color: "#fff", size: 24, screen: false });
  }
  spawn(text: string, x: number, y: number, color: string, size = 26, screen = false, life = 0.9) {
    let t = this.items.find((i) => !i.active);
    if (!t) t = this.items.reduce((a, b) => (a.life < b.life ? a : b));
    t.active = true;
    t.text = text;
    t.x = x;
    t.y = y;
    t.life = life;
    t.max = life;
    t.color = color;
    t.size = size;
    t.screen = screen;
  }
  update(dt: number) {
    for (const t of this.items) {
      if (!t.active) continue;
      t.life -= dt;
      if (!t.screen) t.y -= 40 * dt;
      if (t.life <= 0) t.active = false;
    }
  }
  clear() {
    for (const t of this.items) t.active = false;
  }
}
