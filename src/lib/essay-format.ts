export interface LegacyEssayPart {
  type: string;
  bodyIndex?: number;
  translationText?: string;
}

export function joinLegacyEssayText(parts: LegacyEssayPart[]): string {
  const text = (p?: LegacyEssayPart) => p?.translationText?.trim() ?? "";
  const bodies = [...new Set(parts.flatMap((p) => (p.bodyIndex === undefined ? [] : [p.bodyIndex])))].sort((a, b) => a - b);
  const sections = [
    ["overall_paraphrase", "overall_mainidea"].map((type) => text(parts.find((p) => p.type === type))).filter(Boolean).join(" "),
    ...bodies.map((idx) => parts.filter((p) => p.bodyIndex === idx).map(text).filter(Boolean).join(" ")),
    text(parts.find((p) => p.type === "conclusion")),
  ];
  return sections.filter(Boolean).join("\n\n\n");
}
