// Static evolution-chain data for the Kanto (Gen 1) Pokedex, #1-151.
//
// Each chain is a list of "stages". Each stage is a list of one or more
// { id, name } options - more than one option means the evolution branches
// at that stage (the player is asked to choose). Stage 0 of every chain is
// the base form that the gacha pool draws from.
//
// Ported from anki-pokegacha/evolutions.py.

export interface PokemonSpecies {
  id: number;
  name: string;
}

export type EvolutionStage = PokemonSpecies[];
export type EvolutionChain = EvolutionStage[];

export const CHAINS: EvolutionChain[] = [
  [[{ id: 1, name: "Bulbasaur" }], [{ id: 2, name: "Ivysaur" }], [{ id: 3, name: "Venusaur" }]],
  [[{ id: 4, name: "Charmander" }], [{ id: 5, name: "Charmeleon" }], [{ id: 6, name: "Charizard" }]],
  [[{ id: 7, name: "Squirtle" }], [{ id: 8, name: "Wartortle" }], [{ id: 9, name: "Blastoise" }]],
  [[{ id: 10, name: "Caterpie" }], [{ id: 11, name: "Metapod" }], [{ id: 12, name: "Butterfree" }]],
  [[{ id: 13, name: "Weedle" }], [{ id: 14, name: "Kakuna" }], [{ id: 15, name: "Beedrill" }]],
  [[{ id: 16, name: "Pidgey" }], [{ id: 17, name: "Pidgeotto" }], [{ id: 18, name: "Pidgeot" }]],
  [[{ id: 19, name: "Rattata" }], [{ id: 20, name: "Raticate" }]],
  [[{ id: 21, name: "Spearow" }], [{ id: 22, name: "Fearow" }]],
  [[{ id: 23, name: "Ekans" }], [{ id: 24, name: "Arbok" }]],
  [[{ id: 25, name: "Pikachu" }], [{ id: 26, name: "Raichu" }]],
  [[{ id: 27, name: "Sandshrew" }], [{ id: 28, name: "Sandslash" }]],
  [[{ id: 29, name: "Nidoran F" }], [{ id: 30, name: "Nidorina" }], [{ id: 31, name: "Nidoqueen" }]],
  [[{ id: 32, name: "Nidoran M" }], [{ id: 33, name: "Nidorino" }], [{ id: 34, name: "Nidoking" }]],
  [[{ id: 35, name: "Clefairy" }], [{ id: 36, name: "Clefable" }]],
  [[{ id: 37, name: "Vulpix" }], [{ id: 38, name: "Ninetales" }]],
  [[{ id: 39, name: "Jigglypuff" }], [{ id: 40, name: "Wigglytuff" }]],
  [[{ id: 41, name: "Zubat" }], [{ id: 42, name: "Golbat" }]],
  [[{ id: 43, name: "Oddish" }], [{ id: 44, name: "Gloom" }], [{ id: 45, name: "Vileplume" }]],
  [[{ id: 46, name: "Paras" }], [{ id: 47, name: "Parasect" }]],
  [[{ id: 48, name: "Venonat" }], [{ id: 49, name: "Venomoth" }]],
  [[{ id: 50, name: "Diglett" }], [{ id: 51, name: "Dugtrio" }]],
  [[{ id: 52, name: "Meowth" }], [{ id: 53, name: "Persian" }]],
  [[{ id: 54, name: "Psyduck" }], [{ id: 55, name: "Golduck" }]],
  [[{ id: 56, name: "Mankey" }], [{ id: 57, name: "Primeape" }]],
  [[{ id: 58, name: "Growlithe" }], [{ id: 59, name: "Arcanine" }]],
  [[{ id: 60, name: "Poliwag" }], [{ id: 61, name: "Poliwhirl" }], [{ id: 62, name: "Poliwrath" }]],
  [[{ id: 63, name: "Abra" }], [{ id: 64, name: "Kadabra" }], [{ id: 65, name: "Alakazam" }]],
  [[{ id: 66, name: "Machop" }], [{ id: 67, name: "Machoke" }], [{ id: 68, name: "Machamp" }]],
  [[{ id: 69, name: "Bellsprout" }], [{ id: 70, name: "Weepinbell" }], [{ id: 71, name: "Victreebel" }]],
  [[{ id: 72, name: "Tentacool" }], [{ id: 73, name: "Tentacruel" }]],
  [[{ id: 74, name: "Geodude" }], [{ id: 75, name: "Graveler" }], [{ id: 76, name: "Golem" }]],
  [[{ id: 77, name: "Ponyta" }], [{ id: 78, name: "Rapidash" }]],
  [[{ id: 79, name: "Slowpoke" }], [{ id: 80, name: "Slowbro" }]],
  [[{ id: 81, name: "Magnemite" }], [{ id: 82, name: "Magneton" }]],
  [[{ id: 83, name: "Farfetchd" }]],
  [[{ id: 84, name: "Doduo" }], [{ id: 85, name: "Dodrio" }]],
  [[{ id: 86, name: "Seel" }], [{ id: 87, name: "Dewgong" }]],
  [[{ id: 88, name: "Grimer" }], [{ id: 89, name: "Muk" }]],
  [[{ id: 90, name: "Shellder" }], [{ id: 91, name: "Cloyster" }]],
  [[{ id: 92, name: "Gastly" }], [{ id: 93, name: "Haunter" }], [{ id: 94, name: "Gengar" }]],
  [[{ id: 95, name: "Onix" }]],
  [[{ id: 96, name: "Drowzee" }], [{ id: 97, name: "Hypno" }]],
  [[{ id: 98, name: "Krabby" }], [{ id: 99, name: "Kingler" }]],
  [[{ id: 100, name: "Voltorb" }], [{ id: 101, name: "Electrode" }]],
  [[{ id: 102, name: "Exeggcute" }], [{ id: 103, name: "Exeggutor" }]],
  [[{ id: 104, name: "Cubone" }], [{ id: 105, name: "Marowak" }]],
  [[{ id: 106, name: "Hitmonlee" }]],
  [[{ id: 107, name: "Hitmonchan" }]],
  [[{ id: 108, name: "Lickitung" }]],
  [[{ id: 109, name: "Koffing" }], [{ id: 110, name: "Weezing" }]],
  [[{ id: 111, name: "Rhyhorn" }], [{ id: 112, name: "Rhydon" }]],
  [[{ id: 113, name: "Chansey" }]],
  [[{ id: 114, name: "Tangela" }]],
  [[{ id: 115, name: "Kangaskhan" }]],
  [[{ id: 116, name: "Horsea" }], [{ id: 117, name: "Seadra" }]],
  [[{ id: 118, name: "Goldeen" }], [{ id: 119, name: "Seaking" }]],
  [[{ id: 120, name: "Staryu" }], [{ id: 121, name: "Starmie" }]],
  [[{ id: 122, name: "Mr Mime" }]],
  [[{ id: 123, name: "Scyther" }]],
  [[{ id: 124, name: "Jynx" }]],
  [[{ id: 125, name: "Electabuzz" }]],
  [[{ id: 126, name: "Magmar" }]],
  [[{ id: 127, name: "Pinsir" }]],
  [[{ id: 128, name: "Tauros" }]],
  [[{ id: 129, name: "Magikarp" }], [{ id: 130, name: "Gyarados" }]],
  [[{ id: 131, name: "Lapras" }]],
  [[{ id: 132, name: "Ditto" }]],
  [
    [{ id: 133, name: "Eevee" }],
    [
      { id: 134, name: "Vaporeon" },
      { id: 135, name: "Jolteon" },
      { id: 136, name: "Flareon" },
    ],
  ],
  [[{ id: 137, name: "Porygon" }]],
  [[{ id: 138, name: "Omanyte" }], [{ id: 139, name: "Omastar" }]],
  [[{ id: 140, name: "Kabuto" }], [{ id: 141, name: "Kabutops" }]],
  [[{ id: 142, name: "Aerodactyl" }]],
  [[{ id: 143, name: "Snorlax" }]],
  [[{ id: 144, name: "Articuno" }]],
  [[{ id: 145, name: "Zapdos" }]],
  [[{ id: 146, name: "Moltres" }]],
  [[{ id: 147, name: "Dratini" }], [{ id: 148, name: "Dragonair" }], [{ id: 149, name: "Dragonite" }]],
  [[{ id: 150, name: "Mewtwo" }]],
  [[{ id: 151, name: "Mew" }]],
];

export function chainKey(chain: EvolutionChain): string {
  return String(chain[0][0].id);
}

export const CHAINS_BY_KEY: Record<string, EvolutionChain> = Object.fromEntries(
  CHAINS.map((c) => [chainKey(c), c])
);

export function speciesAt(chain: EvolutionChain, stageNumber: number): PokemonSpecies {
  // stageNumber is 1-indexed (1 = base form). Only valid for non-branching
  // stages, where there is exactly one option.
  return chain[stageNumber - 1][0];
}

// Duplicates needed to evolve out of `stage` (1-indexed, 1 = base form):
// stage 1 -> 2 needs 2^1 = 2, stage 2 -> 3 needs 2^2 = 4, etc.
export function dupsNeededToEvolve(stage: number): number {
  return 2 ** stage;
}

export const POKE_SPRITE_URL = (dexId: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;

// Gacha pull weighting: a chain's weight is its number of evolution stages,
// so a line with more evolutions (e.g. Bulbasaur, 3 stages) is more likely
// to be pulled than one with fewer, and a species with no evolution at all
// (1 stage, e.g. Mew, Kangaskhan) is the least likely.
function chainWeight(chain: EvolutionChain): number {
  return chain.length;
}

const CUMULATIVE_WEIGHTS: number[] = (() => {
  let total = 0;
  return CHAINS.map((chain) => (total += chainWeight(chain)));
})();
const TOTAL_WEIGHT = CUMULATIVE_WEIGHTS[CUMULATIVE_WEIGHTS.length - 1];

export function pickRandomChain(): EvolutionChain {
  const roll = Math.random() * TOTAL_WEIGHT;
  const idx = CUMULATIVE_WEIGHTS.findIndex((cum) => roll < cum);
  return CHAINS[idx === -1 ? CHAINS.length - 1 : idx];
}
