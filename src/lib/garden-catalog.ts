/** Growth-stage frames of a crop inside a sprite sheet (source px). */
export interface CropStages {
  sheet: string;
  w: number;
  h: number;
  growing: [number, number][];
  ripe: [number, number];
}

export interface CropDef {
  id: string;
  nameKey: string;
  seedPrice: number;
  sellPrice: number;
  growDays: number;
  seedIcon: string;
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

// Sprout Lands plant sheet: one crop per row; seed bag, three growing frames, ripe, produce.
function sproutLands(row: number): CropStages {
  const y = row * 16;
  return { sheet: "/garden/sl-plants.png", w: 16, h: 16, growing: [[16, y], [32, y], [48, y]], ripe: [64, y] };
}

export interface FertilizerDef {
  id: string;
  nameKey: string;
  price: number;
  /** Fraction of grow time skipped, e.g. 0.25 = 25% faster. */
  speedBoost: number;
  emoji: string;
}

export const WITHER_AFTER_DAYS = 10;
export const HARVEST_INTEREST = 0.1;
export const TASK_REWARD_PER_DAY = 1;

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
  { id: "beet", nameKey: "beet", seedPrice: 9, sellPrice: 22, growDays: 7, seedIcon: "/garden/beet-seeds.png", stages: sproutLands(1) }
];

export const FERTILIZERS: FertilizerDef[] = [
  { id: "basic", nameKey: "basic", price: 10, speedBoost: 0.15, emoji: "🌱" },
  { id: "quality", nameKey: "quality", price: 25, speedBoost: 0.3, emoji: "🍀" },
  { id: "deluxe", nameKey: "deluxe", price: 50, speedBoost: 0.5, emoji: "✨" }
];

export function getCrop(id: string): CropDef | undefined {
  return CROPS.find((c) => c.id === id);
}

export function getFertilizer(id: string | null): FertilizerDef | undefined {
  if (!id) return undefined;
  return FERTILIZERS.find((f) => f.id === id);
}

export function effectiveGrowDays(crop: CropDef, fertilizerId: string | null): number {
  const fert = getFertilizer(fertilizerId);
  const boost = fert ? fert.speedBoost : 0;
  return Math.max(1, Math.round(crop.growDays * (1 - boost)));
}
