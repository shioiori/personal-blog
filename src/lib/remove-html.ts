// Browser port of the local remove-html / jjwxc_font tools: strip pasted HTML
// down to plain text, then decode jjwxc's per-chapter obfuscated characters by
// rendering their glyphs and matching them against Noto Sans SC by shape.

const ZERO_WIDTH = /[​‌‍⁠﻿]/g;
const WATERMARK = /@?无限好文，尽在晋江文学城/g;
const LINE_BREAK_TAGS = /<\s*br\s*\/?\s*>|<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi;
const DROP_BLOCKS = /<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi;
const TAG = /<[^>]+>/g;
export const PUA = /[-]/g;
export const FONT_NAME = /jjwxcfont_[0-9a-z]+/i;
export const UNKNOWN_MARK = "□"; // □

function unescapeHtml(text: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

export function stripHtml(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  text = text.replace(DROP_BLOCKS, "");
  text = text.replace(LINE_BREAK_TAGS, "\n");
  text = text.replace(TAG, "");
  text = unescapeHtml(text);
  text = text.replace(ZERO_WIDTH, "");
  text = text.replace(WATERMARK, "");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.replace(/^\n+|\n+$/g, "");
}

export function extractFontName(raw: string): string | null {
  const m = raw.match(FONT_NAME);
  return m ? m[0].toLowerCase() : null;
}

export function decodeChars(
  text: string,
  maps: Record<string, string>[]
): { text: string; unknown: Set<string> } {
  const unknown = new Set<string>();
  const out = text.replace(PUA, (c) => {
    for (const map of maps) {
      if (map[c] !== undefined) return map[c];
    }
    unknown.add(c.codePointAt(0)!.toString(16).padStart(4, "0"));
    return UNKNOWN_MARK;
  });
  return { text: out, unknown };
}

export function contextAround(text: string, ch: string, radius = 12): string {
  const i = text.indexOf(ch);
  if (i < 0) return "";
  const before = text.slice(Math.max(0, i - radius), i);
  const after = text.slice(i + 1, i + 1 + radius);
  return `${before}【${UNKNOWN_MARK}】${after}`.replace(/\n/g, " ");
}

// --- glyph shape matching -------------------------------------------------

const SIZE = 32; // bitmap side used for comparison
const CANVAS_SIZE = 200;
const MIN_SCORE = 0.6;

let workCanvas: HTMLCanvasElement | null = null;
let workCtx: CanvasRenderingContext2D | null = null;

function getWorkCtx(): CanvasRenderingContext2D {
  if (!workCtx) {
    workCanvas = document.createElement("canvas");
    workCanvas.width = CANVAS_SIZE;
    workCanvas.height = CANVAS_SIZE;
    workCtx = workCanvas.getContext("2d", { willReadFrequently: true })!;
  }
  return workCtx;
}

/** Render `ch` with `fontFamily`, crop to its ink, and return a normalized
 * SIZE x SIZE grayscale vector usable for cosine-similarity matching. */
export function glyphVector(fontFamily: string, ch: string): Float32Array | null {
  const ctx = getWorkCtx();
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.font = `160px "${fontFamily}"`;
  ctx.fillText(ch, 20, 150);

  const { data } = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  let minX = CANVAS_SIZE, minY = CANVAS_SIZE, maxX = -1, maxY = -1;
  for (let y = 0; y < CANVAS_SIZE; y++) {
    for (let x = 0; x < CANVAS_SIZE; x++) {
      if (data[(y * CANVAS_SIZE + x) * 4] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const side = Math.max(w, h);
  const crop = document.createElement("canvas");
  crop.width = side;
  crop.height = side;
  const cropCtx = crop.getContext("2d")!;
  cropCtx.drawImage(
    workCanvas!,
    minX, minY, w, h,
    Math.floor((side - w) / 2), Math.floor((side - h) / 2), w, h
  );

  const small = document.createElement("canvas");
  small.width = SIZE;
  small.height = SIZE;
  const smallCtx = small.getContext("2d")!;
  smallCtx.imageSmoothingEnabled = true;
  smallCtx.imageSmoothingQuality = "high";
  smallCtx.drawImage(crop, 0, 0, SIZE, SIZE);

  const pixels = smallCtx.getImageData(0, 0, SIZE, SIZE).data;
  const vec = new Float32Array(SIZE * SIZE);
  let mean = 0;
  for (let i = 0; i < vec.length; i++) {
    vec[i] = pixels[i * 4];
    mean += vec[i];
  }
  mean /= vec.length;
  let norm = 0;
  for (let i = 0; i < vec.length; i++) {
    vec[i] -= mean;
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return null;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

export interface RefGlyph {
  ch: string;
  vec: Float32Array;
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function bestMatch(vec: Float32Array, refs: RefGlyph[]): { ch: string; score: number } | null {
  let bestScore = -Infinity;
  let bestCh = "";
  for (const r of refs) {
    const s = dot(vec, r.vec);
    if (s > bestScore) {
      bestScore = s;
      bestCh = r.ch;
    }
  }
  return bestCh ? { ch: bestCh, score: bestScore } : null;
}

export const MATCH_MIN_SCORE = MIN_SCORE;

/** GB2312 level-1 hanzi (~3755 chars) - covers the vast majority of novel text. */
export function gb2312Level1(): string[] {
  const decoder = new TextDecoder("gbk");
  const chars: string[] = [];
  for (let b1 = 0xb0; b1 <= 0xd7; b1++) {
    for (let b2 = 0xa1; b2 <= 0xfe; b2++) {
      const s = decoder.decode(Uint8Array.of(b1, b2));
      if (s && s !== "�" && s.codePointAt(0)! > 0x80) chars.push(s);
    }
  }
  return chars;
}

export async function loadFontFace(family: string, url: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Không tải được font");
  const buf = await res.arrayBuffer();
  const face = new FontFace(family, buf);
  await face.load();
  (document.fonts as any).add(face);
}

let refVectorsPromise: Promise<RefGlyph[]> | null = null;

export function getReferenceVectors(onProgress?: (done: number, total: number) => void): Promise<RefGlyph[]> {
  if (!refVectorsPromise) {
    refVectorsPromise = (async () => {
      await loadFontFace("remove-html-ref-noto", "/fonts/NotoSansSC-Regular.otf");
      const chars = gb2312Level1();
      const refs: RefGlyph[] = [];
      const BATCH = 200;
      for (let i = 0; i < chars.length; i += BATCH) {
        for (const ch of chars.slice(i, i + BATCH)) {
          const vec = glyphVector("remove-html-ref-noto", ch);
          if (vec) refs.push({ ch, vec });
        }
        onProgress?.(Math.min(i + BATCH, chars.length), chars.length);
        await new Promise((r) => setTimeout(r, 0));
      }
      return refs;
    })();
  }
  return refVectorsPromise;
}

// --- per-font decode map caching (localStorage) ---------------------------

const FONT_MAP_PREFIX = "remove-html:font:";
const GLOBAL_MAP_KEY = "remove-html:charmap";

export function loadFontMap(fontName: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FONT_MAP_PREFIX + fontName) ?? "{}");
  } catch {
    return {};
  }
}

export function saveFontMap(fontName: string, map: Record<string, string>): void {
  localStorage.setItem(FONT_MAP_PREFIX + fontName, JSON.stringify(map));
}

export function loadGlobalMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(GLOBAL_MAP_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveGlobalMap(map: Record<string, string>): void {
  localStorage.setItem(GLOBAL_MAP_KEY, JSON.stringify(map));
}

/** code is a 4+ hex-digit codepoint, e.g. "e123". */
export function codeToChar(code: string): string {
  return String.fromCodePoint(parseInt(code, 16));
}
