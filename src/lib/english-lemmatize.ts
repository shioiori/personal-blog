// Local, dictionary-based lemmatization (wink-lemmatizer, WordNet-backed) —
// no AI call. Used to widen the duplicate-word check (e.g. "went" should be
// recognized as a form of "go" already in the DB) and to normalize a
// selected word/phrase before the AI pipeline (gloss/ai-define) runs.
import wordnetLemmatizer from "wink-lemmatizer";

function allLemmas(w: string): string[] {
  return [wordnetLemmatizer.verb(w), wordnetLemmatizer.noun(w), wordnetLemmatizer.adjective(w)];
}

// Returns the input word plus every candidate base form worth checking
// against the DB — never throws, never calls any network/AI API.
export function getLemmaCandidates(word: string): string[] {
  const w = word.trim().toLowerCase();
  if (!w) return [];
  return [...new Set([w, ...allLemmas(w)])];
}

function normalizeSingleWord(w: string): string {
  // Each wink-lemmatizer function returns the input unchanged when it
  // doesn't recognize it as that part of speech, so prefer whichever
  // actually changed the word (i.e. found a real inflection).
  return allLemmas(w).find((lemma) => lemma !== w) ?? w;
}

// Best-effort local normalization to a dictionary base form — no AI call.
// For a single word, returns its lemma. For a multi-word phrase, only the
// first token is normalized (covers the common "went up" -> "go up"
// pattern); the rest of the phrase is left untouched.
export function localNormalize(text: string): string {
  const trimmed = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  const parts = trimmed.split(" ");
  parts[0] = normalizeSingleWord(parts[0]);
  return parts.join(" ");
}
