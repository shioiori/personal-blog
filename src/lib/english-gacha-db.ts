import { sql } from "./db";
import { CHAINS, CHAINS_BY_KEY, chainKey, dupsNeededToEvolve, pickRandomChain, speciesAt, type PokemonSpecies } from "./pokemon-evolutions";

// Ported from anki-pokegacha/logic.py: a gacha-pull reward for flashcard
// reviews. Progress is kept in a single singleton row, mirroring the
// addon's JSON blob (tickets, card_rank, collection).

export const RESULT_NEW = "new" as const;
export const RESULT_DUP = "dup" as const;
export const RESULT_EVOLVE = "evolve" as const;
export const RESULT_CHOOSE = "choose_evolution" as const;
export const RESULT_MAXED = "maxed" as const;

export interface ChainProgress {
  stage: number;
  currentId: number | null;
  dup: number;
}

type RawProgress = { stage: number; current_id: number | null; dup: number };
type RawState = {
  tickets: number;
  exchange_tickets: number;
  card_rank: Record<string, number>;
  collection: Record<string, RawProgress>;
};

export type PullResult =
  | { type: typeof RESULT_NEW; species: PokemonSpecies; chainKey: string }
  | { type: typeof RESULT_DUP; species: PokemonSpecies; chainKey: string; progress: number; needed: number }
  | { type: typeof RESULT_EVOLVE; species: PokemonSpecies; chainKey: string }
  | { type: typeof RESULT_CHOOSE; options: PokemonSpecies[]; chainKey: string }
  | { type: typeof RESULT_MAXED; species: PokemonSpecies; chainKey: string };

const DEFAULT_STATE: RawState = { tickets: 0, exchange_tickets: 0, card_rank: {}, collection: {} };

const EXCHANGE_COST = 5;

export async function ensureGachaTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS english_gacha_state (
      id         SMALLINT PRIMARY KEY DEFAULT 1,
      tickets    INT NOT NULL DEFAULT 0,
      card_rank  JSONB NOT NULL DEFAULT '{}',
      collection JSONB NOT NULL DEFAULT '{}',
      CONSTRAINT english_gacha_state_singleton CHECK (id = 1)
    )
  `;
  await sql`ALTER TABLE english_gacha_state ADD COLUMN IF NOT EXISTS exchange_tickets INT NOT NULL DEFAULT 0`;
}

async function loadState(): Promise<RawState> {
  const rows = await sql`SELECT tickets, exchange_tickets, card_rank, collection FROM english_gacha_state WHERE id = 1`;
  if (!rows[0]) {
    await sql`INSERT INTO english_gacha_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
    return { ...DEFAULT_STATE };
  }
  return {
    tickets: rows[0].tickets as number,
    exchange_tickets: (rows[0].exchange_tickets as number) ?? 0,
    card_rank: (rows[0].card_rank as Record<string, number>) ?? {},
    collection: (rows[0].collection as Record<string, RawProgress>) ?? {},
  };
}

async function saveState(state: RawState): Promise<void> {
  await sql`
    INSERT INTO english_gacha_state (id, tickets, exchange_tickets, card_rank, collection)
    VALUES (1, ${state.tickets}, ${state.exchange_tickets}, ${JSON.stringify(state.card_rank)}::jsonb, ${JSON.stringify(state.collection)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      tickets = ${state.tickets},
      exchange_tickets = ${state.exchange_tickets},
      card_rank = ${JSON.stringify(state.card_rank)}::jsonb,
      collection = ${JSON.stringify(state.collection)}::jsonb
  `;
}

export async function getTicketCount(): Promise<number> {
  const state = await loadState();
  return state.tickets;
}

export async function getExchangeTicketCount(): Promise<number> {
  const state = await loadState();
  return state.exchange_tickets;
}

// Call when a flashcard is graded. Awards a ticket the first time this word
// reaches `rank` (1 = Good, 2 = Easy). Returns true if a ticket was awarded.
export async function recordFlashcardProgress(wordId: number, rank: 1 | 2): Promise<boolean> {
  const state = await loadState();
  const key = String(wordId);
  const prev = state.card_rank[key] ?? 0;
  if (rank <= prev) return false;
  state.card_rank[key] = rank;
  state.tickets += 1;
  await saveState(state);
  return true;
}

// Call when a word is graded "Again" (forgotten). Clears its remembered
// rank so relearning it back to Good/Easy earns a ticket again, same as
// learning it the first time.
export async function resetFlashcardProgress(wordId: number): Promise<void> {
  const state = await loadState();
  const key = String(wordId);
  if (!(key in state.card_rank)) return;
  delete state.card_rank[key];
  await saveState(state);
}

function toProgress(raw: RawProgress | undefined): ChainProgress {
  return raw ? { stage: raw.stage, currentId: raw.current_id, dup: raw.dup } : { stage: 0, currentId: null, dup: 0 };
}

export interface GachaCollectionEntry {
  chainKey: string;
  chain: PokemonSpecies[][];
  progress: ChainProgress;
}

export async function getCollection(): Promise<GachaCollectionEntry[]> {
  const state = await loadState();
  return CHAINS.map((chain) => {
    const key = chainKey(chain);
    return { chainKey: key, chain, progress: toProgress(state.collection[key]) };
  });
}

export async function pull(): Promise<PullResult> {
  const state = await loadState();
  const chain = pickRandomChain();
  const key = chainKey(chain);
  const progress = state.collection[key];

  if (!progress) {
    const base = chain[0][0];
    state.collection[key] = { stage: 1, current_id: base.id, dup: 0 };
    await saveState(state);
    return { type: RESULT_NEW, species: base, chainKey: key };
  }

  const stage = progress.stage;
  if (stage >= chain.length) {
    // Rolled a duplicate of a fully-evolved species: it can't progress any
    // further, so it converts into an exchange ticket instead.
    state.exchange_tickets += 1;
    await saveState(state);
    return { type: RESULT_MAXED, species: speciesAt(chain, stage), chainKey: key };
  }

  const needed = dupsNeededToEvolve(stage);
  progress.dup += 1;
  if (progress.dup < needed) {
    await saveState(state);
    return { type: RESULT_DUP, species: speciesAt(chain, stage), chainKey: key, progress: progress.dup, needed };
  }

  const nextOptions = chain[stage];
  if (nextOptions.length === 1) {
    progress.dup = 0;
    progress.stage = stage + 1;
    progress.current_id = nextOptions[0].id;
    await saveState(state);
    return { type: RESULT_EVOLVE, species: nextOptions[0], chainKey: key };
  }

  // Branching evolution: leave dup/stage as-is until the player chooses.
  await saveState(state);
  return { type: RESULT_CHOOSE, options: nextOptions, chainKey: key };
}

export async function spendTicket(): Promise<boolean> {
  const state = await loadState();
  if (state.tickets <= 0) return false;
  state.tickets -= 1;
  await saveState(state);
  return true;
}

// Spends EXCHANGE_COST exchange tickets to add one duplicate piece to an
// already-unlocked, not-yet-fully-evolved species of the player's choice.
// Behaves like a guaranteed dup pull for that species: it can trigger an
// evolution (or branch choice) the same way a regular pull would.
export async function exchangeForPiece(chainKeyValue: string): Promise<PullResult> {
  const state = await loadState();
  if (state.exchange_tickets < EXCHANGE_COST) throw new Error("not enough exchange tickets");

  const chain = CHAINS_BY_KEY[chainKeyValue];
  if (!chain) throw new Error("unknown chain");
  const progress = state.collection[chainKeyValue];
  if (!progress) throw new Error("species not unlocked yet");

  const stage = progress.stage;
  if (stage >= chain.length) throw new Error("species already fully evolved");

  state.exchange_tickets -= EXCHANGE_COST;

  const needed = dupsNeededToEvolve(stage);
  progress.dup += 1;
  if (progress.dup < needed) {
    await saveState(state);
    return { type: RESULT_DUP, species: speciesAt(chain, stage), chainKey: chainKeyValue, progress: progress.dup, needed };
  }

  const nextOptions = chain[stage];
  if (nextOptions.length === 1) {
    progress.dup = 0;
    progress.stage = stage + 1;
    progress.current_id = nextOptions[0].id;
    await saveState(state);
    return { type: RESULT_EVOLVE, species: nextOptions[0], chainKey: chainKeyValue };
  }

  await saveState(state);
  return { type: RESULT_CHOOSE, options: nextOptions, chainKey: chainKeyValue };
}

export async function chooseEvolution(chainKeyValue: string, chosenId: number): Promise<PokemonSpecies> {
  const state = await loadState();
  const chain = CHAINS_BY_KEY[chainKeyValue];
  if (!chain) throw new Error("unknown chain");
  const progress = state.collection[chainKeyValue];
  if (!progress) throw new Error("no progress for chain");
  const nextStageOptions = chain[progress.stage];
  const chosen = nextStageOptions.find((s) => s.id === chosenId);
  if (!chosen) throw new Error("invalid evolution choice");
  progress.dup = 0;
  progress.stage += 1;
  progress.current_id = chosenId;
  await saveState(state);
  return chosen;
}
