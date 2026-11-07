/**
 * Hand-designed level data. Each level has a handcrafted token sequence that the
 * generator lays out in order (cycling with seeded variation until the target
 * distance is reached). Every generated layout is validated as beatable.
 *
 * Tokens:
 *  flat            open run with a fish row
 *  gap gap-s gap-l jump between buildings (gap-l needs a double jump)
 *  up down         gap with a rise / drop
 *  chimney ac crate crates antenna pigeon   jump-over obstacles
 *  sign laundry    slide-under hazards (laundry can also be jumped)
 *  puddle          slows you down
 *  wall            tall wall: hold jump to wall-run
 *  crumble         collapsing section across a gap
 *  moving          moving lift across a gap
 *  seagull icicle ice     world hazards
 *  gust bridge awning     desert features
 *  float wind             sky features
 *  gold            golden fish arc
 *  pw:magnet pw:shield pw:speed pw:super   power-ups
 */
export interface LevelDef {
  id: number;
  world: number;
  name: string;
  distance: number; // metres
  speed: number; // base run speed px/s
  seed: number;
  gapLo: number; // gap size as fraction of the safe maximum, start of level
  gapHi: number; // ... end of level
  react0: number; // reaction time budget between actions (s), start
  react1: number; // ... end
  tutorial: boolean;
  boss: boolean;
  seq: string;
}

type Raw = [string, number, number, string];

const RAW: Raw[] = [
  // Sunny Suburbs
  ["First Steps", 320, 340, "flat gap-s flat gap-s chimney flat gap-l flat sign flat pw:magnet flat gap ac flat gap crate flat laundry gap gold flat gap-s"],
  ["Picket Fences", 380, 350, "flat gap chimney flat wall flat pigeon gap ac sign gap-s up flat pw:shield laundry gap down crate gold gap puddle flat"],
  ["Garden Hops", 420, 362, "gap chimney gap-s up ac down pigeon gap laundry crates gap-l pw:super flat gap sign puddle gap gold wall flat"],
  ["Cul-de-Sac Sprint", 460, 374, "gap crumble flat antenna gap up chimney sign gap pigeon crates gap-l pw:speed gap down laundry wall gold crumble flat"],
  ["Sunset Lawns", 500, 386, "gap-l chimney pigeon gap up crates antenna gap crumble sign gap down puddle ac wall pw:shield gap gold laundry gap-l"],
  // Neon City Night
  ["Neon Welcome", 500, 400, "gap moving flat sign antenna gap up ac gap-l pw:magnet moving chimney gap sign gold wall gap crates"],
  ["Arcade Alley", 540, 410, "moving gap antenna sign gap-l up crates moving pigeon gap down laundry pw:speed gap wall sign gold gap"],
  ["Billboard Bounds", 580, 420, "gap up sign moving antenna gap-l chimney crumble gap sign pigeon pw:shield moving gap wall gold crates gap-l"],
  ["Midnight Express", 620, 430, "moving moving sign gap antenna crates gap-l down laundry crumble up sign pw:super gap moving wall gold chimney"],
  ["Skyline Finale", 660, 440, "gap-l sign moving antenna crumble up crates sign gap moving pigeon gap-l wall pw:magnet sign gold moving gap"],
  // Rainy Harbor
  ["Drizzle Docks", 560, 430, "gap seagull flat chimney gap-l up crates gap seagull puddle pw:shield gap sign down ac wall gold gap"],
  ["Gull Gusts", 600, 440, "seagull gap crumble ac seagull gap-l up laundry puddle gap sign pw:magnet seagull wall gold crates gap"],
  ["Lighthouse Leap", 640, 450, "gap-l seagull up chimney crumble sign gap down puddle seagull pw:speed antenna gap wall gold crates gap-l"],
  ["Storm Warehouses", 680, 460, "crumble seagull gap sign crates gap-l up seagull puddle laundry crumble pw:shield gap wall antenna gold seagull gap"],
  ["Thunder Pier", 720, 470, "gap-l seagull crumble up sign seagull crates gap-l down puddle pw:super antenna crumble wall seagull gold gap-l"],
  // Snowy Old Town
  ["First Frost", 600, 450, "gap ice flat chimney gap icicle up crates gap-l ice sign pw:magnet gap wall gold pigeon gap"],
  ["Icicle Lane", 640, 460, "icicle gap ice crates icicle gap-l up sign ice chimney pw:shield gap down icicle wall gold gap"],
  ["Bell Tower Bounds", 680, 470, "gap-l up icicle ice sign crumble gap chimney icicle pw:speed gap down laundry ice wall gold icicle gap-l"],
  ["Frozen Clocktower", 720, 480, "ice icicle gap-l crumble up sign icicle crates gap ice pigeon pw:super wall icicle gold gap-l down"],
  ["Blizzard Run", 760, 490, "gap-l icicle ice crumble up sign icicle crates gap-l ice pw:shield icicle wall antenna gold crumble gap-l"],
  // Desert Bazaar Rooftops
  ["Spice Market", 640, 470, "gap awning flat chimney gust bridge sign pw:magnet gap up crates gold gap-l"],
  ["Rope & Rugs", 680, 480, "bridge gap laundry awning gust crates gap-l up sign pw:speed bridge wall gold gap"],
  ["Lantern Rooftops", 720, 490, "gust gap-l awning antenna bridge crumble up sign gust pw:shield gap crates wall gold awning gap-l"],
  ["Dune Winds", 760, 500, "awning gust bridge sign crumble gap-l up laundry gust pw:super bridge wall gold awning crates gap-l"],
  ["Golden Hour Chase", 800, 510, "gust awning gap-l crumble bridge sign gust up crates pw:magnet awning wall gold bridge gust gap-l"],
  // Sky Fortress
  ["Cloud Steps", 700, 500, "float gap wind flat sign float pw:magnet gap-l up crates float gold wind gap"],
  ["Windy Ramparts", 740, 510, "wind float gap-l moving sign float crumble pw:shield up wall wind gold float gap"],
  ["Floating Gardens", 780, 520, "float wind moving crumble gap-l sign float pw:speed up crates wind wall gold float gap-l"],
  ["Fortress Gates", 820, 530, "float gap-l wind crumble sign moving float pw:super up wall antenna wind gold float gap-l"],
  ["The Great Vacuum Chase", 900, 520, "gap sign crates gap-l pw:shield float wind crumble gap up chimney sign pw:speed gap-l gold wall float gap"],
];

export const LEVELS: LevelDef[] = RAW.map(([name, distance, speed, seq], i) => {
  const id = i + 1;
  const inWorld = i % 5; // 0..4
  const world = Math.floor(i / 5);
  const d = i / 29; // overall difficulty 0..1
  return {
    id,
    world,
    name,
    distance,
    speed,
    seed: 1000 + id * 7919,
    gapLo: 0.42 + d * 0.22 + inWorld * 0.015,
    gapHi: 0.6 + d * 0.32 + inWorld * 0.02,
    react0: 0.95 - d * 0.35,
    react1: 0.75 - d * 0.3,
    tutorial: id <= 2,
    boss: id === 30,
    seq,
  };
});

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(id: number): LevelDef {
  const l = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, id - 1))];
  if (!l) throw new Error("Missing level " + id);
  return l;
}
