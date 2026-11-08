import type { InputFrame } from "./engine";

const JUMP_KEYS = new Set(["Space", "ArrowUp", "KeyW"]);
const SLIDE_KEYS = new Set(["ArrowDown", "KeyS"]);
const BLOCK_KEYS = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown"]);

export interface InputHandlers {
  onPause: () => void;
  onDebug: () => void;
  onGesture: () => void; // first interaction: unlock audio
}

interface PointerInfo {
  x: number;
  y: number;
  t: number;
  side: "left" | "right";
  swiped: boolean;
}

/**
 * Keyboard + touch/mouse input. Presses are latched until the next fixed update consumes
 * them, held state is tracked per key / pointer so simultaneous inputs work, and key
 * repeat never re-triggers a jump.
 */
export class Input {
  private jumpKeys = new Set<string>();
  private slideKeys = new Set<string>();
  private jumpPointers = new Set<number>();
  private slidePointers = new Set<number>();
  private pointers = new Map<number, PointerInfo>();
  private jumpPressed = false;
  private slidePressed = false;
  enabled = false;
  lastDevice: "keyboard" | "touch" = "keyboard";

  constructor(
    private surface: HTMLElement,
    private handlers: InputHandlers,
  ) {}

  attach() {
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.surface.addEventListener("pointerdown", this.onPointerDown, { passive: false });
    this.surface.addEventListener("pointermove", this.onPointerMove, { passive: false });
    this.surface.addEventListener("pointerup", this.onPointerUp);
    this.surface.addEventListener("pointercancel", this.onPointerUp);
    this.surface.addEventListener("lostpointercapture", this.onPointerUp);
    this.surface.addEventListener("contextmenu", this.prevent);
    window.addEventListener("pointerdown", this.onAnyGesture, { capture: true });
  }

  detach() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.surface.removeEventListener("pointerdown", this.onPointerDown);
    this.surface.removeEventListener("pointermove", this.onPointerMove);
    this.surface.removeEventListener("pointerup", this.onPointerUp);
    this.surface.removeEventListener("pointercancel", this.onPointerUp);
    this.surface.removeEventListener("lostpointercapture", this.onPointerUp);
    this.surface.removeEventListener("contextmenu", this.prevent);
    window.removeEventListener("pointerdown", this.onAnyGesture, { capture: true });
  }

  /** Clears every latched press and held input (used on restart / pause). */
  reset() {
    this.jumpKeys.clear();
    this.slideKeys.clear();
    this.jumpPointers.clear();
    this.slidePointers.clear();
    this.pointers.clear();
    this.jumpPressed = false;
    this.slidePressed = false;
  }

  /** Called once per fixed update. */
  frame(): InputFrame {
    const f: InputFrame = {
      jumpPressed: this.jumpPressed,
      jumpHeld: this.jumpKeys.size > 0 || this.jumpPointers.size > 0,
      slidePressed: this.slidePressed,
      slideHeld: this.slideKeys.size > 0 || this.slidePointers.size > 0,
    };
    this.jumpPressed = false;
    this.slidePressed = false;
    return f;
  }

  private prevent = (e: Event) => e.preventDefault();

  private isTypingTarget(e: Event) {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  }

  private onAnyGesture = () => this.handlers.onGesture();

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isTypingTarget(e)) return;
    this.handlers.onGesture();
    if (e.code === "F3") {
      e.preventDefault();
      this.handlers.onDebug();
      return;
    }
    if (e.code === "Escape" || e.code === "KeyP") {
      if (!e.repeat) this.handlers.onPause();
      return;
    }
    if (!this.enabled) return;
    if (BLOCK_KEYS.has(e.code)) e.preventDefault();
    this.lastDevice = "keyboard";
    if (JUMP_KEYS.has(e.code)) {
      if (!e.repeat && !this.jumpKeys.has(e.code)) this.jumpPressed = true;
      this.jumpKeys.add(e.code);
    } else if (SLIDE_KEYS.has(e.code)) {
      if (!e.repeat && !this.slideKeys.has(e.code)) this.slidePressed = true;
      this.slideKeys.add(e.code);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.jumpKeys.delete(e.code);
    this.slideKeys.delete(e.code);
  };

  private onBlur = () => {
    this.jumpKeys.clear();
    this.slideKeys.clear();
    this.jumpPointers.clear();
    this.slidePointers.clear();
  };

  private onPointerDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    if (e.pointerType !== "mouse") this.lastDevice = "touch";
    try {
      this.surface.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const r = this.surface.getBoundingClientRect();
    const side = e.clientX - r.left > r.width / 2 ? "right" : "left";
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), side, swiped: false });
    if (side === "right") {
      this.jumpPressed = true;
      this.jumpPointers.add(e.pointerId);
    } else {
      this.slidePressed = true;
      this.slidePointers.add(e.pointerId);
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p || p.swiped || !this.enabled) return;
    e.preventDefault();
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (dy > 40 && dy > Math.abs(dx) && performance.now() - p.t < 450) {
      p.swiped = true;
      this.slidePressed = true;
      this.jumpPointers.delete(e.pointerId); // a swipe is not a held jump
      this.slidePointers.add(e.pointerId);
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.jumpPointers.delete(e.pointerId);
    this.slidePointers.delete(e.pointerId);
  };
}
