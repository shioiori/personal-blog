/** Growth-stage frames of a crop inside a sprite sheet (source px). */
export interface CropStages {
  sheet: string;
  w: number;
  h: number;
  growing: [number, number][];
  ripe: [number, number];
  withered?: [number, number];
}

export interface CropDef {
  id: string;
  nameKey: string;
  seedPrice: number;
  sellPrice: number;
  growDays: number;
  seedIcon: string;
  /** Water plants grow only in pond plots; land crops only in soil plots. */
  water?: boolean;
  stages: CropStages;
}

// Stardew-format crop sheet: two crops per 256px row, 16x32 frames. Frames 0-1 are the
// planted seed, phase k uses frame k+1, and frame phases+1 is the ripe crop.
function cornucopia(spriteIndex: number, phases: number): CropStages {
  const x0 = (spriteIndex % 2) * 128;
  const y0 = Math.floor(spriteIndex / 2) * 32;
  const growing: [number, number][] = [];
  for (let k = 1; k <= phases; k++) growing.push([x0 + k * 16, y0]);
  return { sheet: "/garden/crops-cornucopia.png", w: 16, h: 32, growing, ripe: [x0 + (phases + 1) * 16, y0] };
}

function aquatic(name: string, h: number, ripeIdx: number, witheredIdx = 4): CropStages {
  const growing: [number, number][] = [];
  for (let k = 0; k < ripeIdx; k++) growing.push([k * 32, 0]);
  return { sheet: `/garden/aq-${name}.png`, w: 32, h, growing, ripe: [ripeIdx * 32, 0], withered: [witheredIdx * 32, 0] };
}

// Sprout Lands plant sheet: one crop per row; seed bag, three growing frames, ripe, produce.
function sproutLands(row: number): CropStages {
  const y = row * 16;
  return { sheet: "/garden/sl-plants.png", w: 16, h: 16, growing: [[16, y], [32, y], [48, y]], ripe: [64, y] };
}

export const WITHER_AFTER_DAYS = 10;
export const HARVEST_INTEREST = 0.1;
export const TASK_REWARD_PER_DAY = 1;

// Every seed packet uses the Sprout Lands paper bag (wheat, beet). For the Cornucopia
// crops the packet is generated: the blank bag plus a crop of the ripe sprite.
export const CROPS: CropDef[] = [
  { id: "onion", nameKey: "onion", seedPrice: 8, sellPrice: 20, growDays: 8, seedIcon: "/garden/onion-seeds.png", stages: cornucopia(8, 4) },
  { id: "basil", nameKey: "basil", seedPrice: 6, sellPrice: 15, growDays: 3, seedIcon: "/garden/basil-seeds.png", stages: cornucopia(76, 3) },
  { id: "bellpepper", nameKey: "bellpepper", seedPrice: 10, sellPrice: 25, growDays: 10, seedIcon: "/garden/bellpepper-seeds.png", stages: cornucopia(30, 5) },
  { id: "turnip", nameKey: "turnip", seedPrice: 7, sellPrice: 18, growDays: 6, seedIcon: "/garden/turnip-seeds.png", stages: cornucopia(48, 4) },
  { id: "cucumber", nameKey: "cucumber", seedPrice: 12, sellPrice: 28, growDays: 11, seedIcon: "/garden/cucumber-seeds.png", stages: cornucopia(54, 5) },
  { id: "kiwi", nameKey: "kiwi", seedPrice: 20, sellPrice: 45, growDays: 21, seedIcon: "/garden/kiwi-seeds.png", stages: cornucopia(47, 5) },
  { id: "lettuce", nameKey: "lettuce", seedPrice: 6, sellPrice: 14, growDays: 6, seedIcon: "/garden/lettuce-seeds.png", stages: cornucopia(16, 5) },
  { id: "peanut", nameKey: "peanut", seedPrice: 14, sellPrice: 32, growDays: 20, seedIcon: "/garden/peanut-seeds.png", stages: cornucopia(12, 5) },
  { id: "spinach", nameKey: "spinach", seedPrice: 5, sellPrice: 12, growDays: 4, seedIcon: "/garden/spinach-seeds.png", stages: cornucopia(18, 4) },
  { id: "watermelon", nameKey: "watermelon", seedPrice: 18, sellPrice: 60, growDays: 12, seedIcon: "/garden/watermelon-seeds.png", stages: cornucopia(36, 6) },
  { id: "zucchini", nameKey: "zucchini", seedPrice: 9, sellPrice: 22, growDays: 14, seedIcon: "/garden/zucchini-seeds.png", stages: cornucopia(22, 5) },
  { id: "wheat", nameKey: "wheat", seedPrice: 5, sellPrice: 13, growDays: 4, seedIcon: "/garden/wheat-seeds.png", stages: sproutLands(0) },
  { id: "beet", nameKey: "beet", seedPrice: 9, sellPrice: 22, growDays: 7, seedIcon: "/garden/beet-seeds.png", stages: sproutLands(1) },
  // Named from the Cornucopia sprites themselves (the sheet ships without names).
  { id: "radish", nameKey: "radish", seedPrice: 6, sellPrice: 15, growDays: 5, seedIcon: "/garden/radish-seeds.png", stages: cornucopia(10, 4) },
  { id: "carrot", nameKey: "carrot", seedPrice: 7, sellPrice: 17, growDays: 6, seedIcon: "/garden/carrot-seeds.png", stages: cornucopia(11, 4) },
  { id: "bokchoy", nameKey: "bokchoy", seedPrice: 6, sellPrice: 15, growDays: 5, seedIcon: "/garden/bokchoy-seeds.png", stages: cornucopia(14, 5) },
  { id: "celery", nameKey: "celery", seedPrice: 8, sellPrice: 19, growDays: 7, seedIcon: "/garden/celery-seeds.png", stages: cornucopia(15, 4) },
  { id: "cabbage", nameKey: "cabbage", seedPrice: 10, sellPrice: 24, growDays: 9, seedIcon: "/garden/cabbage-seeds.png", stages: cornucopia(17, 5) },
  { id: "broccoli", nameKey: "broccoli", seedPrice: 11, sellPrice: 26, growDays: 10, seedIcon: "/garden/broccoli-seeds.png", stages: cornucopia(20, 5) },
  { id: "cauliflower", nameKey: "cauliflower", seedPrice: 12, sellPrice: 29, growDays: 11, seedIcon: "/garden/cauliflower-seeds.png", stages: cornucopia(38, 5) },
  { id: "potato", nameKey: "potato", seedPrice: 9, sellPrice: 21, growDays: 8, seedIcon: "/garden/potato-seeds.png", stages: cornucopia(35, 5) },
  { id: "tomato", nameKey: "tomato", seedPrice: 10, sellPrice: 25, growDays: 10, seedIcon: "/garden/tomato-seeds.png", stages: cornucopia(31, 5) },
  { id: "chili", nameKey: "chili", seedPrice: 10, sellPrice: 24, growDays: 9, seedIcon: "/garden/chili-seeds.png", stages: cornucopia(33, 5) },
  { id: "cotton", nameKey: "cotton", seedPrice: 15, sellPrice: 36, growDays: 15, seedIcon: "/garden/cotton-seeds.png", stages: cornucopia(28, 5) },
  { id: "cactus", nameKey: "cactus", seedPrice: 16, sellPrice: 40, growDays: 16, seedIcon: "/garden/cactus-seeds.png", stages: cornucopia(59, 5) },
  { id: "tulip", nameKey: "tulip", seedPrice: 13, sellPrice: 31, growDays: 12, seedIcon: "/garden/tulip-seeds.png", stages: cornucopia(72, 5) },
  { id: "lavender", nameKey: "lavender", seedPrice: 13, sellPrice: 31, growDays: 12, seedIcon: "/garden/lavender-seeds.png", stages: cornucopia(74, 5) },
  { id: "waterlily", nameKey: "lotus", seedPrice: 12, sellPrice: 30, growDays: 9, seedIcon: "/garden/lotus-seeds.png", water: true, stages: aquatic("lotus", 32, 2, 3) },
  { id: "caltrop", nameKey: "caltrop", seedPrice: 10, sellPrice: 24, growDays: 8, seedIcon: "/garden/caltrop-seeds.png", water: true, stages: aquatic("caltrop", 32, 3) },
  { id: "cattail", nameKey: "cattail", seedPrice: 8, sellPrice: 20, growDays: 6, seedIcon: "/garden/cattail-seeds.png", water: true, stages: aquatic("cattail", 48, 3) }
];

/**
 * Fertilizer was removed from the game. Plants fertilized before that keep their
 * speed-up until harvest, and unused fertilizer is refunded at these prices.
 */
export const LEGACY_FERTILIZERS: Record<string, { price: number; speedBoost: number }> = {
  basic: { price: 10, speedBoost: 0.15 },
  quality: { price: 25, speedBoost: 0.3 },
  deluxe: { price: 50, speedBoost: 0.5 }
};

export function getCrop(id: string): CropDef | undefined {
  return CROPS.find((c) => c.id === id);
}

export function effectiveGrowDays(crop: CropDef, fertilizerId: string | null): number {
  const boost = fertilizerId ? LEGACY_FERTILIZERS[fertilizerId]?.speedBoost ?? 0 : 0;
  return Math.max(1, Math.round(crop.growDays * (1 - boost)));
}

/** The sprite frame for a plant at its current point of growth. */
export function growthFrame(stages: CropStages, status: string, daysElapsed: number, growDays: number): [number, number] {
  if (status === "withered" && stages.withered) return stages.withered;
  if (status !== "growing") return stages.ripe;
  const progress = growDays > 0 ? daysElapsed / growDays : 0;
  return stages.growing[Math.min(stages.growing.length - 1, Math.floor(progress * stages.growing.length))];
}
