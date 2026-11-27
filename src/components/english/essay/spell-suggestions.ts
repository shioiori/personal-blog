import { Extension } from "@tiptap/react";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { EssaySpellIssue } from "@/src/declaration/english";

export interface InlineSuggestion extends EssaySpellIssue {
  id: string;
  from: number;
  to: number;
}

interface PluginStateShape {
  suggestions: InlineSuggestion[];
  decorations: DecorationSet;
}

type Meta = { type: "set"; suggestions: InlineSuggestion[] } | { type: "remove"; ids: string[] };

export const spellSuggestionsKey = new PluginKey<PluginStateShape>("spellSuggestions");

let idCounter = 0;

/** Each textblock's text plus a per-char map back to doc positions. */
export function collectTextblocks(doc: PMNode): { text: string; pos: number[] }[] {
  const blocks: { text: string; pos: number[] }[] = [];
  doc.descendants((node, nodePos) => {
    if (!node.isTextblock) return true;
    let text = "";
    const pos: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        for (let i = 0; i < child.text.length; i++) {
          text += child.text[i];
          pos.push(nodePos + 1 + offset + i);
        }
      } else {
        // hard break / inline atom: keep alignment but never match across it
        text += "\n";
        pos.push(nodePos + 1 + offset);
      }
    });
    blocks.push({ text, pos });
    return false;
  });
  return blocks;
}

/** Locates each issue's `original` text inside the doc (within a single textblock), left to right, never reusing a range twice. */
export function locateIssues(doc: PMNode, issues: EssaySpellIssue[]): { found: InlineSuggestion[]; missing: EssaySpellIssue[] } {
  const blocks = collectTextblocks(doc);
  const used: { from: number; to: number }[] = [];
  const overlaps = (from: number, to: number) => used.some((u) => from < u.to && to > u.from);
  const found: InlineSuggestion[] = [];
  const missing: EssaySpellIssue[] = [];

  for (const issue of issues) {
    const needle = issue.original;
    let match: { from: number; to: number } | null = null;
    if (needle) {
      outer: for (const b of blocks) {
        let idx = b.text.indexOf(needle);
        while (idx !== -1) {
          const from = b.pos[idx];
          const to = b.pos[idx + needle.length - 1] + 1;
          if (!overlaps(from, to)) {
            match = { from, to };
            break outer;
          }
          idx = b.text.indexOf(needle, idx + 1);
        }
      }
    }
    if (match) {
      used.push(match);
      idCounter += 1;
      found.push({ ...issue, id: `s${idCounter}`, ...match });
    } else {
      missing.push(issue);
    }
  }
  return { found, missing };
}

function buildWidget(s: InlineSuggestion) {
  return (view: EditorView) => {
    const wrap = document.createElement("span");
    wrap.className = "spell-sugg-widget";
    wrap.contentEditable = "false";
    if (s.explanation) wrap.title = s.explanation;

    if (s.suggestion) {
      const text = document.createElement("span");
      text.className = "spell-sugg-text";
      text.textContent = s.suggestion;
      wrap.appendChild(text);
    }

    const mkBtn = (label: string, cls: string, title: string, onClick: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `spell-sugg-btn ${cls}`;
      b.textContent = label;
      b.title = title;
      b.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      });
      return b;
    };

    if (s.suggestion) {
      wrap.appendChild(mkBtn("✓", "spell-sugg-accept", "Áp dụng", () => acceptSuggestions(view, [s.id])));
    }
    wrap.appendChild(mkBtn("✕", "spell-sugg-reject", "Bỏ qua", () => rejectSuggestions(view, [s.id])));
    return wrap;
  };
}

function buildDecorations(doc: PMNode, suggestions: InlineSuggestion[]): DecorationSet {
  const decos: Decoration[] = [];
  for (const s of suggestions) {
    decos.push(
      Decoration.inline(s.from, s.to, {
        class: s.type === "grammar" ? "spell-sugg-orig spell-sugg-grammar" : "spell-sugg-orig",
        title: s.explanation,
      }),
    );
    decos.push(
      Decoration.widget(s.to, buildWidget(s), {
        side: 1,
        ignoreSelection: true,
        key: `${s.id}:${s.suggestion}`,
        stopEvent: () => true,
      }),
    );
  }
  return DecorationSet.create(doc, decos);
}

function mapSuggestions(tr: Transaction, suggestions: InlineSuggestion[]): InlineSuggestion[] {
  const out: InlineSuggestion[] = [];
  for (const s of suggestions) {
    const from = tr.mapping.map(s.from, 1);
    const to = tr.mapping.map(s.to, -1);
    if (to <= from) continue;
    // Drop a suggestion once the flagged text itself was edited.
    if (tr.doc.textBetween(from, to) !== s.original) continue;
    out.push({ ...s, from, to });
  }
  return out;
}

export function getSuggestions(state: EditorState): InlineSuggestion[] {
  return spellSuggestionsKey.getState(state)?.suggestions ?? [];
}

export function setSuggestions(view: EditorView, suggestions: InlineSuggestion[]) {
  view.dispatch(view.state.tr.setMeta(spellSuggestionsKey, { type: "set", suggestions } satisfies Meta));
}

export function rejectSuggestions(view: EditorView, ids: string[]) {
  view.dispatch(view.state.tr.setMeta(spellSuggestionsKey, { type: "remove", ids } satisfies Meta));
}

export function acceptSuggestions(view: EditorView, ids: string[]) {
  const targets = getSuggestions(view.state)
    .filter((s) => ids.includes(s.id) && s.suggestion)
    .sort((a, b) => b.from - a.from); // right-to-left so earlier positions stay valid
  if (targets.length === 0) return;
  const tr = view.state.tr;
  for (const s of targets) tr.insertText(s.suggestion, s.from, s.to);
  tr.setMeta(spellSuggestionsKey, { type: "remove", ids: targets.map((t) => t.id) } satisfies Meta);
  view.dispatch(tr);
}

export const SpellSuggestions = Extension.create({
  name: "spellSuggestions",
  addProseMirrorPlugins() {
    return [
      new Plugin<PluginStateShape>({
        key: spellSuggestionsKey,
        state: {
          init: () => ({ suggestions: [], decorations: DecorationSet.empty }),
          apply(tr, prev, _old, newState) {
            const meta = tr.getMeta(spellSuggestionsKey) as Meta | undefined;
            let suggestions = prev.suggestions;
            let changed = false;
            if (tr.docChanged && suggestions.length) {
              suggestions = mapSuggestions(tr, suggestions);
              changed = true;
            }
            if (meta?.type === "set") {
              suggestions = meta.suggestions;
              changed = true;
            } else if (meta?.type === "remove") {
              suggestions = suggestions.filter((s) => !meta.ids.includes(s.id));
              changed = true;
            }
            if (!changed) return prev;
            return { suggestions, decorations: buildDecorations(newState.doc, suggestions) };
          },
        },
        props: {
          decorations: (state) => spellSuggestionsKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});
