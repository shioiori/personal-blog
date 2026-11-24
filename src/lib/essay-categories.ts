// Common IELTS Writing Task 2 topics. The list is fixed in code; an essay stores
// any number of these ids. Ids are persisted in the DB, so rename a label freely
// but keep its id (or add a remap in ensureEssayTables).
export const ESSAY_CATEGORIES = [
  { id: "advertising", label: "Advertising" },
  { id: "animal_rights", label: "Animal rights" },
  { id: "art", label: "Art" },
  { id: "cities", label: "Cities" },
  { id: "crime", label: "Crime" },
  { id: "education", label: "Education" },
  { id: "environment", label: "Environment" },
  { id: "family", label: "Family" },
  { id: "gender", label: "Gender" },
  { id: "genetic_engineering", label: "Genetic Engineering" },
  { id: "global_issues", label: "Global issues" },
  { id: "government", label: "Government and Society" },
  { id: "guns", label: "Gun and Weapons" },
  { id: "health", label: "Health" },
  { id: "housing", label: "Housing and Architecture" },
  { id: "language", label: "Language" },
  { id: "money", label: "Money" },
  { id: "personality", label: "Personality" },
  { id: "sport", label: "Sport and leisure" },
  { id: "tv_internet", label: "Television, Internet, Phones" },
  { id: "technology", label: "Technology" },
  { id: "tourism", label: "Tourism" },
  { id: "traditional_modern", label: "Traditional vs Modern" },
  { id: "transport", label: "Transport" },
  { id: "work", label: "Work" },
] as const;

export type EssayCategory = (typeof ESSAY_CATEGORIES)[number]["id"];

/** Ids from the earlier 12-topic list that no longer exist, and what they become. */
export const LEGACY_CATEGORY_REMAP: Record<string, EssayCategory> = {
  globalisation: "global_issues",
  media: "advertising",
  culture: "tourism",
};

const IDS = new Set<string>(ESSAY_CATEGORIES.map((c) => c.id));

export function isEssayCategory(v: unknown): v is EssayCategory {
  return typeof v === "string" && IDS.has(v);
}

/** Keeps only known ids, de-duplicated, in ESSAY_CATEGORIES order. */
export function normalizeEssayCategories(v: unknown): EssayCategory[] {
  if (!Array.isArray(v)) return [];
  const set = new Set(v.filter(isEssayCategory));
  return ESSAY_CATEGORIES.map((c) => c.id).filter((id) => set.has(id));
}

export function essayCategoryLabel(id: string): string {
  return ESSAY_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
