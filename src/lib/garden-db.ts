import { sql, once } from "./db";
import { HARVEST_INTEREST, LEGACY_FERTILIZERS, WITHER_AFTER_DAYS, effectiveGrowDays, getCrop } from "./garden-catalog";

export type PlotStatus = "empty" | "growing" | "ready" | "withered";
export type PlotKind = "soil" | "pond" | "orchard";

export interface GardenPlot {
  id: number;
  slotIndex: number;
  kind: PlotKind;
  cropId: string | null;
  fertilizerId: string | null;
  plantedOn: string | null;
  status: PlotStatus;
  daysElapsed: number;
  growDays: number;
  sellPrice: number;
  /** Fruit trees: grown up (fruiting, or fruiting again after a harvest). */
  mature: boolean;
  /** Fruit trees: days until the next fruit; 0 when ripe or not yet grown. */
  fruitDaysLeft: number;
}

const PLOT_SLOTS = 9;
// Pond plots use their own slot range so they never collide with soil slots, nor with
// rows left over from the earlier (removed) pond.
const POND_SLOT_BASE = 100;
const POND_SLOTS = 6;
const ORCHARD_SLOT_BASE = 200;
const ORCHARD_SLOTS = 12;
const ALL_SLOTS = [
  ...Array.from({ length: PLOT_SLOTS }, (_, i) => i),
  ...Array.from({ length: POND_SLOTS }, (_, i) => POND_SLOT_BASE + i),
  ...Array.from({ length: ORCHARD_SLOTS }, (_, i) => ORCHARD_SLOT_BASE + i)
];

const slotKind = (slot: number): PlotKind =>
  slot >= ORCHARD_SLOT_BASE ? "orchard" : slot >= POND_SLOT_BASE ? "pond" : "soil";

/** The kind of plot a crop must be planted in. */
const cropKind = (crop: { water?: boolean; tree?: unknown }): PlotKind =>
  crop.tree ? "orchard" : crop.water ? "pond" : "soil";

export const ensureGardenTables = once(async function ensureGardenTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS garden_wallet (
      user_id    INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      balance    INT NOT NULL DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS garden_plots (
      id          SERIAL PRIMARY KEY,
      user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot_index  INT NOT NULL,
      crop_id     TEXT,
      fertilizer_id TEXT,
      planted_on  DATE,
      UNIQUE (user_id, slot_index)
    )
  `;
  // Fruit trees stay after a harvest; this is the day they were last picked.
  await sql`ALTER TABLE garden_plots ADD COLUMN IF NOT EXISTS harvested_on DATE`;
  await sql`
    CREATE TABLE IF NOT EXISTS garden_inventory (
      user_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id  TEXT NOT NULL,
      qty      INT NOT NULL DEFAULT 0 CHECK (qty >= 0),
      PRIMARY KEY (user_id, item_id)
    )
  `;
  // The pond was removed: its slots become regular soil slots, and the water crops
  // planted there (no longer in the catalog) are cleared.
  await sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'garden_plots' AND column_name = 'kind'
      ) THEN
        UPDATE garden_plots SET crop_id = NULL, fertilizer_id = NULL, planted_on = NULL WHERE kind = 'pond';
        ALTER TABLE garden_plots DROP COLUMN kind;
      END IF;
    END $$
  `;
  // Fertilizer was removed: refund unused fertilizer at its old price. Deleting and
  // crediting in one statement means a concurrent run can't refund the same rows twice.
  const prices = JSON.stringify(Object.fromEntries(Object.entries(LEGACY_FERTILIZERS).map(([id, f]) => [id, f.price])));
  await sql`
    WITH removed AS (
      DELETE FROM garden_inventory WHERE item_id LIKE 'fert:%'
      RETURNING user_id, item_id, qty
    ), refund AS (
      SELECT user_id, SUM(qty * COALESCE((${prices}::jsonb ->> substring(item_id from 6))::int, 0))::int AS amount
      FROM removed GROUP BY user_id
    )
    INSERT INTO garden_wallet (user_id, balance)
    SELECT user_id, amount FROM refund WHERE amount > 0
    ON CONFLICT (user_id) DO UPDATE SET balance = garden_wallet.balance + EXCLUDED.balance
  `;
});

async function ensurePlots(userId: number): Promise<void> {
  const rows = await sql`SELECT slot_index FROM garden_plots WHERE user_id = ${userId}`;
  const existing = new Set(rows.map((r) => r.slot_index as number));
  for (const slot of ALL_SLOTS) {
    if (existing.has(slot)) continue;
    await sql`
      INSERT INTO garden_plots (user_id, slot_index)
      VALUES (${userId}, ${slot})
      ON CONFLICT (user_id, slot_index) DO NOTHING
    `;
  }
}

function daysBetween(dateStr: string, today: string): number {
  const a = new Date(dateStr + "T00:00:00Z").getTime();
  const b = new Date(today + "T00:00:00Z").getTime();
  return Math.floor((b - a) / 86400000);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// The driver parses a DATE column as local midnight, so read it back with local getters;
// toISOString() would shift it to the previous day on a server east of UTC.
function toDateStr(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const d = value as Date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toPlot(row: Record<string, unknown>): GardenPlot {
  const cropId = row.crop_id as string | null;
  const fertilizerId = row.fertilizer_id as string | null;
  const plantedOn = toDateStr(row.planted_on);

  let status: PlotStatus = "empty";
  let daysElapsed = 0;
  let growDays = 0;
  let sellPrice = 0;
  let mature = false;
  let fruitDaysLeft = 0;
  const harvestedOn = toDateStr(row.harvested_on);

  if (cropId && plantedOn) {
    const crop = getCrop(cropId);
    if (crop) {
      growDays = effectiveGrowDays(crop, fertilizerId);
      sellPrice = crop.sellPrice;
      daysElapsed = daysBetween(plantedOn, todayStr());
      if (crop.tree) {
        // A tree fruits when it grows up, then regrowDays after each harvest. Its fruit
        // never withers.
        mature = daysElapsed >= growDays;
        if (!mature) {
          status = "growing";
        } else if (harvestedOn) {
          fruitDaysLeft = Math.max(0, crop.tree.regrowDays - daysBetween(harvestedOn, todayStr()));
          status = fruitDaysLeft > 0 ? "growing" : "ready";
        } else {
          status = "ready";
        }
      } else if (daysElapsed >= growDays + WITHER_AFTER_DAYS) {
        status = "withered";
      } else if (daysElapsed >= growDays) {
        status = "ready";
      } else {
        status = "growing";
      }
    }
  }

  return {
    id: row.id as number,
    slotIndex: row.slot_index as number,
    kind: slotKind(row.slot_index as number),
    cropId,
    fertilizerId,
    plantedOn,
    status,
    daysElapsed,
    growDays,
    sellPrice,
    mature,
    fruitDaysLeft
  };
}

export async function listPlots(userId: number): Promise<GardenPlot[]> {
  await ensurePlots(userId);
  const rows = await sql`
    SELECT * FROM garden_plots
    WHERE user_id = ${userId}
      AND (
        slot_index < ${PLOT_SLOTS}
        OR (slot_index >= ${POND_SLOT_BASE} AND slot_index < ${POND_SLOT_BASE + POND_SLOTS})
        OR (slot_index >= ${ORCHARD_SLOT_BASE} AND slot_index < ${ORCHARD_SLOT_BASE + ORCHARD_SLOTS})
      )
    ORDER BY slot_index ASC
  `;
  return rows.map(toPlot);
}

export async function getBalance(userId: number): Promise<number> {
  const rows = await sql`
    INSERT INTO garden_wallet (user_id, balance) VALUES (${userId}, 0)
    ON CONFLICT (user_id) DO UPDATE SET balance = garden_wallet.balance
    RETURNING balance
  `;
  return rows[0].balance as number;
}

export async function adjustBalance(userId: number, delta: number): Promise<number> {
  const rows = await sql`
    INSERT INTO garden_wallet (user_id, balance) VALUES (${userId}, ${delta})
    ON CONFLICT (user_id) DO UPDATE SET balance = garden_wallet.balance + ${delta}
    RETURNING balance
  `;
  return rows[0].balance as number;
}

/** Inventory keys: "seed:<cropId>". */
export const seedKey = (cropId: string) => `seed:${cropId}`;

function itemPrice(itemId: string): number | null {
  const [kind, id] = itemId.split(":");
  if (kind === "seed") return getCrop(id)?.seedPrice ?? null;
  return null;
}

export async function getInventory(userId: number): Promise<Record<string, number>> {
  const rows = await sql`SELECT item_id, qty FROM garden_inventory WHERE user_id = ${userId} AND qty > 0`;
  return Object.fromEntries(rows.map((r) => [r.item_id as string, r.qty as number]));
}

async function takeItem(userId: number, itemId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE garden_inventory SET qty = qty - 1
    WHERE user_id = ${userId} AND item_id = ${itemId} AND qty > 0
    RETURNING qty
  `;
  return rows.length > 0;
}

async function giveItem(userId: number, itemId: string, qty: number): Promise<void> {
  await sql`
    INSERT INTO garden_inventory (user_id, item_id, qty) VALUES (${userId}, ${itemId}, ${qty})
    ON CONFLICT (user_id, item_id) DO UPDATE SET qty = garden_inventory.qty + ${qty}
  `;
}

export async function buyItem(
  userId: number,
  itemId: string,
  qty: number
): Promise<{ ok: boolean; error?: string; balance?: number }> {
  const price = itemPrice(itemId);
  if (price === null) return { ok: false, error: "unknown item" };
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) return { ok: false, error: "invalid qty" };

  const cost = price * qty;
  // Deduct only if the balance covers the cost, in one statement.
  const rows = await sql`
    UPDATE garden_wallet SET balance = balance - ${cost}
    WHERE user_id = ${userId} AND balance >= ${cost}
    RETURNING balance
  `;
  if (rows.length === 0) return { ok: false, error: "insufficient balance" };
  await giveItem(userId, itemId, qty);
  return { ok: true, balance: rows[0].balance as number };
}

export async function plantSeed(
  userId: number,
  plotId: number,
  cropId: string
): Promise<{ ok: boolean; error?: string }> {
  const crop = getCrop(cropId);
  if (!crop) return { ok: false, error: "unknown crop" };

  const plotRows = await sql`SELECT * FROM garden_plots WHERE id = ${plotId} AND user_id = ${userId}`;
  const plot = plotRows[0];
  if (!plot) return { ok: false, error: "plot not found" };
  if (plot.crop_id) return { ok: false, error: "plot occupied" };
  if (slotKind(plot.slot_index as number) !== cropKind(crop)) return { ok: false, error: "wrong plot kind" };

  if (!(await takeItem(userId, seedKey(cropId)))) return { ok: false, error: "no seed" };

  // The crop_id IS NULL guard stops two concurrent plants from both landing.
  const updated = await sql`
    UPDATE garden_plots
    SET crop_id = ${cropId}, fertilizer_id = NULL, planted_on = ${todayStr()}, harvested_on = NULL
    WHERE id = ${plotId} AND user_id = ${userId} AND crop_id IS NULL
    RETURNING id
  `;
  if (updated.length === 0) {
    await giveItem(userId, seedKey(cropId), 1);
    return { ok: false, error: "plot occupied" };
  }
  return { ok: true };
}

export async function harvestPlot(
  userId: number,
  plotId: number
): Promise<{ ok: boolean; error?: string; earned?: number; balance?: number }> {
  const plotRows = await sql`SELECT * FROM garden_plots WHERE id = ${plotId} AND user_id = ${userId}`;
  const row = plotRows[0];
  if (!row) return { ok: false, error: "plot not found" };
  const plot = toPlot(row);

  if (plot.status === "withered") {
    await sql`UPDATE garden_plots SET crop_id = NULL, fertilizer_id = NULL, planted_on = NULL WHERE id = ${plotId}`;
    return { ok: false, error: "withered" };
  }
  if (plot.status !== "ready") return { ok: false, error: "not ready" };

  const earned = Math.round(plot.sellPrice * (1 + HARVEST_INTEREST));
  // Each update only lands if the plot is still as read, so a double click can't pay twice.
  const isTree = !!getCrop(plot.cropId ?? "")?.tree;
  const updated = isTree
    ? await sql`
        UPDATE garden_plots SET harvested_on = ${todayStr()}
        WHERE id = ${plotId} AND crop_id = ${plot.cropId} AND (harvested_on IS NULL OR harvested_on < ${todayStr()}::date)
        RETURNING id
      `
    : await sql`
        UPDATE garden_plots SET crop_id = NULL, fertilizer_id = NULL, planted_on = NULL, harvested_on = NULL
        WHERE id = ${plotId} AND crop_id = ${plot.cropId} AND planted_on IS NOT NULL
        RETURNING id
      `;
  if (updated.length === 0) return { ok: false, error: "not ready" };
  const balance = await adjustBalance(userId, earned);
  return { ok: true, earned, balance };
}

/** Dig up whatever grows in a plot (the shovel): a crop, water plant or fruit tree. */
export async function removePlant(userId: number, plotId: number): Promise<{ ok: boolean; error?: string }> {
  const updated = await sql`
    UPDATE garden_plots SET crop_id = NULL, fertilizer_id = NULL, planted_on = NULL, harvested_on = NULL
    WHERE id = ${plotId} AND user_id = ${userId} AND crop_id IS NOT NULL
    RETURNING id
  `;
  if (updated.length === 0) return { ok: false, error: "nothing planted" };
  return { ok: true };
}
