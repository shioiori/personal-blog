// Local, rule-based lemmatizer — no AI call. Used only to widen the
// duplicate-word check (e.g. "went" should be recognized as a form of "go"
// already in the DB) before the AI pipeline (lemmatize/gloss/ai-define) runs.
// Deliberately over-generates candidate base forms; false positives just
// mean an extra (harmless) DB match, so err on the side of more candidates.

// Common irregular verbs: inflected form -> base form(s).
const IRREGULAR: Record<string, string[]> = {
  went: ["go"], gone: ["go"], goes: ["go"], going: ["go"],
  was: ["be"], were: ["be"], been: ["be"], am: ["be"], is: ["be"], are: ["be"], being: ["be"],
  had: ["have"], has: ["have"], having: ["have"],
  did: ["do"], does: ["do"], doing: ["do"], done: ["do"],
  said: ["say"], says: ["say"], saying: ["say"],
  made: ["make"], makes: ["make"], making: ["make"],
  took: ["take"], taken: ["take"], takes: ["take"], taking: ["take"],
  came: ["come"], comes: ["come"], coming: ["come"],
  saw: ["see"], seen: ["see"], sees: ["see"], seeing: ["see"],
  knew: ["know"], known: ["know"], knows: ["know"], knowing: ["know"],
  got: ["get"], gotten: ["get"], gets: ["get"], getting: ["get"],
  gave: ["give"], given: ["give"], gives: ["give"], giving: ["give"],
  found: ["find"], finds: ["find"], finding: ["find"],
  thought: ["think"], thinks: ["think"], thinking: ["think"],
  told: ["tell"], tells: ["tell"], telling: ["tell"],
  became: ["become"], becomes: ["become"], becoming: ["become"],
  showed: ["show"], shown: ["show"], shows: ["show"], showing: ["show"],
  left: ["leave"], leaves: ["leave"], leaving: ["leave"],
  felt: ["feel"], feels: ["feel"], feeling: ["feel"],
  brought: ["bring"], brings: ["bring"], bringing: ["bring"],
  began: ["begin"], begun: ["begin"], begins: ["begin"], beginning: ["begin"],
  kept: ["keep"], keeps: ["keep"], keeping: ["keep"],
  held: ["hold"], holds: ["hold"], holding: ["hold"],
  wrote: ["write"], written: ["write"], writes: ["write"], writing: ["write"],
  stood: ["stand"], stands: ["stand"], standing: ["stand"],
  heard: ["hear"], hears: ["hear"], hearing: ["hear"],
  let: ["let"], lets: ["let"], letting: ["let"],
  meant: ["mean"], means: ["mean"], meaning: ["mean"],
  set: ["set"], sets: ["set"], setting: ["set"],
  met: ["meet"], meets: ["meet"], meeting: ["meet"],
  ran: ["run"], runs: ["run"], running: ["run"],
  paid: ["pay"], pays: ["pay"], paying: ["pay"],
  sat: ["sit"], sits: ["sit"], sitting: ["sit"],
  spoke: ["speak"], spoken: ["speak"], speaks: ["speak"], speaking: ["speak"],
  lay: ["lie"], lain: ["lie"], lies: ["lie"], lying: ["lie"],
  led: ["lead"], leads: ["lead"], leading: ["lead"],
  read: ["read"], reads: ["read"], reading: ["read"],
  grew: ["grow"], grown: ["grow"], grows: ["grow"], growing: ["grow"],
  lost: ["lose"], loses: ["lose"], losing: ["lose"],
  fell: ["fall"], fallen: ["fall"], falls: ["fall"], falling: ["fall"],
  sent: ["send"], sends: ["send"], sending: ["send"],
  built: ["build"], builds: ["build"], building: ["build"],
  understood: ["understand"], understands: ["understand"], understanding: ["understand"],
  drew: ["draw"], drawn: ["draw"], draws: ["draw"], drawing: ["draw"],
  broke: ["break"], broken: ["break"], breaks: ["break"], breaking: ["break"],
  spent: ["spend"], spends: ["spend"], spending: ["spend"],
  cut: ["cut"], cuts: ["cut"], cutting: ["cut"],
  rose: ["rise"], risen: ["rise"], rises: ["rise"], rising: ["rise"],
  drove: ["drive"], driven: ["drive"], drives: ["drive"], driving: ["drive"],
  bought: ["buy"], buys: ["buy"], buying: ["buy"],
  wore: ["wear"], worn: ["wear"], wears: ["wear"], wearing: ["wear"],
  chose: ["choose"], chosen: ["choose"], chooses: ["choose"], choosing: ["choose"],
  // common irregular plurals
  children: ["child"], men: ["man"], women: ["woman"], people: ["person"],
  feet: ["foot"], teeth: ["tooth"], mice: ["mouse"], geese: ["goose"],
};

function stripRegularSuffixes(word: string): string[] {
  const out: string[] = [];
  const w = word.toLowerCase();

  // plural / 3rd person singular
  if (w.endsWith("ies") && w.length > 4) out.push(w.slice(0, -3) + "y");
  if (w.endsWith("es") && w.length > 3) out.push(w.slice(0, -2));
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 2) out.push(w.slice(0, -1));

  // past tense
  if (w.endsWith("ied") && w.length > 4) out.push(w.slice(0, -3) + "y");
  if (w.endsWith("ed") && w.length > 3) {
    out.push(w.slice(0, -2)); // e.g. "walked" -> "walk"
    out.push(w.slice(0, -1)); // e.g. "liked" -> "like"
    // doubled final consonant: "stopped" -> "stop"
    if (/([a-z])\1ed$/.test(w)) out.push(w.slice(0, -3));
  }

  // gerund / present participle
  if (w.endsWith("ing") && w.length > 4) {
    out.push(w.slice(0, -3)); // e.g. "walking" -> "walk"
    out.push(w.slice(0, -3) + "e"); // e.g. "making" -> "make"
    // doubled final consonant: "stopping" -> "stop"
    if (/([a-z])\1ing$/.test(w)) out.push(w.slice(0, -4));
  }

  return out;
}

// Returns the input word plus every candidate base/inflected form worth
// checking against the DB — never throws, never calls any network/AI API.
export function getLemmaCandidates(word: string): string[] {
  const w = word.trim().toLowerCase();
  if (!w) return [];
  const candidates = new Set<string>([w]);
  for (const base of IRREGULAR[w] ?? []) candidates.add(base);
  for (const stripped of stripRegularSuffixes(w)) candidates.add(stripped);
  return [...candidates];
}

function normalizeSingleWord(w: string): string {
  if (IRREGULAR[w]) return IRREGULAR[w][0];
  const [stripped] = stripRegularSuffixes(w);
  return stripped ?? w;
}

// Best-effort local normalization to a dictionary base form — no AI call.
// For a single word, applies the irregular-form map / suffix-stripping
// rules above. For a multi-word phrase, only the first token is
// normalized (covers the common "went up" -> "go up" pattern); the rest of
// the phrase is left untouched. Falls back to the original (lowercased,
// whitespace-collapsed) text when nothing matches.
export function localNormalize(text: string): string {
  const trimmed = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  const parts = trimmed.split(" ");
  parts[0] = normalizeSingleWord(parts[0]);
  return parts.join(" ");
}
