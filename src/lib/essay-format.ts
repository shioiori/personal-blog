import type { EssayPart, EssayPartType } from "@/src/declaration/english";

export const MIN_BODY_COUNT = 2;

let idCounter = 0;
function newPartId(): string {
  idCounter += 1;
  return `p${Date.now()}_${idCounter}`;
}

function makePart(type: EssayPartType, bodyIndex?: number): EssayPart {
  return { id: newPartId(), type, bodyIndex, outlineText: "", translationText: "" };
}

function makeBody(bodyIndex: number): EssayPart[] {
  return [makePart("body_point", bodyIndex), makePart("body_explain", bodyIndex), makePart("body_example", bodyIndex)];
}

export function defaultEssayParts(): EssayPart[] {
  return [
    makePart("overall_paraphrase"),
    makePart("overall_mainidea"),
    ...makeBody(0),
    ...makeBody(1),
    makePart("conclusion"),
  ];
}

export function bodyIndices(parts: EssayPart[]): number[] {
  const set = new Set<number>();
  for (const p of parts) if (p.bodyIndex !== undefined) set.add(p.bodyIndex);
  return [...set].sort((a, b) => a - b);
}

export function addBody(parts: EssayPart[]): EssayPart[] {
  const nextIndex = bodyIndices(parts).length;
  const conclusionIdx = parts.findIndex((p) => p.type === "conclusion");
  const newParts = [...parts];
  newParts.splice(conclusionIdx >= 0 ? conclusionIdx : newParts.length, 0, ...makeBody(nextIndex));
  return newParts;
}

export function removeBody(parts: EssayPart[], bodyIndex: number): EssayPart[] {
  if (bodyIndices(parts).length <= MIN_BODY_COUNT) return parts;
  const remaining = parts.filter((p) => p.bodyIndex !== bodyIndex);
  // Re-number remaining bodies so indices stay contiguous from 0.
  const remainingIndices = bodyIndices(remaining);
  return remaining.map((p) => {
    if (p.bodyIndex === undefined) return p;
    return { ...p, bodyIndex: remainingIndices.indexOf(p.bodyIndex) };
  });
}

const OPTIONAL_TYPES: EssayPartType[] = ["body_explain", "body_example", "body_link"];

export function addOptionalPart(parts: EssayPart[], bodyIndex: number, type: EssayPartType): EssayPart[] {
  if (!OPTIONAL_TYPES.includes(type)) return parts;
  // Insert right after the last existing part of this body (keeps body's parts contiguous).
  const lastIdxOfBody = parts.map((p) => p.bodyIndex).lastIndexOf(bodyIndex);
  const insertAt = lastIdxOfBody >= 0 ? lastIdxOfBody + 1 : parts.length;
  const newParts = [...parts];
  newParts.splice(insertAt, 0, makePart(type, bodyIndex));
  return newParts;
}

export function removeOptionalPart(parts: EssayPart[], partId: string): EssayPart[] {
  const part = parts.find((p) => p.id === partId);
  if (!part || !OPTIONAL_TYPES.includes(part.type)) return parts;
  return parts.filter((p) => p.id !== partId);
}

/** Swaps this body with the previous/next one (by bodyIndex), keeping body numbering contiguous. */
export function moveBody(parts: EssayPart[], bodyIndex: number, direction: "up" | "down"): EssayPart[] {
  const indices = bodyIndices(parts);
  const pos = indices.indexOf(bodyIndex);
  const swapWith = direction === "up" ? pos - 1 : pos + 1;
  if (pos < 0 || swapWith < 0 || swapWith >= indices.length) return parts;
  const otherIndex = indices[swapWith];
  return parts.map((p) => {
    if (p.bodyIndex === bodyIndex) return { ...p, bodyIndex: otherIndex };
    if (p.bodyIndex === otherIndex) return { ...p, bodyIndex };
    return p;
  });
}

/** Swaps this part with its previous/next sibling within the same body. */
export function movePartWithinBody(parts: EssayPart[], partId: string, direction: "up" | "down"): EssayPart[] {
  const part = parts.find((p) => p.id === partId);
  if (!part || part.bodyIndex === undefined) return parts;
  const siblingIds = parts.filter((p) => p.bodyIndex === part.bodyIndex).map((p) => p.id);
  const pos = siblingIds.indexOf(partId);
  const swapWith = direction === "up" ? pos - 1 : pos + 1;
  if (swapWith < 0 || swapWith >= siblingIds.length) return parts;
  const globalA = parts.findIndex((p) => p.id === siblingIds[pos]);
  const globalB = parts.findIndex((p) => p.id === siblingIds[swapWith]);
  const next = [...parts];
  [next[globalA], next[globalB]] = [next[globalB], next[globalA]];
  return next;
}

export function validateEssayParts(parts: EssayPart[]): string | null {
  if (bodyIndices(parts).length < MIN_BODY_COUNT) return `Cần ít nhất ${MIN_BODY_COUNT} đoạn body.`;
  const bodies = bodyIndices(parts);
  for (const idx of bodies) {
    const hasPoint = parts.some((p) => p.bodyIndex === idx && p.type === "body_point");
    if (!hasPoint) return `Body ${idx + 1} thiếu luận điểm (point).`;
  }
  return null;
}

/** Joins every part's translation into one essay text, in exam order (Overall -> Body 1..N -> Conclusion). */
export function joinEssayText(parts: EssayPart[]): string {
  const order: EssayPartType[] = ["overall_paraphrase", "overall_mainidea"];
  const bodies = bodyIndices(parts);
  const sections: string[] = [];

  const overall = order
    .map((type) => parts.find((p) => p.type === type)?.translationText.trim())
    .filter(Boolean)
    .join(" ");
  if (overall) sections.push(overall);

  for (const idx of bodies) {
    const bodyParts = parts
      .filter((p) => p.bodyIndex === idx)
      .sort((a, b) => parts.indexOf(a) - parts.indexOf(b));
    const text = bodyParts.map((p) => p.translationText.trim()).filter(Boolean).join(" ");
    if (text) sections.push(text);
  }

  const conclusion = parts.find((p) => p.type === "conclusion")?.translationText.trim();
  if (conclusion) sections.push(conclusion);

  return sections.join("\n\n");
}

export const PART_LABEL_VI: Record<EssayPartType, string> = {
  overall_paraphrase: "Mở bài – Diễn giải lại đề (paraphrase)",
  overall_mainidea: "Mở bài – Ý chính (main idea)",
  body_point: "Luận điểm (point)",
  body_explain: "Giải thích (explain)",
  body_example: "Ví dụ (example)",
  body_link: "Liên kết (link)",
  conclusion: "Kết bài (conclusion)",
};
