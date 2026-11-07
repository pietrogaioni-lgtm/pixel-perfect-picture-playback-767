/**
 * Integration hooks for a future ad / analytics SDK.
 *
 *   import { setGameHooks } from "@/game/hooks";
 *   setGameHooks({
 *     onEvent: (e) => sdk.track(e.type, e),
 *     requestRewardedRevive: () => sdk.showRewarded(), // resolve true when the reward was earned
 *   });
 *
 * Every event is also dispatched on window as a "whisker:event" CustomEvent.
 */
export type GameEvent =
  | { type: "game_started"; level: number }
  | { type: "game_over"; level: number; distance: number; cause: string }
  | { type: "level_complete"; level: number; stars: number; fish: number }
  | { type: "reward"; kind: "revive" | "daily"; amount: number };

export interface GameHooks {
  onEvent?: (e: GameEvent) => void;
  /** Optional rewarded-ad revive. When provided, a "Watch to revive" option can be wired to it. */
  requestRewardedRevive?: () => Promise<boolean>;
}

let hooks: GameHooks = {};

export function setGameHooks(h: GameHooks) {
  hooks = h;
}

export function getGameHooks(): GameHooks {
  return hooks;
}

export function emitGameEvent(e: GameEvent) {
  try {
    hooks.onEvent?.(e);
  } catch (err) {
    console.warn("game hook failed", err);
  }
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("whisker:event", { detail: e }));
  } catch {
    /* ignore */
  }
}
