// The topics that come up most often in IELTS Writing Task 2. The list is fixed
// in code; an essay stores one of these ids (or null when not categorized yet).
export const ESSAY_CATEGORIES = [
  { id: "education", label: "Giáo dục", en: "Education" },
  { id: "technology", label: "Công nghệ", en: "Technology" },
  { id: "environment", label: "Môi trường", en: "Environment" },
  { id: "health", label: "Sức khỏe", en: "Health" },
  { id: "work", label: "Công việc", en: "Work & Employment" },
  { id: "crime", label: "Tội phạm & Pháp luật", en: "Crime & Law" },
  { id: "government", label: "Chính phủ & Chi tiêu công", en: "Government" },
  { id: "family", label: "Gia đình & Xã hội", en: "Family & Society" },
  { id: "globalisation", label: "Toàn cầu hóa", en: "Globalisation" },
  { id: "media", label: "Truyền thông & Quảng cáo", en: "Media & Advertising" },
  { id: "cities", label: "Đô thị & Giao thông", en: "Cities & Transport" },
  { id: "culture", label: "Văn hóa & Du lịch", en: "Culture & Tourism" },
] as const;

export type EssayCategory = (typeof ESSAY_CATEGORIES)[number]["id"];

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

export function essayCategoryLabel(id: EssayCategory | null | undefined): string | null {
  const c = ESSAY_CATEGORIES.find((x) => x.id === id);
  return c ? `${c.label} (${c.en})` : null;
}
