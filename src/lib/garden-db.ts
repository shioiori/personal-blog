import { sql, once } from "./db";
import { CROPS, FERTILIZERS, HARVEST_INTEREST, WITHER_AFTER_DAYS, effectiveGrowDays, getCrop } from "./garden-catalog";

export type PlotStatus = "empty" | "growing" | "ready" | "withered";

export interface GardenPlot {
  id: number;
  slotIndex: number;
  cropId: string | null;
  fertilizerId: string | null;
  plantedOn: string | null;
  status: PlotStatus;
  daysElapsed: number;
  growDays: number;
  sellPrice: number;
}

const PLOT_SLOTS = 9;

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
});

async function ensurePlots(userId: number): Promise<void> {
  const rows = await sql`SELECT slot_index FROM garden_plots WHERE user_id = ${userId}`;
  const existing = new Set(rows.map((r) => r.slot_index as number));
  for (let slot = 0; slot < PLOT_SLOTS; slot++) {
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

function toPlot(row: Record<string, unknown>): GardenPlot {
  const cropId = row.crop_id as string | null;
  const fertilizerId = row.fertilizer_id as string | null;
  const plantedOn = row.planted_on ? (row.planted_on as Date).toISOString().slice(0, 10) : null;

  let status: PlotStatus = "empty";
  let daysElapsed = 0;
  let growDays = 0;
  let sellPrice = 0;

  if (cropId && plantedOn) {
    const crop = getCrop(cropId);
    if (crop) {
      growDays = effectiveGrowDays(crop, fertilizerId);
      sellPrice = crop.sellPrice;
      daysElapsed = daysBetween(plantedOn, todayStr());
      if (daysElapsed >= growDays + WITHER_AFTER_DAYS) {
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
    cropId,
    fertilizerId,
    plantedOn,
    status,
    daysElapsed,
    growDays,
    sellPrice
  };
}

export async function listPlots(userId: number): Promise<GardenPlot[]> {
  await ensurePlots(userId);
  const rows = await sql`
    SELECT * FROM garden_plots
    WHERE user_id = ${userId} AND slot_index < ${PLOT_SLOTS}
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

/** Inventory keys: "seed:<cropId>" and "fert:<fertilizerId>". */
export const seedKey = (cropId: string) => `seed:${cropId}`;
export const fertKey = (fertilizerId: string) => `fert:${fertilizerId}`;

function itemPrice(itemId: string): number | null {
  const [kind, id] = itemId.split(":");
  if (kind === "seed") return getCrop(id)?.seedPrice ?? null;
  if (kind === "fert") return FERTILIZERS.find((f) => f.id === id)?.price ?? null;
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
  cropId: string,
  fertilizerId: string | null
): Promise<{ ok: boolean; error?: string }> {
  const crop = CROPS.find((c) => c.id === cropId);
  if (!crop) return { ok: false, error: "unknown crop" };
  const fert = fertilizerId ? FERTILIZERS.find((f) => f.id === fertilizerId) : null;
  if (fertilizerId && !fert) return { ok: false, error: "unknown fertilizer" };

  const plotRows = await sql`SELECT * FROM garden_plots WHERE id = ${plotId} AND user_id = ${userId}`;
  const plot = plotRows[0];
  if (!plot) return { ok: false, error: "plot not found" };
  if (plot.crop_id) return { ok: false, error: "plot occupied" };

  if (!(await takeItem(userId, seedKey(cropId)))) return { ok: false, error: "no seed" };
  if (fertilizerId && !(await takeItem(userId, fertKey(fertilizerId)))) {
    await giveItem(userId, seedKey(cropId), 1);
    return { ok: false, error: "no fertilizer" };
  }

  await sql`
    UPDATE garden_plots
    SET crop_id = ${cropId}, fertilizer_id = ${fertilizerId}, planted_on = ${todayStr()}
    WHERE id = ${plotId} AND user_id = ${userId}
  `;
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
  await sql`UPDATE garden_plots SET crop_id = NULL, fertilizer_id = NULL, planted_on = NULL WHERE id = ${plotId}`;
  const balance = await adjustBalance(userId, earned);
  return { ok: true, earned, balance };
}
