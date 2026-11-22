export type DiffTokenType = "equal" | "add" | "remove";

export interface DiffToken {
  type: DiffTokenType;
  value: string;
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

/** Word-level LCS diff (git-style additions/deletions) between two texts. */
export function diffWords(oldText: string, newText: string): DiffToken[] {
  const a = tokenize(oldText);
  const b = tokenize(newText);
  const n = a.length;
  const m = b.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push({ type: "equal", value: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "remove", value: a[i] });
      i++;
    } else {
      result.push({ type: "add", value: b[j] });
      j++;
    }
  }
  while (i < n) {
    result.push({ type: "remove", value: a[i] });
    i++;
  }
  while (j < m) {
    result.push({ type: "add", value: b[j] });
    j++;
  }

  // Merge adjacent tokens of the same type for cleaner rendering.
  const merged: DiffToken[] = [];
  for (const token of result) {
    const last = merged[merged.length - 1];
    if (last && last.type === token.type) {
      last.value += token.value;
    } else {
      merged.push({ ...token });
    }
  }
  return merged;
}
