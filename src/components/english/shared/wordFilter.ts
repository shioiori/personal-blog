import type { EnglishWord } from "@/src/declaration/english";

export type SortField = "alphabet" | "wordType" | "frequency";
export type SortDir = "asc" | "desc";

export interface WordFilter {
  search: string;
  /** "all", "none" (ungrouped) or a group id as string. */
  group: string;
  sortField: SortField;
  sortDir: SortDir;
}

function wordTypeKey(w: EnglishWord): string {
  return (w.senses[0]?.partOfSpeech ?? "").toLowerCase();
}

// Same filter + sort the Study tab applies to its word list.
export function filterAndSortWords(words: EnglishWord[], f: WordFilter): EnglishWord[] {
  const q = f.search.trim().toLowerCase();
  const result = words.filter((w) => {
    if (f.group === "none") {
      if (w.groupIds.length > 0) return false;
    } else if (f.group !== "all" && !w.groupIds.includes(parseInt(f.group, 10))) {
      return false;
    }
    if (q && ![w.word, w.altSpelling ?? ""].some((v) => v.toLowerCase().includes(q))) return false;
    return true;
  });
  return sortWords(result, f.sortField, f.sortDir);
}

/** Sorts in place (and returns) the list by the Study tab's sort options. */
export function sortWords(words: EnglishWord[], field: SortField, dir: SortDir): EnglishWord[] {
  const sign = dir === "asc" ? 1 : -1;
  return words.sort((a, b) => {
    let cmp = 0;
    if (field === "alphabet") cmp = a.word.localeCompare(b.word);
    else if (field === "wordType") cmp = wordTypeKey(a).localeCompare(wordTypeKey(b));
    else cmp = a.groupIds.length - b.groupIds.length;
    return cmp * sign;
  });
}
