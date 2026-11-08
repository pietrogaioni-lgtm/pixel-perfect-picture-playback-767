import { MAX_FRAME_TIME, MAX_STEPS_PER_FRAME, STEP } from "./constants";

/**
 * requestAnimationFrame loop with a fixed 60 Hz simulation step (delta-time accumulator).
 * Gameplay is identical on 60/120/144 Hz screens; rendering interpolates between steps.
 * Frame time is clamped so returning from a background tab never teleports anything.
 */
export class FixedLoop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;
  fps = 0;
  ups = 0;
  private fpsFrames = 0;
  private fpsSteps = 0;
  private fpsTime = 0;

  constructor(
    private update: (dt: number) => void,
    private render: (alpha: number, frameDt: number) => void,
    private timeScale: () => number,
  ) {}

  get isRunning() {
    return this.running;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Forget accumulated time (e.g. after a pause) so no burst of catch-up steps runs. */
  resetClock() {
    this.last = performance.now();
    this.acc = 0;
  }

  private tick = (now: number) => {
    if (!this.running) return;
    let frame = (now - this.last) / 1000;
    this.last = now;
    if (!Number.isFinite(frame) || frame < 0) frame = 0;
    if (frame > MAX_FRAME_TIME) frame = MAX_FRAME_TIME;
    const scale = Math.max(0, Math.min(1, this.timeScale()));
    this.acc += frame * scale;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS_PER_FRAME) {
      this.update(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps >= MAX_STEPS_PER_FRAME) this.acc = 0; // spiral-of-death guard
    this.fpsFrames++;
    this.fpsSteps += steps;
    this.fpsTime += frame;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.ups = Math.round(this.fpsSteps / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsSteps = 0;
      this.fpsTime = 0;
    }
    this.render(this.acc / STEP, frame);
    if (this.running) this.raf = requestAnimationFrame(this.tick);
  };
}
