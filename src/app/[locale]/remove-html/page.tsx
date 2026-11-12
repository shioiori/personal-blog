"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/Button";
import { Textarea } from "@/src/components/ui/Textarea";
import { Input } from "@/src/components/ui/Input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/src/components/ui/Card";
import {
  bestMatch,
  codeToChar,
  contextAround,
  decodeChars,
  extractFontName,
  getReferenceVectors,
  glyphVector,
  loadFontFace,
  loadFontMap,
  loadGlobalMap,
  MATCH_MIN_SCORE,
  PUA,
  saveFontMap,
  saveGlobalMap,
  stripHtml
} from "@/src/lib/remove-html";

const BOOKMARKLET_HREF =
  "javascript:" +
  encodeURIComponent(
    `(async () => { const spans = [...document.querySelectorAll('.onebook_paragraph_comment_text')]; if (!spans.length) { alert('Không thấy nội dung chương trên trang này'); return; } const re = /jjwxcfont_[0-9a-z]+/i; const find = s => (String(s).match(re) || [])[0]; let font = find(getComputedStyle(spans[0]).fontFamily) || find(performance.getEntriesByType('resource').map(e => e.name).join(' ')) || find(document.documentElement.outerHTML); if (!font) { for (const ff of document.fonts) { font = find(ff.family); if (font) break; } } const box = spans[0].closest('[id^="content_"]') || spans[0].parentNode.parentNode; const pseudo = (el, p) => { const c = getComputedStyle(el, p).content; const m = /^"([\\s\\S]*)"$/.exec(c); return m ? m[1].replace(/\\\\([0-9a-f]{1,6}) ?|\\\\(.)/gi, (_, h, ch) => h ? String.fromCodePoint(parseInt(h, 16)) : ch) : ''; }; const live = [...box.querySelectorAll('*')]; const copy = box.cloneNode(true); [...copy.querySelectorAll('*')].forEach((el, i) => { const b = pseudo(live[i], '::before'), a = pseudo(live[i], '::after'); if (b) el.prepend(b); if (a) el.append(a); }); copy.querySelectorAll('.onebook_paragraph_comment_bubble_mount').forEach(el => el.remove()); const out = '<!-- ' + (font || '') + ' -->' + copy.innerHTML; try { await navigator.clipboard.writeText(out); } catch (e) { const t = document.createElement('textarea'); t.value = out; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); } alert('Đã copy ' + spans.length + ' đoạn' + (font ? ' (font ' + font + ')' : ' - KHÔNG tìm thấy tên font')); })();`
  );

interface UnresolvedEntry {
  code: string;
  context: string;
}

export default function RemoveHtmlPage() {
  const t = useTranslations("RemoveHtml");
  const [raw, setRaw] = useState("");
  const [fontName, setFontName] = useState("");
  const [result, setResult] = useState("");
  const [unresolved, setUnresolved] = useState<UnresolvedEntry[]>([]);
  const [fixes, setFixes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strippedRef = useRef<string>("");

  const activeFontName = useMemo(
    () => fontName.trim() || extractFontName(raw) || "",
    [fontName, raw]
  );

  async function applyMapsAndShow(stripped: string, fontMapOverride?: Record<string, string>) {
    const fontMap = fontMapOverride ?? (activeFontName ? loadFontMap(activeFontName) : {});
    const globalMap = loadGlobalMap();
    const { text, unknown } = decodeChars(stripped, [fontMap, globalMap]);
    setResult(text);
    setUnresolved(
      [...unknown].map((code) => ({ code, context: contextAround(stripped, codeToChar(code)) }))
    );
  }

  async function handleProcess() {
    setStatus(null);
    const stripped = stripHtml(raw);
    strippedRef.current = stripped;
    if (!stripped) {
      setResult("");
      setUnresolved([]);
      toast.error(t("emptyResult"));
      return;
    }

    const codes = new Set([...stripped.matchAll(PUA)].map((m) => m[0]));
    if (codes.size === 0) {
      await applyMapsAndShow(stripped);
      return;
    }

    const globalMap = loadGlobalMap();
    const fontMap = activeFontName ? loadFontMap(activeFontName) : {};
    const missing = [...codes].filter((c) => fontMap[c] === undefined && globalMap[c] === undefined);

    if (missing.length === 0) {
      await applyMapsAndShow(stripped, fontMap);
      return;
    }

    if (!activeFontName) {
      toast.warning(t("needFontName"));
      await applyMapsAndShow(stripped, fontMap);
      return;
    }

    setBusy(true);
    try {
      setStatus(t("statusLoadingFont"));
      const family = `remove-html-${activeFontName}`;
      await loadFontFace(family, `/api/remove-html/font?name=${activeFontName}`);

      setStatus(t("statusBuildingReference"));
      const refs = await getReferenceVectors((done, totalCount) =>
        setStatus(t("statusBuildingReferenceProgress", { done, total: totalCount }))
      );

      setStatus(t("statusMatching"));
      for (const ch of missing) {
        const vec = glyphVector(family, ch);
        if (vec) {
          const match = bestMatch(vec, refs);
          if (match && match.score >= MATCH_MIN_SCORE) {
            fontMap[ch] = match.ch;
          }
        }
        await new Promise((r) => setTimeout(r, 0));
      }
      saveFontMap(activeFontName, fontMap);
      await applyMapsAndShow(stripped, fontMap);
    } catch (e: any) {
      toast.error(e?.message || t("decodeError"));
      await applyMapsAndShow(stripped, fontMap);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  function handleFixChange(code: string, value: string) {
    setFixes((prev) => ({ ...prev, [code]: value }));
  }

  function handleSaveFixes() {
    const entries = Object.entries(fixes).filter(([, v]) => v.trim());
    if (entries.length === 0) return;
    const globalMap = loadGlobalMap();
    const fontMap = activeFontName ? loadFontMap(activeFontName) : {};
    for (const [code, value] of entries) {
      const ch = codeToChar(code);
      globalMap[ch] = value.trim();
      if (activeFontName) fontMap[ch] = value.trim();
    }
    saveGlobalMap(globalMap);
    if (activeFontName) saveFontMap(activeFontName, fontMap);
    setFixes({});
    applyMapsAndShow(strippedRef.current);
    toast.success(t("fixesSaved", { count: entries.length }));
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    toast.success(t("copied"));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("bookmarkletTitle")}</CardTitle>
          <CardDescription>{t("bookmarkletDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href={BOOKMARKLET_HREF}
            onClick={(e) => e.preventDefault()}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            {t("bookmarkletButton")}
          </a>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t("pasteLabel")}</label>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={t("pastePlaceholder")}
          className="min-h-48 font-mono text-sm"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("fontLabel")}</label>
          <Input
            value={fontName}
            onChange={(e) => setFontName(e.target.value)}
            placeholder={activeFontName || "jjwxcfont_xxxxx"}
            className="w-56"
          />
        </div>
        <Button onClick={handleProcess} disabled={busy || !raw.trim()}>
          {busy ? status ?? t("processing") : t("processButton")}
        </Button>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("resultLabel")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea readOnly value={result} className="min-h-48 text-sm" />
          </CardContent>
          <CardFooter>
            <Button variant="secondary" onClick={handleCopy}>
              {t("copyButton")}
            </Button>
          </CardFooter>
        </Card>
      )}

      {unresolved.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("unresolvedTitle", { count: unresolved.length })}</CardTitle>
            <CardDescription>{t("unresolvedDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {unresolved.map(({ code, context }) => (
              <div key={code} className="flex items-center gap-2">
                <span className="w-56 shrink-0 truncate text-sm text-muted-foreground" title={context}>
                  [{code}] {context}
                </span>
                <Input
                  value={fixes[code] ?? ""}
                  onChange={(e) => handleFixChange(code, e.target.value)}
                  placeholder={t("correctCharPlaceholder")}
                  className="w-24"
                />
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="secondary" onClick={handleSaveFixes}>
              {t("saveFixesButton")}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
