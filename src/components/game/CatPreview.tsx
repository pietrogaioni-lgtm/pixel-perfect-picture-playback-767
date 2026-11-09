import { useEffect, useRef } from "react";
import { drawCat, type CatPose } from "@/game/render/cat";

interface Props {
  skin: string;
  hat: string | null;
  scarf: string | null;
  glasses: string | null;
  pose?: CatPose;
  className?: string;
  scale?: number;
}

/** Small looping canvas that shows the cat running with the chosen skin/accessories. */
export function CatPreview({ skin, hat, scarf, glasses, pose = "run", className, scale = 2.2 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const props = useRef({ skin, hat, scarf, glasses, pose, scale });
  props.current = { skin, hat, scarf, glasses, pose, scale };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let alive = true;
    const start = performance.now();
    const loop = (now: number) => {
      if (!alive) return;
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const t = (now - start) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cw = r.width;
      const ch = r.height;
      const p = props.current;
      // ground strip
      ctx.fillStyle = "rgba(40,30,70,0.15)";
      ctx.beginPath();
      ctx.ellipse(cw / 2, ch * 0.82, cw * 0.32, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      const s = Math.min(p.scale, (ch / 90) * 1.1);
      drawCat(ctx, {
        x: cw / 2 - 4 * s,
        y: ch * 0.82,
        pose: p.pose,
        t,
        phase: t * 2.4,
        vy: 0,
        squashX: 1,
        squashY: 1,
        flip: 0,
        skin: p.skin,
        hat: p.hat,
        scarf: p.scarf,
        glasses: p.glasses,
        scale: s,
        speed: 380,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-label="Cat preview" role="img" />;
}
