/** Growth-stage frames of a crop inside a sprite sheet (source px). */
export interface CropStages {
  sheet: string;
  w: number;
  h: number;
  growing: [number, number][];
  ripe: [number, number];
  /** Fruit trees: the grown tree without fruit, shown while it fruits again. */
  mature?: [number, number];
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
  /** Fruit trees grow only in orchard plots; they stay after a harvest and fruit again. */
  tree?: { regrowDays: number };
  stages: CropStages;
}

// Stardew-format crop sheet: two crops per 256px row, 16x32 frames. Frames 0-1 are the
// planted seed, phase k uses frame k+1, and frame phases+1 is the ripe crop.
function stardewCrop(sheet: string, spriteIndex: number, phases: number): CropStages {
  const x0 = (spriteIndex % 2) * 128;
  const y0 = Math.floor(spriteIndex / 2) * 32;
  const growing: [number, number][] = [];
  for (let k = 1; k <= phases; k++) growing.push([x0 + k * 16, y0]);
  return { sheet, w: 16, h: 32, growing, ripe: [x0 + (phases + 1) * 16, y0] };
}

const cornucopia = (spriteIndex: number, phases: number) => stardewCrop("/garden/crops-cornucopia.png", spriteIndex, phases);

// crops-more.png is built from the Cornucopia, PPJA Fruits and Veggies, Mizu's Flowers and
// Farmer to Florist packs in the same Stardew layout; tinted flowers have their colour
// baked into the ripe frame.
const more = (spriteIndex: number, phases: number) => stardewCrop("/garden/crops-more.png", spriteIndex, phases);

// trees.png: one 48x80 tree per row; four growth stages, the grown tree, then the grown
// tree with fruit on it.
function fruitTree(row: number): CropStages {
  const y = row * 80;
  return {
    sheet: "/garden/trees.png", w: 48, h: 80,
    growing: [[0, y], [48, y], [96, y], [144, y]], mature: [192, y], ripe: [240, y]
  };
}

// waterlily.png: one crop in the Stardew layout, drawn in the lotus palette so both pond
// plants match the pack crops: pads, a bud, then a white flower resting on the pads.
const WATER_LILY = stardewCrop("/garden/waterlily.png", 0, 4);

// Sprout Lands plant sheet: one crop per row; seed bag, three growing frames, ripe, produce.
function sproutLands(row: number): CropStages {
  const y = row * 16;
  return { sheet: "/garden/sl-plants.png", w: 16, h: 16, growing: [[16, y], [32, y], [48, y]], ripe: [64, y] };
}

/**
 * Fruit trees are switched off for now: the orchard plots are not drawn on the map and the
 * shop doesn't sell saplings. Planted trees and owned saplings stay in the database and
 * come back as they were when this is turned on again.
 */
export const ORCHARD_ENABLED = false;

export const WITHER_AFTER_DAYS = 10;
export const HARVEST_INTEREST = 0.1;
export const TASK_REWARD_PER_DAY = 1;

// Every seed packet uses the Sprout Lands paper bag (wheat, beet). For the pack crops the
// packet is generated: the blank bag plus a crop of the ripe sprite (the fruit for trees).
// Ids radish, bokchoy, cauliflower, potato, tomato, tulip and lavender were named from the
// sprites before the pack data was available; the ids stay (they are stored in the DB)
// but their display names are the real plants (shallot, sugar beet, cantaloupe,
// butternut squash, habanero, turmeric, licorice root).
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
  { id: "waterlily", nameKey: "waterlily", seedPrice: 12, sellPrice: 30, growDays: 9, seedIcon: "/garden/waterlily-seeds.png", water: true, stages: WATER_LILY },
  // From the pack data: growDays is the sum of the crop's phases (capped at 24), prices
  // scale with growDays and the crop's value in its pack.
  { id: "soybean", nameKey: "soybean", seedPrice: 11, sellPrice: 26, growDays: 10, seedIcon: "/garden/soybean-seeds.png", stages: more(0, 5) },
  { id: "sugarcane", nameKey: "sugarcane", seedPrice: 8, sellPrice: 19, growDays: 8, seedIcon: "/garden/sugarcane-seeds.png", stages: more(1, 4) },
  { id: "sesame", nameKey: "sesame", seedPrice: 9, sellPrice: 22, growDays: 5, seedIcon: "/garden/sesame-seeds.png", stages: more(2, 5) },
  { id: "adzukibean", nameKey: "adzukibean", seedPrice: 10, sellPrice: 24, growDays: 9, seedIcon: "/garden/adzukibean-seeds.png", stages: more(3, 5) },
  { id: "agave", nameKey: "agave", seedPrice: 14, sellPrice: 34, growDays: 8, seedIcon: "/garden/agave-seeds.png", stages: more(4, 4) },
  { id: "asparagus", nameKey: "asparagus", seedPrice: 10, sellPrice: 24, growDays: 5, seedIcon: "/garden/asparagus-seeds.png", stages: more(5, 4) },
  { id: "barley", nameKey: "barley", seedPrice: 7, sellPrice: 17, growDays: 4, seedIcon: "/garden/barley-seeds.png", stages: more(6, 4) },
  { id: "blackbean", nameKey: "blackbean", seedPrice: 10, sellPrice: 24, growDays: 10, seedIcon: "/garden/blackbean-seeds.png", stages: more(7, 5) },
  { id: "blueagave", nameKey: "blueagave", seedPrice: 18, sellPrice: 43, growDays: 12, seedIcon: "/garden/blueagave-seeds.png", stages: more(8, 4) },
  { id: "buckwheat", nameKey: "buckwheat", seedPrice: 7, sellPrice: 17, growDays: 4, seedIcon: "/garden/buckwheat-seeds.png", stages: more(9, 4) },
  { id: "canarymelon", nameKey: "canarymelon", seedPrice: 17, sellPrice: 41, growDays: 12, seedIcon: "/garden/canarymelon-seeds.png", stages: more(10, 5) },
  { id: "canolaflower", nameKey: "canolaflower", seedPrice: 8, sellPrice: 19, growDays: 7, seedIcon: "/garden/canolaflower-seeds.png", stages: more(11, 5) },
  { id: "cassava", nameKey: "cassava", seedPrice: 10, sellPrice: 24, growDays: 7, seedIcon: "/garden/cassava-seeds.png", stages: more(12, 5) },
  { id: "chickpea", nameKey: "chickpea", seedPrice: 10, sellPrice: 24, growDays: 10, seedIcon: "/garden/chickpea-seeds.png", stages: more(13, 5) },
  { id: "daikon", nameKey: "daikon", seedPrice: 14, sellPrice: 34, growDays: 8, seedIcon: "/garden/daikon-seeds.png", stages: more(14, 5) },
  { id: "durum", nameKey: "durum", seedPrice: 7, sellPrice: 17, growDays: 4, seedIcon: "/garden/durum-seeds.png", stages: more(15, 4) },
  { id: "ginseng", nameKey: "ginseng", seedPrice: 30, sellPrice: 72, growDays: 24, seedIcon: "/garden/ginseng-seeds.png", stages: more(16, 5) },
  { id: "greenpea", nameKey: "greenpea", seedPrice: 8, sellPrice: 19, growDays: 8, seedIcon: "/garden/greenpea-seeds.png", stages: more(17, 5) },
  { id: "groundcherry", nameKey: "groundcherry", seedPrice: 9, sellPrice: 22, growDays: 9, seedIcon: "/garden/groundcherry-seeds.png", stages: more(18, 5) },
  { id: "honeydew", nameKey: "honeydew", seedPrice: 14, sellPrice: 34, growDays: 8, seedIcon: "/garden/honeydew-seeds.png", stages: more(19, 5) },
  { id: "jalapeno", nameKey: "jalapeno", seedPrice: 9, sellPrice: 22, growDays: 8, seedIcon: "/garden/jalapeno-seeds.png", stages: more(20, 5) },
  { id: "kidneybean", nameKey: "kidneybean", seedPrice: 10, sellPrice: 24, growDays: 10, seedIcon: "/garden/kidneybean-seeds.png", stages: more(21, 5) },
  { id: "navybean", nameKey: "navybean", seedPrice: 10, sellPrice: 24, growDays: 10, seedIcon: "/garden/navybean-seeds.png", stages: more(22, 5) },
  { id: "oat", nameKey: "oat", seedPrice: 7, sellPrice: 17, growDays: 4, seedIcon: "/garden/oat-seeds.png", stages: more(23, 4) },
  { id: "okra", nameKey: "okra", seedPrice: 11, sellPrice: 26, growDays: 10, seedIcon: "/garden/okra-seeds.png", stages: more(24, 5) },
  { id: "passionfruit", nameKey: "passionfruit", seedPrice: 17, sellPrice: 41, growDays: 12, seedIcon: "/garden/passionfruit-seeds.png", stages: more(25, 5) },
  { id: "pintobean", nameKey: "pintobean", seedPrice: 10, sellPrice: 24, growDays: 10, seedIcon: "/garden/pintobean-seeds.png", stages: more(26, 5) },
  { id: "quinoa", nameKey: "quinoa", seedPrice: 7, sellPrice: 17, growDays: 6, seedIcon: "/garden/quinoa-seeds.png", stages: more(27, 4) },
  { id: "redonion", nameKey: "redonion", seedPrice: 12, sellPrice: 29, growDays: 8, seedIcon: "/garden/redonion-seeds.png", stages: more(28, 4) },
  { id: "sweetpotato", nameKey: "sweetpotato", seedPrice: 14, sellPrice: 34, growDays: 8, seedIcon: "/garden/sweetpotato-seeds.png", stages: more(29, 5) },
  { id: "wasabi", nameKey: "wasabi", seedPrice: 14, sellPrice: 34, growDays: 8, seedIcon: "/garden/wasabi-seeds.png", stages: more(30, 4) },
  { id: "lentil", nameKey: "lentil", seedPrice: 6, sellPrice: 14, growDays: 5, seedIcon: "/garden/lentil-seeds.png", stages: more(31, 5) },
  { id: "beansprouts", nameKey: "beansprouts", seedPrice: 7, sellPrice: 17, growDays: 6, seedIcon: "/garden/beansprouts-seeds.png", stages: more(32, 5) },
  { id: "ube", nameKey: "ube", seedPrice: 14, sellPrice: 34, growDays: 8, seedIcon: "/garden/ube-seeds.png", stages: more(33, 4) },
  { id: "whitegrape", nameKey: "whitegrape", seedPrice: 12, sellPrice: 29, growDays: 10, seedIcon: "/garden/whitegrape-seeds.png", stages: more(34, 5) },
  { id: "aloe", nameKey: "aloe", seedPrice: 9, sellPrice: 22, growDays: 4, seedIcon: "/garden/aloe-seeds.png", stages: more(35, 4) },
  { id: "catnip", nameKey: "catnip", seedPrice: 10, sellPrice: 24, growDays: 7, seedIcon: "/garden/catnip-seeds.png", stages: more(36, 4) },
  { id: "chives", nameKey: "chives", seedPrice: 8, sellPrice: 19, growDays: 5, seedIcon: "/garden/chives-seeds.png", stages: more(37, 4) },
  { id: "cilantro", nameKey: "cilantro", seedPrice: 8, sellPrice: 19, growDays: 5, seedIcon: "/garden/cilantro-seeds.png", stages: more(38, 4) },
  { id: "cumin", nameKey: "cumin", seedPrice: 8, sellPrice: 19, growDays: 5, seedIcon: "/garden/cumin-seeds.png", stages: more(39, 4) },
  { id: "dill", nameKey: "dill", seedPrice: 10, sellPrice: 24, growDays: 7, seedIcon: "/garden/dill-seeds.png", stages: more(40, 4) },
  { id: "fennel", nameKey: "fennel", seedPrice: 8, sellPrice: 19, growDays: 5, seedIcon: "/garden/fennel-seeds.png", stages: more(41, 4) },
  { id: "fenugreek", nameKey: "fenugreek", seedPrice: 8, sellPrice: 19, growDays: 5, seedIcon: "/garden/fenugreek-seeds.png", stages: more(42, 4) },
  { id: "lemongrass", nameKey: "lemongrass", seedPrice: 9, sellPrice: 22, growDays: 6, seedIcon: "/garden/lemongrass-seeds.png", stages: more(43, 4) },
  { id: "marjoram", nameKey: "marjoram", seedPrice: 9, sellPrice: 22, growDays: 6, seedIcon: "/garden/marjoram-seeds.png", stages: more(44, 4) },
  { id: "mint", nameKey: "mint", seedPrice: 8, sellPrice: 19, growDays: 5, seedIcon: "/garden/mint-seeds.png", stages: more(45, 4) },
  { id: "oregano", nameKey: "oregano", seedPrice: 8, sellPrice: 19, growDays: 5, seedIcon: "/garden/oregano-seeds.png", stages: more(46, 4) },
  { id: "parsley", nameKey: "parsley", seedPrice: 8, sellPrice: 19, growDays: 5, seedIcon: "/garden/parsley-seeds.png", stages: more(47, 4) },
  { id: "perilla", nameKey: "perilla", seedPrice: 8, sellPrice: 19, growDays: 5, seedIcon: "/garden/perilla-seeds.png", stages: more(48, 4) },
  { id: "rosemary", nameKey: "rosemary", seedPrice: 10, sellPrice: 24, growDays: 7, seedIcon: "/garden/rosemary-seeds.png", stages: more(49, 4) },
  { id: "sage", nameKey: "sage", seedPrice: 9, sellPrice: 22, growDays: 5, seedIcon: "/garden/sage-seeds.png", stages: more(50, 4) },
  { id: "tarragon", nameKey: "tarragon", seedPrice: 9, sellPrice: 22, growDays: 6, seedIcon: "/garden/tarragon-seeds.png", stages: more(51, 4) },
  { id: "thyme", nameKey: "thyme", seedPrice: 8, sellPrice: 19, growDays: 5, seedIcon: "/garden/thyme-seeds.png", stages: more(52, 4) },
  { id: "wormwood", nameKey: "wormwood", seedPrice: 13, sellPrice: 31, growDays: 8, seedIcon: "/garden/wormwood-seeds.png", stages: more(53, 4) },
  { id: "mustardgreens", nameKey: "mustardgreens", seedPrice: 8, sellPrice: 19, growDays: 4, seedIcon: "/garden/mustardgreens-seeds.png", stages: more(54, 4) },
  { id: "bluemist", nameKey: "bluemist", seedPrice: 8, sellPrice: 19, growDays: 7, seedIcon: "/garden/bluemist-seeds.png", stages: more(55, 4) },
  { id: "chrysanthemum", nameKey: "chrysanthemum", seedPrice: 11, sellPrice: 26, growDays: 9, seedIcon: "/garden/chrysanthemum-seeds.png", stages: more(56, 4) },
  { id: "iris", nameKey: "iris", seedPrice: 12, sellPrice: 29, growDays: 10, seedIcon: "/garden/iris-seeds.png", stages: more(57, 4) },
  { id: "lily", nameKey: "lily", seedPrice: 12, sellPrice: 29, growDays: 9, seedIcon: "/garden/lily-seeds.png", stages: more(58, 4) },
  { id: "lotus", nameKey: "lotus", seedPrice: 15, sellPrice: 36, growDays: 11, seedIcon: "/garden/lotus-seeds.png", water: true, stages: more(59, 5) },
  { id: "morningglory", nameKey: "morningglory", seedPrice: 13, sellPrice: 31, growDays: 10, seedIcon: "/garden/morningglory-seeds.png", stages: more(60, 5) },
  { id: "orchid", nameKey: "orchid", seedPrice: 16, sellPrice: 38, growDays: 10, seedIcon: "/garden/orchid-seeds.png", stages: more(61, 4) },
  { id: "pansy", nameKey: "pansy", seedPrice: 9, sellPrice: 22, growDays: 6, seedIcon: "/garden/pansy-seeds.png", stages: more(62, 4) },
  { id: "pinkcat", nameKey: "pinkcat", seedPrice: 7, sellPrice: 17, growDays: 5, seedIcon: "/garden/pinkcat-seeds.png", stages: more(63, 4) },
  { id: "rose", nameKey: "rose", seedPrice: 18, sellPrice: 43, growDays: 12, seedIcon: "/garden/rose-seeds.png", stages: more(64, 4) },
  { id: "beebalm", nameKey: "beebalm", seedPrice: 8, sellPrice: 19, growDays: 8, seedIcon: "/garden/beebalm-seeds.png", stages: more(65, 4) },
  { id: "bluebonnet", nameKey: "bluebonnet", seedPrice: 8, sellPrice: 19, growDays: 7, seedIcon: "/garden/bluebonnet-seeds.png", stages: more(66, 4) },
  { id: "buttercup", nameKey: "buttercup", seedPrice: 7, sellPrice: 17, growDays: 6, seedIcon: "/garden/buttercup-seeds.png", stages: more(67, 4) },
  { id: "carnation", nameKey: "carnation", seedPrice: 10, sellPrice: 24, growDays: 7, seedIcon: "/garden/carnation-seeds.png", stages: more(68, 4) },
  { id: "chamomile", nameKey: "chamomile", seedPrice: 8, sellPrice: 19, growDays: 5, seedIcon: "/garden/chamomile-seeds.png", stages: more(69, 4) },
  { id: "clarysage", nameKey: "clarysage", seedPrice: 8, sellPrice: 19, growDays: 8, seedIcon: "/garden/clarysage-seeds.png", stages: more(70, 4) },
  { id: "clematis", nameKey: "clematis", seedPrice: 13, sellPrice: 31, growDays: 10, seedIcon: "/garden/clematis-seeds.png", stages: more(71, 5) },
  { id: "dahlia", nameKey: "dahlia", seedPrice: 9, sellPrice: 22, growDays: 6, seedIcon: "/garden/dahlia-seeds.png", stages: more(72, 4) },
  { id: "daisy", nameKey: "daisy", seedPrice: 6, sellPrice: 14, growDays: 4, seedIcon: "/garden/daisy-seeds.png", stages: more(73, 4) },
  { id: "fairyduster", nameKey: "fairyduster", seedPrice: 8, sellPrice: 19, growDays: 7, seedIcon: "/garden/fairyduster-seeds.png", stages: more(74, 4) },
  { id: "freesia", nameKey: "freesia", seedPrice: 11, sellPrice: 26, growDays: 8, seedIcon: "/garden/freesia-seeds.png", stages: more(75, 4) },
  { id: "geranium", nameKey: "geranium", seedPrice: 11, sellPrice: 26, growDays: 9, seedIcon: "/garden/geranium-seeds.png", stages: more(76, 4) },
  { id: "honeysuckle", nameKey: "honeysuckle", seedPrice: 16, sellPrice: 38, growDays: 16, seedIcon: "/garden/honeysuckle-seeds.png", stages: more(77, 5) },
  { id: "hyacinth", nameKey: "hyacinth", seedPrice: 10, sellPrice: 24, growDays: 7, seedIcon: "/garden/hyacinth-seeds.png", stages: more(78, 4) },
  { id: "hydrangea", nameKey: "hydrangea", seedPrice: 12, sellPrice: 29, growDays: 10, seedIcon: "/garden/hydrangea-seeds.png", stages: more(79, 4) },
  { id: "larkspur", nameKey: "larkspur", seedPrice: 12, sellPrice: 29, growDays: 9, seedIcon: "/garden/larkspur-seeds.png", stages: more(80, 4) },
  { id: "lavenderflower", nameKey: "lavenderflower", seedPrice: 7, sellPrice: 17, growDays: 6, seedIcon: "/garden/lavenderflower-seeds.png", stages: more(81, 4) },
  { id: "lupine", nameKey: "lupine", seedPrice: 9, sellPrice: 22, growDays: 7, seedIcon: "/garden/lupine-seeds.png", stages: more(82, 4) },
  { id: "peony", nameKey: "peony", seedPrice: 12, sellPrice: 29, growDays: 9, seedIcon: "/garden/peony-seeds.png", stages: more(83, 4) },
  { id: "petunia", nameKey: "petunia", seedPrice: 9, sellPrice: 22, growDays: 6, seedIcon: "/garden/petunia-seeds.png", stages: more(84, 4) },
  { id: "pitcherplant", nameKey: "pitcherplant", seedPrice: 17, sellPrice: 41, growDays: 15, seedIcon: "/garden/pitcherplant-seeds.png", stages: more(85, 5) },
  { id: "purpleconeflower", nameKey: "purpleconeflower", seedPrice: 10, sellPrice: 24, growDays: 9, seedIcon: "/garden/purpleconeflower-seeds.png", stages: more(86, 4) },
  { id: "rafflesia", nameKey: "rafflesia", seedPrice: 30, sellPrice: 72, growDays: 24, seedIcon: "/garden/rafflesia-seeds.png", stages: more(87, 5) },
  { id: "rosespring", nameKey: "rosespring", seedPrice: 18, sellPrice: 43, growDays: 12, seedIcon: "/garden/rosespring-seeds.png", stages: more(88, 5) },
  { id: "rosesummer", nameKey: "rosesummer", seedPrice: 18, sellPrice: 43, growDays: 12, seedIcon: "/garden/rosesummer-seeds.png", stages: more(89, 5) },
  { id: "rosefall", nameKey: "rosefall", seedPrice: 18, sellPrice: 43, growDays: 12, seedIcon: "/garden/rosefall-seeds.png", stages: more(90, 5) },
  { id: "winterrose", nameKey: "winterrose", seedPrice: 18, sellPrice: 43, growDays: 12, seedIcon: "/garden/winterrose-seeds.png", stages: more(91, 5) },
  { id: "prismaticrose", nameKey: "prismaticrose", seedPrice: 26, sellPrice: 62, growDays: 20, seedIcon: "/garden/prismaticrose-seeds.png", stages: more(92, 4) },
  { id: "violet", nameKey: "violet", seedPrice: 7, sellPrice: 17, growDays: 6, seedIcon: "/garden/violet-seeds.png", stages: more(93, 4) },
  { id: "wolfsbane", nameKey: "wolfsbane", seedPrice: 15, sellPrice: 36, growDays: 13, seedIcon: "/garden/wolfsbane-seeds.png", stages: more(94, 6) },
  { id: "bamboo", nameKey: "bamboo", seedPrice: 9, sellPrice: 22, growDays: 7, seedIcon: "/garden/bamboo-seeds.png", stages: more(95, 5) },
  { id: "blackberry", nameKey: "blackberry", seedPrice: 12, sellPrice: 29, growDays: 10, seedIcon: "/garden/blackberry-seeds.png", stages: more(96, 5) },
  { id: "elderberry", nameKey: "elderberry", seedPrice: 10, sellPrice: 24, growDays: 10, seedIcon: "/garden/elderberry-seeds.png", stages: more(97, 5) },
  { id: "ginger", nameKey: "ginger", seedPrice: 10, sellPrice: 24, growDays: 7, seedIcon: "/garden/ginger-seeds.png", stages: more(98, 4) },
  { id: "gooseberry", nameKey: "gooseberry", seedPrice: 12, sellPrice: 29, growDays: 13, seedIcon: "/garden/gooseberry-seeds.png", stages: more(99, 5) },
  { id: "juniper", nameKey: "juniper", seedPrice: 12, sellPrice: 29, growDays: 13, seedIcon: "/garden/juniper-seeds.png", stages: more(100, 5) },
  { id: "raspberry", nameKey: "raspberry", seedPrice: 10, sellPrice: 24, growDays: 10, seedIcon: "/garden/raspberry-seeds.png", stages: more(101, 5) },
  { id: "shiitakemushroom", nameKey: "shiitakemushroom", seedPrice: 15, sellPrice: 36, growDays: 10, seedIcon: "/garden/shiitakemushroom-seeds.png", stages: more(102, 3) },
  { id: "sulfurshelfmushroom", nameKey: "sulfurshelfmushroom", seedPrice: 15, sellPrice: 36, growDays: 10, seedIcon: "/garden/sulfurshelfmushroom-seeds.png", stages: more(103, 3) },
  { id: "tabascopepper", nameKey: "tabascopepper", seedPrice: 12, sellPrice: 29, growDays: 10, seedIcon: "/garden/tabascopepper-seeds.png", stages: more(104, 5) },
  { id: "lilac", nameKey: "lilac", seedPrice: 8, sellPrice: 19, growDays: 7, seedIcon: "/garden/lilac-seeds.png", stages: more(105, 5) },
  { id: "passionflower", nameKey: "passionflower", seedPrice: 13, sellPrice: 31, growDays: 8, seedIcon: "/garden/passionflower-seeds.png", stages: more(106, 4) },
  { id: "jasmine", nameKey: "jasmine", seedPrice: 11, sellPrice: 26, growDays: 7, seedIcon: "/garden/jasmine-seeds.png", stages: more(107, 4) },
  { id: "allium", nameKey: "allium", seedPrice: 7, sellPrice: 17, growDays: 4, seedIcon: "/garden/allium-seeds.png", stages: more(108, 4) },
  { id: "camellia", nameKey: "camellia", seedPrice: 14, sellPrice: 34, growDays: 13, seedIcon: "/garden/camellia-seeds.png", stages: more(109, 5) },
  { id: "delphinium", nameKey: "delphinium", seedPrice: 11, sellPrice: 26, growDays: 9, seedIcon: "/garden/delphinium-seeds.png", stages: more(110, 5) },
  { id: "englishrose", nameKey: "englishrose", seedPrice: 14, sellPrice: 34, growDays: 12, seedIcon: "/garden/englishrose-seeds.png", stages: more(111, 5) },
  // Fruit trees: grow in the orchard and fruit again every regrowDays after a harvest.
  { id: "avocadotree", nameKey: "avocadotree", seedPrice: 45, sellPrice: 16, growDays: 14, seedIcon: "/garden/avocadotree-seeds.png", tree: { regrowDays: 4 }, stages: fruitTree(0) },
  { id: "cocoapodtree", nameKey: "cocoapodtree", seedPrice: 38, sellPrice: 12, growDays: 12, seedIcon: "/garden/cocoapodtree-seeds.png", tree: { regrowDays: 4 }, stages: fruitTree(1) },
  { id: "peartree", nameKey: "peartree", seedPrice: 39, sellPrice: 13, growDays: 13, seedIcon: "/garden/peartree-seeds.png", tree: { regrowDays: 4 }, stages: fruitTree(2) },
  { id: "pistachiotree", nameKey: "pistachiotree", seedPrice: 34, sellPrice: 10, growDays: 12, seedIcon: "/garden/pistachiotree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(3) },
  { id: "olivetree", nameKey: "olivetree", seedPrice: 45, sellPrice: 8, growDays: 14, seedIcon: "/garden/olivetree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(4) },
  { id: "almondtree", nameKey: "almondtree", seedPrice: 34, sellPrice: 10, growDays: 12, seedIcon: "/garden/almondtree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(5) },
  { id: "breadfruittree", nameKey: "breadfruittree", seedPrice: 45, sellPrice: 18, growDays: 14, seedIcon: "/garden/breadfruittree-seeds.png", tree: { regrowDays: 5 }, stages: fruitTree(6) },
  { id: "cashewtree", nameKey: "cashewtree", seedPrice: 35, sellPrice: 11, growDays: 12, seedIcon: "/garden/cashewtree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(7) },
  { id: "dragonfruittree", nameKey: "dragonfruittree", seedPrice: 38, sellPrice: 12, growDays: 12, seedIcon: "/garden/dragonfruittree-seeds.png", tree: { regrowDays: 4 }, stages: fruitTree(8) },
  { id: "duriantree", nameKey: "duriantree", seedPrice: 45, sellPrice: 24, growDays: 14, seedIcon: "/garden/duriantree-seeds.png", tree: { regrowDays: 6 }, stages: fruitTree(9) },
  { id: "figtree", nameKey: "figtree", seedPrice: 35, sellPrice: 11, growDays: 12, seedIcon: "/garden/figtree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(10) },
  { id: "grapefruittree", nameKey: "grapefruittree", seedPrice: 40, sellPrice: 13, growDays: 13, seedIcon: "/garden/grapefruittree-seeds.png", tree: { regrowDays: 4 }, stages: fruitTree(11) },
  { id: "lemontree", nameKey: "lemontree", seedPrice: 30, sellPrice: 8, growDays: 12, seedIcon: "/garden/lemontree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(12) },
  { id: "limetree", nameKey: "limetree", seedPrice: 30, sellPrice: 8, growDays: 12, seedIcon: "/garden/limetree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(13) },
  { id: "lycheetree", nameKey: "lycheetree", seedPrice: 38, sellPrice: 12, growDays: 12, seedIcon: "/garden/lycheetree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(14) },
  { id: "nectarinetree", nameKey: "nectarinetree", seedPrice: 40, sellPrice: 13, growDays: 13, seedIcon: "/garden/nectarinetree-seeds.png", tree: { regrowDays: 4 }, stages: fruitTree(15) },
  { id: "papayatree", nameKey: "papayatree", seedPrice: 30, sellPrice: 13, growDays: 12, seedIcon: "/garden/papayatree-seeds.png", tree: { regrowDays: 4 }, stages: fruitTree(16) },
  { id: "pecantree", nameKey: "pecantree", seedPrice: 38, sellPrice: 12, growDays: 12, seedIcon: "/garden/pecantree-seeds.png", tree: { regrowDays: 4 }, stages: fruitTree(17) },
  { id: "persimmontree", nameKey: "persimmontree", seedPrice: 42, sellPrice: 14, growDays: 14, seedIcon: "/garden/persimmontree-seeds.png", tree: { regrowDays: 4 }, stages: fruitTree(18) },
  { id: "plantaintree", nameKey: "plantaintree", seedPrice: 30, sellPrice: 15, growDays: 12, seedIcon: "/garden/plantaintree-seeds.png", tree: { regrowDays: 4 }, stages: fruitTree(19) },
  { id: "pomelotree", nameKey: "pomelotree", seedPrice: 34, sellPrice: 10, growDays: 12, seedIcon: "/garden/pomelotree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(20) },
  { id: "umetree", nameKey: "umetree", seedPrice: 30, sellPrice: 8, growDays: 12, seedIcon: "/garden/umetree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(21) },
  { id: "walnuttree", nameKey: "walnuttree", seedPrice: 34, sellPrice: 10, growDays: 12, seedIcon: "/garden/walnuttree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(22) },
  { id: "yuzutree", nameKey: "yuzutree", seedPrice: 30, sellPrice: 8, growDays: 12, seedIcon: "/garden/yuzutree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(23) },
  { id: "camphorleavestree", nameKey: "camphorleavestree", seedPrice: 30, sellPrice: 11, growDays: 12, seedIcon: "/garden/camphorleavestree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(24) },
  { id: "melaleucaleavestree", nameKey: "melaleucaleavestree", seedPrice: 30, sellPrice: 11, growDays: 12, seedIcon: "/garden/melaleucaleavestree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(25) },
  { id: "nutmegtree", nameKey: "nutmegtree", seedPrice: 35, sellPrice: 10, growDays: 12, seedIcon: "/garden/nutmegtree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(26) },
  { id: "hibiscustree", nameKey: "hibiscustree", seedPrice: 32, sellPrice: 10, growDays: 12, seedIcon: "/garden/hibiscustree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(27) },
  { id: "jasminetree", nameKey: "jasminetree", seedPrice: 32, sellPrice: 8, growDays: 12, seedIcon: "/garden/jasminetree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(28) },
  { id: "magnoliatree", nameKey: "magnoliatree", seedPrice: 31, sellPrice: 9, growDays: 12, seedIcon: "/garden/magnoliatree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(29) },
  { id: "wisteriatree", nameKey: "wisteriatree", seedPrice: 31, sellPrice: 9, growDays: 12, seedIcon: "/garden/wisteriatree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(30) },
  { id: "ylangylangtree", nameKey: "ylangylangtree", seedPrice: 32, sellPrice: 10, growDays: 12, seedIcon: "/garden/ylangylangtree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(31) },
  { id: "asianpeartree", nameKey: "asianpeartree", seedPrice: 60, sellPrice: 12, growDays: 17, seedIcon: "/garden/asianpeartree-seeds.png", tree: { regrowDays: 4 }, stages: fruitTree(32) },
  { id: "cinnamonstickstree", nameKey: "cinnamonstickstree", seedPrice: 85, sellPrice: 13, growDays: 21, seedIcon: "/garden/cinnamonstickstree-seeds.png", tree: { regrowDays: 4 }, stages: fruitTree(33) },
  { id: "eucalyptusleavestree", nameKey: "eucalyptusleavestree", seedPrice: 80, sellPrice: 13, growDays: 21, seedIcon: "/garden/eucalyptusleavestree-seeds.png", tree: { regrowDays: 4 }, stages: fruitTree(34) },
  { id: "grannysmithappletree", nameKey: "grannysmithappletree", seedPrice: 60, sellPrice: 11, growDays: 17, seedIcon: "/garden/grannysmithappletree-seeds.png", tree: { regrowDays: 3 }, stages: fruitTree(35) },
  { id: "vanillatree", nameKey: "vanillatree", seedPrice: 75, sellPrice: 16, growDays: 20, seedIcon: "/garden/vanillatree-seeds.png", tree: { regrowDays: 4 }, stages: fruitTree(36) }
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
export function growthFrame(
  stages: CropStages,
  status: string,
  daysElapsed: number,
  growDays: number,
  mature = false
): [number, number] {
  if (status !== "growing") return stages.ripe;
  if (mature && stages.mature) return stages.mature;
  const progress = growDays > 0 ? daysElapsed / growDays : 0;
  return stages.growing[Math.min(stages.growing.length - 1, Math.floor(progress * stages.growing.length))];
}
