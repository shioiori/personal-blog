// Common IELTS Writing Task 2 topics. The list is fixed in code; an essay stores
// any number of these ids. Ids are persisted in the DB, so rename a label freely
// but keep its id (or add a remap in ensureEssayTables).
export const ESSAY_CATEGORIES = [
  { id: "education", label: "Education" },
  { id: "environment", label: "Environment" },
  { id: "technology", label: "Technology" },
  { id: "health", label: "Health & Healthcare" },
  { id: "family", label: "Family" },
  { id: "tourism", label: "Travel and Tourism" },
  { id: "sport", label: "Sport" },
  { id: "globalization", label: "Globalization" },
  { id: "government", label: "Government and Society" },
  { id: "crime", label: "Crime and Punishment" },
  { id: "work", label: "Work" },
  { id: "transport", label: "Transport" },
  { id: "media", label: "Media" },
  { id: "culture", label: "Culture" },
  { id: "urbanization", label: "Urbanization" },
  { id: "science", label: "Science" },
  { id: "food", label: "Food" },
  { id: "animal_rights", label: "Animal Rights" },
  { id: "history", label: "History" },
  { id: "art", label: "Art" },
  { id: "space", label: "Space" },
  { id: "advertising", label: "Advertising" },
  { id: "language", label: "Language" },
  { id: "housing", label: "Housing" },
  { id: "generation", label: "Generation" },
  { id: "economy", label: "Economy" },
  { id: "business", label: "Business" },
  { id: "social_media", label: "Social Media" },
  { id: "leisure", label: "Leisure" },
  { id: "youth", label: "Youth" },
] as const;

export type EssayCategory = (typeof ESSAY_CATEGORIES)[number]["id"];

/** Ids from earlier topic lists that no longer exist, and what they become. */
export const LEGACY_CATEGORY_REMAP: Record<string, EssayCategory> = {
  globalisation: "globalization",
  global_issues: "globalization",
  cities: "urbanization",
  genetic_engineering: "science",
  money: "economy",
  tv_internet: "media",
  traditional_modern: "culture",
  guns: "crime",
  gender: "government",
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
