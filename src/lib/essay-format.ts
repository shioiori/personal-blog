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

const OPTIONAL_TYPES: EssayPartType[] = ["body_explain", "body_example", "body_consequence", "body_link"];

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

  // The extra "\n" becomes a visible blank line between sections in the editor (see textToHtml).
  return sections.join("\n\n\n");
}

/** Parts in the order `joinEssayText` emits them, grouped by section (overall, each body, conclusion). */
function partsInJoinOrder(parts: EssayPart[]): EssayPart[][] {
  const sections: EssayPart[][] = [];
  sections.push(
    (["overall_paraphrase", "overall_mainidea"] as EssayPartType[])
      .map((type) => parts.find((p) => p.type === type))
      .filter((p): p is EssayPart => !!p),
  );
  for (const idx of bodyIndices(parts)) sections.push(parts.filter((p) => p.bodyIndex === idx));
  const conclusion = parts.find((p) => p.type === "conclusion");
  if (conclusion) sections.push([conclusion]);
  return sections;
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

/** Word-level LCS between two token lists; returns, for each old token, the index of the matching new token (or -1). */
function matchTokens(a: string[], b: string[]): number[] {
  const match = new Array<number>(a.length).fill(-1);
  // Trim the common prefix/suffix first — a typical keystroke touches one spot, so the DP stays tiny.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    match[start] = start;
    start++;
  }
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
    match[endA] = endB;
  }
  const n = endA - start;
  const m = endB - start;
  if (n === 0 || m === 0) return match;
  // Only words anchor the alignment — a bare space matching would split an edit that spans two parts.
  const same = (x: string, y: string) => x === y && /\S/.test(x);
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = same(a[start + i], b[start + j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (same(a[start + i], b[start + j])) {
      match[start + i] = start + j;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return match;
}

/**
 * Inverse of `joinEssayText`: writes an edited essay text (step 3) back into each part's translation (step 2).
 * Diffs the current joined translation against `text` word by word; unchanged words stay with their part, and each
 * changed stretch goes to the part it replaced (or the part it was typed next to). The step-3 text always wins.
 */
export function applyTextToParts(parts: EssayPart[], text: string): EssayPart[] {
  const sections = partsInJoinOrder(parts);
  const allOrdered = sections.flat();
  if (allOrdered.length === 0) return parts;

  // Rebuild the joined text token by token, remembering which part owns each token (-1 = separator between parts).
  const oldTokens: string[] = [];
  const oldOwners: number[] = [];
  let firstSection = true;
  for (const section of sections) {
    const filled = section.filter((p) => p.translationText.trim());
    if (filled.length === 0) continue;
    if (!firstSection) {
      oldTokens.push("\n\n\n");
      oldOwners.push(-1);
    }
    firstSection = false;
    filled.forEach((p, k) => {
      if (k > 0) {
        oldTokens.push(" ");
        oldOwners.push(-1);
      }
      for (const t of tokenize(p.translationText.trim())) {
        oldTokens.push(t);
        oldOwners.push(allOrdered.indexOf(p));
      }
    });
  }

  const newTokens = tokenize(text);
  const match = matchTokens(oldTokens, newTokens);
  const newOwners = new Array<number>(newTokens.length).fill(-1);
  for (let i = 0; i < oldTokens.length; i++) if (match[i] >= 0) newOwners[match[i]] = oldOwners[i];

  // Every unmatched run of new tokens sits between two matched old tokens; pick the part it belongs to.
  let oi = 0; // old tokens consumed
  let nj = 0;
  let lastOwner = -1;
  while (nj < newTokens.length) {
    if (oi < oldTokens.length && match[oi] === nj) {
      if (oldOwners[oi] >= 0) lastOwner = oldOwners[oi];
      oi++;
      nj++;
      continue;
    }
    // Old tokens removed in this hunk: those before the next matched old token.
    const hunkStart = oi;
    while (oi < oldTokens.length && match[oi] < 0) oi++;
    const nextMatchNew = oi < oldTokens.length ? match[oi] : newTokens.length;
    const removedOwner = oldOwners.slice(hunkStart, oi).find((o) => o >= 0);
    const prevOwner = hunkStart > 0 ? oldOwners[hunkStart - 1] : -1;
    const nextOwner = oi < oldTokens.length ? oldOwners[oi] : -1;
    let owner = removedOwner ?? -1;
    if (owner < 0) owner = prevOwner >= 0 ? prevOwner : nextOwner;
    if (owner < 0) owner = lastOwner >= 0 ? lastOwner : 0;
    for (; nj < nextMatchNew; nj++) newOwners[nj] = owner;
  }

  const texts = allOrdered.map(() => "");
  newTokens.forEach((t, k) => {
    if (newOwners[k] >= 0) texts[newOwners[k]] += t;
  });
  const byId = new Map(allOrdered.map((p, k) => [p.id, texts[k].trim()]));
  return parts.map((p) => {
    const next = byId.get(p.id);
    return next === undefined || next === p.translationText ? p : { ...p, translationText: next };
  });
}

export const PART_LABEL_VI: Record<EssayPartType, string> = {
  overall_paraphrase: "Mở bài – Diễn giải lại đề (paraphrase)",
  overall_mainidea: "Mở bài – Ý chính (main idea)",
  body_point: "Luận điểm (point)",
  body_explain: "Giải thích (explain)",
  body_example: "Ví dụ (example)",
  body_consequence: "Hệ quả (consequence)",
  body_link: "Liên kết (link)",
  conclusion: "Kết bài (conclusion)",
};
