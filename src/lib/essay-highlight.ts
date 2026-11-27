import { getLemmaCandidates } from "./english-lemmatize";

const TOKEN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

function tokenize(s: string): { text: string; start: number; end: number }[] {
  return [...s.matchAll(TOKEN)].map((m) => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
}

export function findTermMatches(text: string, terms: string[]): string[] {
  const byFirstLemma = new Map<string, Set<string>[][]>();
  for (const term of terms) {
    const phrase = tokenize(term).map((t) => new Set(getLemmaCandidates(t.text)));
    for (const lemma of phrase[0] ?? []) {
      if (!byFirstLemma.has(lemma)) byFirstLemma.set(lemma, []);
      byFirstLemma.get(lemma)!.push(phrase);
    }
  }

  const matches = new Set<string>();
  for (const line of text.split("\n")) {
    const tokens = tokenize(line);
    const lemmas = tokens.map((t) => getLemmaCandidates(t.text));
    tokens.forEach((token, i) => {
      for (const phrase of new Set(lemmas[i].flatMap((l) => byFirstLemma.get(l) ?? []))) {
        const last = tokens[i + phrase.length - 1];
        if (last && phrase.every((set, j) => lemmas[i + j].some((l) => set.has(l)))) matches.add(line.slice(token.start, last.end));
      }
    });
  }
  return [...matches];
}
