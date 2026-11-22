function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Converts plain text with blank-line-separated paragraphs into TipTap-compatible HTML — plain text alone collapses
 * newlines since TipTap parses `content` as HTML. "\n\n" separates paragraphs; every extra "\n" beyond that becomes an
 * empty paragraph (a visible blank line), so the conversion round-trips with `blocksToText`.
 */
export function textToHtml(text: string): string {
  const pieces = text.trim().split(/(\n{2,})/);
  const html: string[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    if (i % 2 === 1) {
      for (let k = 2; k < piece.length; k++) html.push("<p></p>");
      continue;
    }
    const p = piece.trim();
    if (p) html.push(`<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`);
  }
  return html.length ? html.join("") : "<p></p>";
}

/** Inverse of `textToHtml`: joins block texts with "\n\n", each empty block in between adds one more "\n". */
export function blocksToText(blocks: string[]): string {
  let out = "";
  let pendingEmpty = 0;
  for (const b of blocks) {
    if (!b.trim()) {
      if (out) pendingEmpty += 1;
      continue;
    }
    if (out) out += "\n\n" + "\n".repeat(pendingEmpty);
    out += b;
    pendingEmpty = 0;
  }
  return out;
}
