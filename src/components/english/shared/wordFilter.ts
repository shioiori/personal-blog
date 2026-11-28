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
  const dir = f.sortDir === "asc" ? 1 : -1;
  result.sort((a, b) => {
    let cmp = 0;
    if (f.sortField === "alphabet") cmp = a.word.localeCompare(b.word);
    else if (f.sortField === "wordType") cmp = wordTypeKey(a).localeCompare(wordTypeKey(b));
    else cmp = a.groupIds.length - b.groupIds.length;
    return cmp * dir;
  });
  return result;
}
