import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { collectTextblocks } from "./spell-suggestions";

interface PluginStateShape {
  terms: string[];
  decorations: DecorationSet;
}

const groupHighlightKey = new PluginKey<PluginStateShape>("groupHighlight");

function buildDecorations(doc: PMNode, terms: string[]): DecorationSet {
  if (terms.length === 0) return DecorationSet.empty;
  const alternatives = [...terms]
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, "giu");
  const decos: Decoration[] = [];
  for (const b of collectTextblocks(doc)) {
    for (const m of b.text.matchAll(re)) {
      decos.push(Decoration.inline(b.pos[m.index], b.pos[m.index + m[0].length - 1] + 1, { class: "group-hl" }));
    }
  }
  return DecorationSet.create(doc, decos);
}

export function setHighlightTerms(view: EditorView, terms: string[]) {
  view.dispatch(view.state.tr.setMeta(groupHighlightKey, terms));
}

export const GroupHighlight = Extension.create({
  name: "groupHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin<PluginStateShape>({
        key: groupHighlightKey,
        state: {
          init: () => ({ terms: [], decorations: DecorationSet.empty }),
          apply(tr, prev, _old, newState) {
            const terms = (tr.getMeta(groupHighlightKey) as string[] | undefined) ?? prev.terms;
            if (terms === prev.terms && !(tr.docChanged && terms.length)) return prev;
            return { terms, decorations: buildDecorations(newState.doc, terms) };
          },
        },
        props: {
          decorations: (state) => groupHighlightKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});
