// Logical resolution (16:9). Everything in the game is simulated and drawn in these units.
export const VIEW_W = 1280;
export const VIEW_H = 720;

// Fixed timestep: 60 simulation updates per second regardless of display refresh rate.
export const STEP = 1 / 60;
export const MAX_FRAME_TIME = 0.25; // clamp after tab switches so nothing teleports
export const MAX_STEPS_PER_FRAME = 6;

// Movement feel (pixels, seconds).
export const GRAVITY = 2400;
export const HOLD_GRAVITY_MULT = 0.6; // lower gravity while jump is held and rising
export const MAX_HOLD_TIME = 0.32; // how long holding jump keeps lowering gravity
export const JUMP_VELOCITY = 760;
export const DOUBLE_JUMP_VELOCITY = 700;
export const SUPER_JUMP_MULT = 1.28;
export const MAX_FALL_SPEED = 1500;
export const FAST_FALL_SPEED = 1150;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER_TIME = 0.1;
export const BOUNCE_VELOCITY = 1180;

export const PLAYER_W = 40;
export const PLAYER_H = 44;
export const SLIDE_H = 22;
export const SLIDE_TIME = 0.6;
export const SLIDE_TIME_ICE = 0.9;

export const WALLRUN_SPEED = 640;
export const WALLRUN_MAX_TIME = 0.8;
export const WALL_SLIDE_SPEED = 220;
export const LEDGE_TOLERANCE = 34;

export const RUN_ACCEL = 900; // px/s² toward target speed on normal ground
export const RUN_ACCEL_SLIPPERY = 260;
export const SPEED_RAMP = 0.18; // speed grows by this fraction over a level
export const PUDDLE_SLOW = 0.72;
export const PUDDLE_TIME = 0.8;
export const BOOST_MULT = 1.55;

export const PX_PER_METER = 50;

export const MAGNET_RADIUS = 260;
export const PICKUP_RADIUS = 34;

export const POWERUP_DURATION = {
  magnet: 8,
  shield: 15,
  speed: 4,
  super: 8,
} as const;

export const NEAR_MISS_DIST = 22;
export const PERFECT_ZONE = 120;
export const COMBO_TIMEOUT = 4;

export const REVIVE_COST = 50;
export const DAILY_REWARD = 60;

// Generation safety margins.
export const GEN_GAP_SAFETY = 0.74; // generator keeps gaps under 74% of reach
export const VALIDATE_GAP_SAFETY = 0.9; // validator fails anything above 90% of reach
