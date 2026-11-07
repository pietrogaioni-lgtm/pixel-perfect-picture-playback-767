export type Surface = "normal" | "wet" | "ice" | "sand" | "cloud";

export type PlatformKind =
  | "building" // solid block that extends to the bottom of the world
  | "float" // solid finite floating island
  | "thin" // one-way plank
  | "crumble" // one-way, collapses after landing
  | "moving" // one-way, moves vertically
  | "bridge" // one-way rope bridge spanning a gap
  | "awning"; // one-way bounce pad

export interface Platform {
  id: number;
  kind: PlatformKind;
  x: number;
  y: number; // top
  w: number;
  h: number;
  baseY: number;
  prevY: number;
  surface: Surface;
  style: number;
  moveRange: number;
  moveSpeed: number;
  movePhase: number;
  crumbleState: 0 | 1 | 2; // intact, shaking, falling
  crumbleTimer: number;
  vy: number;
  wall: boolean; // designed as a wall-run wall (hint + visuals)
  dead: boolean;
}

export type ObstacleKind =
  | "chimney"
  | "ac"
  | "crate"
  | "antenna"
  | "laundry"
  | "sign"
  | "puddle"
  | "pigeon"
  | "seagull"
  | "icicle"
  | "ice"
  | "gust"
  | "wind";

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  x: number;
  y: number;
  w: number;
  h: number;
  baseX: number;
  baseY: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  solid: boolean; // can be stood on, blocks from the side
  hazard: boolean; // touching = hit
  zone: boolean; // puddle / wind / ice patch area effect
  forceX: number;
  forceY: number;
  state: number; // generic state machine slot
  timer: number;
  active: boolean; // birds start moving when near
  dead: boolean;
  passed: boolean;
  closest: number;
  style: number;
}

export type CollectibleKind = "fish" | "gold" | "star" | "magnet" | "shield" | "speed" | "super";

export interface Collectible {
  id: number;
  kind: CollectibleKind;
  x: number;
  y: number;
  baseY: number;
  phase: number;
  taken: boolean;
  attracted: boolean;
}

export type HintAction = "jump" | "hold" | "double" | "slide" | "wall" | "fish" | "power";

export interface Hint {
  x: number; // shown when player passes this x
  until: number; // auto hide when player passes this x
  text: string;
  touchText: string;
  action: HintAction;
  slowmo: boolean;
  slowFrom: number;
  shown: boolean;
  done: boolean;
}

export interface LevelLayout {
  platforms: Platform[];
  obstacles: Obstacle[];
  collectibles: Collectible[];
  hints: Hint[];
  finishX: number;
  spawnX: number;
  spawnY: number; // feet y
  totalFish: number;
  baseSpeed: number;
}

export type PowerKind = "magnet" | "shield" | "speed" | "super";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
